import { ethers } from 'ethers';
import { Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { queries } from '../config/database';

const EVM_INDEX_COUNTER = 'evm_address_index';

class WalletService {
  private mnemonic: string | null = null;
  private root: ethers.HDNodeWallet | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
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

    this.mnemonic = masterSeed;
    // fromPhrase() returns a node already at m/44'/60'/0'/0/0, which cannot
    // re-derive absolute paths. Derive from the true root instead.
    this.root = ethers.HDNodeWallet.fromSeed(bip39.mnemonicToSeedSync(masterSeed));

    console.log('✅ Wallet service initialized');
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
  generateEVMAddress(invoiceId?: string, index?: number): { address: string; privateKey: string; index: number } {
    if (!this.root) {
      throw new Error('HD Node not initialized');
    }

    const derivationIndex = index ?? this.nextIndex();
    const wallet = this.root.derivePath(`44'/60'/0'/0/${derivationIndex}`);

    if (invoiceId) {
      // Only the index is stored; the key is re-derived from MASTER_SEED on demand.
      queries.createWalletKey.run(wallet.address, invoiceId, 'EVM', derivationIndex, null);
    }

    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      index: derivationIndex,
    };
  }

  /**
   * Generate a unique Solana address for a payment.
   * The secret key is persisted — an in-memory keypair means any payment that
   * lands after a restart is permanently unspendable.
   */
  generateSolanaAddress(invoiceId: string): { address: string; publicKey: string } {
    const keypair = Keypair.generate();
    const address = keypair.publicKey.toBase58();

    queries.createWalletKey.run(
      address,
      invoiceId,
      'SOLANA',
      null,
      Buffer.from(keypair.secretKey).toString('base64')
    );

    return { address, publicKey: address };
  }

  /** Recover the Solana keypair for a payment address (used when sweeping). */
  getSolanaKeypair(address: string): Keypair | undefined {
    const row = queries.getWalletKeyByAddress.get(address) as { secret_key: string | null } | undefined;
    if (!row?.secret_key) return undefined;
    return Keypair.fromSecretKey(Buffer.from(row.secret_key, 'base64'));
  }

  /** Recover the EVM signer for a payment address (used when sweeping). */
  getEVMWallet(address: string): ethers.HDNodeWallet | undefined {
    const row = queries.getWalletKeyByAddress.get(address) as
      | { derivation_index: number | null }
      | undefined;
    if (!this.root || row?.derivation_index == null) return undefined;
    return this.root.derivePath(`44'/60'/0'/0/${row.derivation_index}`);
  }

  /** Derive a wallet directly by index. */
  getWalletByIndex(index: number): ethers.HDNodeWallet {
    if (!this.root) {
      throw new Error('HD Node not initialized');
    }
    return this.root.derivePath(`44'/60'/0'/0/${index}`);
  }

  getCurrentIndex(): number {
    const row = queries.getCounter.get(EVM_INDEX_COUNTER) as { value: number } | undefined;
    return row?.value ?? 0;
  }
}

export const walletService = new WalletService();
