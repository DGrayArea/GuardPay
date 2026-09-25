import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';
import crypto from 'crypto';
import { queries, db } from '../config/database';
import { decryptSecret, encryptSecret, isEncrypted, isUnderPrimaryKey } from './keyvault.service';

const EVM_INDEX_COUNTER = 'evm_address_index';

/** BIP44 account node. The xpub is exported here because the levels above it
 *  are hardened and cannot be derived from a public key. */
const ACCOUNT_PATH = "44'/60'/0'";

export type WalletRole = 'all' | 'watch' | 'signer';

class WalletService {
  private root: ethers.HDNodeWallet | null = null;
  /** Neutered account node — derives addresses, cannot sign. */
  private watchNode: ethers.HDNodeWallet | null = null;
  private role: WalletRole = 'all';

  constructor() {
    this.initialize();
  }

  private initialize() {
    this.role = (process.env.WALLET_ROLE as WalletRole) || 'all';

    if (this.role === 'watch') {
      // Watch-only: this process derives and monitors payment addresses but
      // holds no key material at all. A compromise of the web tier yields
      // nothing spendable.
      const xpub = process.env.WALLET_XPUB;
      if (!xpub) {
        throw new Error(
          'WALLET_ROLE=watch requires WALLET_XPUB. Export it from a signer process with `pnpm xpub`.'
        );
      }

      this.watchNode = ethers.HDNodeWallet.fromExtendedKey(xpub) as ethers.HDNodeWallet;
      console.log('✅ Wallet service initialized (watch-only — no signing keys present)');
      return;
    }

    const masterSeed = process.env.MASTER_SEED;

    if (!masterSeed) {
      // A generated seed is lost on restart, taking every payment address with
      // it. Refuse to start rather than silently accept unrecoverable funds.
      throw new Error(
        'MASTER_SEED is not set. Generate one with `npx bip39-cli generate` and add it to server/.env — ' +
          'without it, funds sent to generated payment addresses cannot be recovered.'
      );
    }

    if (!bip39.validateMnemonic(masterSeed)) {
      throw new Error('Invalid MASTER_SEED mnemonic phrase');
    }

    // fromPhrase() returns a node already at m/44'/60'/0'/0/0, which cannot
    // re-derive absolute paths. Derive from the true root instead.
    this.root = ethers.HDNodeWallet.fromSeed(bip39.mnemonicToSeedSync(masterSeed));

    console.log(`✅ Wallet service initialized (role: ${this.role})`);
  }

  get currentRole(): WalletRole {
    return this.role;
  }

  get canSign(): boolean {
    return this.role !== 'watch';
  }

  /**
   * The account-level extended PUBLIC key, for handing to a watch-only process.
   * Safe to copy around: it derives addresses and nothing else.
   */
  exportXpub(): string {
    if (!this.root) throw new Error('No seed in this process — nothing to export');
    return this.root.derivePath(ACCOUNT_PATH).neuter().extendedKey;
  }

  /** Derive a payment address by index, from whichever material this role has. */
  private deriveAddress(index: number): { address: string; privateKey: string | null } {
    if (this.watchNode) {
      const node = this.watchNode.derivePath(`0/${index}`);
      return { address: node.address, privateKey: null };
    }
    if (!this.root) throw new Error('HD Node not initialized');

    const wallet = this.root.derivePath(`${ACCOUNT_PATH}/0/${index}`);
    return { address: wallet.address, privateKey: wallet.privateKey };
  }

  /** Next unused BIP44 index, persisted so a restart never reuses an address. */
  private nextIndex(): number {
    queries.bumpCounter.run(EVM_INDEX_COUNTER);
    const row = queries.getCounter.get(EVM_INDEX_COUNTER) as { value: number };
    return row.value - 1; // counter starts at 1; addresses start at index 0
  }

  /**
   * Generate a unique EVM address for a payment.
   * BIP44 derivation path: m/44'/60'/0'/0/index
   */
  generateEVMAddress(
    invoiceId?: string,
    index?: number
  ): { address: string; privateKey: string | null; index: number } {
    const derivationIndex = index ?? this.nextIndex();
    const { address, privateKey } = this.deriveAddress(derivationIndex);

    if (invoiceId) {
      // Only the index is stored; the key is re-derived on demand by a process
      // that actually holds the seed.
      queries.createWalletKey.run(address, invoiceId, 'EVM', derivationIndex, null);
    }

    return { address, privateKey, index: derivationIndex };
  }

  /**
   * Generate a unique Solana address for a payment.
   * The secret key is persisted — an in-memory keypair means any payment that
   * lands after a restart is permanently unspendable.
   */
  generateSolanaAddress(invoiceId: string): { address: string; publicKey: string } {
    // ed25519 has no public-only derivation, so a Solana address cannot be
    // minted without the ability to store its secret. A watch-only process
    // must delegate this to the signer rather than silently produce an address
    // whose key nobody holds.
    if (!this.canSign) {
      throw new Error(
        'This process is watch-only and cannot create Solana addresses. Route Solana invoices to the signer.'
      );
    }

    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();

    // Encrypted at rest: a stolen database alone must not be enough to spend.
    queries.createWalletKey.run(
      address,
      invoiceId,
      'SOLANA',
      null,
      encryptSecret(Buffer.from(keypair.secretKey).toString('base64'))
    );

    return { address, publicKey: address };
  }

  /** Recover the Solana keypair for a payment address (used when sweeping). */
  getSolanaKeypair(address: string): Keypair | undefined {
    if (!this.canSign) throw new Error('This process is watch-only and holds no signing keys');

    const row = queries.getWalletKeyByAddress.get(address) as
      | { secret_key: string | null }
      | undefined;
    if (!row?.secret_key) return undefined;

    return Keypair.fromSecretKey(Buffer.from(decryptSecret(row.secret_key), 'base64'));
  }

  /**
   * Encrypt any secrets left in plaintext from before this was introduced.
   * Idempotent, and runs inside a transaction so a crash mid-way cannot leave
   * the table half-converted.
   */
  /**
   * Re-encrypt every stored secret under the CURRENT primary key, so a
   * superseded KEY_ENCRYPTION_KEY can be retired. Requires the old key to
   * still be reachable (KEY_ENCRYPTION_KEY_PREVIOUS, or MASTER_SEED for
   * pre-encryption rows).
   */
  rewrapStoredSecrets(): { rewrapped: number; alreadyCurrent: number; failed: string[] } {
    const rows = db
      .prepare('SELECT address, secret_key FROM wallet_keys WHERE secret_key IS NOT NULL')
      .all() as { address: string; secret_key: string }[];

    const update = db.prepare('UPDATE wallet_keys SET secret_key = ? WHERE address = ?');
    const failed: string[] = [];
    let rewrapped = 0;
    let alreadyCurrent = 0;

    for (const row of rows) {
      if (isUnderPrimaryKey(row.secret_key)) {
        alreadyCurrent++;
        continue;
      }
      try {
        // Decrypt with whichever key still works, re-seal under the primary.
        update.run(encryptSecret(decryptSecret(row.secret_key)), row.address);
        rewrapped++;
      } catch {
        failed.push(row.address);
      }
    }

    return { rewrapped, alreadyCurrent, failed };
  }

  /** Report any stored secret that no configured key can open. */
  auditStoredSecrets(): { total: number; unreadable: string[] } {
    const rows = db
      .prepare('SELECT address, secret_key FROM wallet_keys WHERE secret_key IS NOT NULL')
      .all() as { address: string; secret_key: string }[];

    const unreadable = rows
      .filter((r) => {
        try {
          decryptSecret(r.secret_key);
          return false;
        } catch {
          return true;
        }
      })
      .map((r) => r.address);

    return { total: rows.length, unreadable };
  }

  migrateStoredSecrets(): { converted: number; alreadyEncrypted: number } {
    const rows = db
      .prepare('SELECT address, secret_key FROM wallet_keys WHERE secret_key IS NOT NULL')
      .all() as { address: string; secret_key: string }[];

    const plaintext = rows.filter((r) => !isEncrypted(r.secret_key));

    if (plaintext.length > 0) {
      const update = db.prepare('UPDATE wallet_keys SET secret_key = ? WHERE address = ?');
      db.transaction(() => {
        for (const row of plaintext) {
          update.run(encryptSecret(row.secret_key), row.address);
        }
      })();
      console.log(`🔐 Encrypted ${plaintext.length} stored key(s) at rest`);
    }

    return {
      converted: plaintext.length,
      alreadyEncrypted: rows.length - plaintext.length,
    };
  }

  /** Recover the EVM signer for a payment address (used when sweeping). */
  getEVMWallet(address: string): ethers.HDNodeWallet | undefined {
    if (!this.canSign) throw new Error('This process is watch-only and holds no signing keys');

    const row = queries.getWalletKeyByAddress.get(address) as
      | { derivation_index: number | null }
      | undefined;
    if (!this.root || row?.derivation_index == null) return undefined;
    return this.root.derivePath(`${ACCOUNT_PATH}/0/${row.derivation_index}`);
  }

  /** Derive a wallet directly by index. */
  getWalletByIndex(index: number): ethers.HDNodeWallet {
    if (!this.root) throw new Error('No seed in this process');
    return this.root.derivePath(`${ACCOUNT_PATH}/0/${index}`);
  }

  /**
   * The Solana relayer that funds rent and fees.
   *
   * Derived deterministically from MASTER_SEED so it survives a restart and can
   * be recovered from the seed alone — a randomly generated funder would strand
   * whatever SOL had been sent to it. ed25519 has no BIP32 derivation, so the
   * seed is hashed with a distinct label instead.
   */
  getSolanaOperator(): Keypair | null {
    const explicit = process.env.SOLANA_OPERATOR_SECRET;
    if (explicit) {
      return Keypair.fromSecretKey(Buffer.from(explicit, 'base64'));
    }

    const seed = process.env.MASTER_SEED;
    if (!seed || !this.canSign) return null;

    const material = crypto
      .createHash('sha256')
      .update(`guardpay:solana-operator:v1:${seed}`)
      .digest();

    return Keypair.fromSeed(Uint8Array.from(material));
  }

  getCurrentIndex(): number {
    const row = queries.getCounter.get(EVM_INDEX_COUNTER) as { value: number } | undefined;
    return row?.value ?? 0;
  }
}

export const walletService = new WalletService();
