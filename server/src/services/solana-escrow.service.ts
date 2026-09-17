import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { queries } from '../config/database';
import { walletService } from './wallet.service';
import { computeFee } from './fee.service';

/**
 * Solana escrow — CUSTODIAL.
 *
 * Unlike the EVM side (which uses Base's audited AuthCaptureEscrow and never
 * takes custody), Solana has no equivalent protocol wired up here, so funds sit
 * in a GuardPay-controlled vault between funding and release. That is a real
 * difference in trust model and every surface that shows a Solana escrow must
 * say so — see `custody: 'custodial'` on the row.
 *
 * Mitigations that are actually in place:
 *  - one fresh vault keypair per deal, so deals are isolated from each other
 *    and the buyer can verify the exact balance on-chain;
 *  - the vault key is never reused for anything else;
 *  - release and refund are the only two paths that move funds, and each is
 *    authorised against the deal's parties.
 *
 * Denominated in USDC rather than SOL: an escrow that sits for thirty days
 * should not also be a currency bet.
 */

/** Circle's devnet USDC mint; overridable for mainnet. */
const DEFAULT_DEVNET_USDC = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export interface SolanaEscrowToken {
  mint: string;
  symbol: string;
  decimals: number;
}

class SolanaEscrowService {
  private connection: Connection | null = null;

  constructor() {
    const rpc = process.env.SOLANA_RPC_URL;
    if (rpc) this.connection = new Connection(rpc, 'confirmed');
  }

  get isConfigured() {
    return Boolean(this.connection);
  }

  get token(): SolanaEscrowToken {
    return {
      mint: process.env.SOLANA_ESCROW_MINT || DEFAULT_DEVNET_USDC,
      symbol: process.env.SOLANA_ESCROW_SYMBOL || 'USDC',
      decimals: Number(process.env.SOLANA_ESCROW_DECIMALS || 6),
    };
  }

  private conn() {
    if (!this.connection) throw new Error('Solana RPC is not configured');
    return this.connection;
  }

  /**
   * Mint a dedicated vault for a deal. The secret key is persisted immediately —
   * an in-memory keypair would strand every deposit on a restart.
   */
  createVault(escrowId: string): string {
    const { address } = walletService.generateSolanaAddress(`escrow:${escrowId}`);
    return address;
  }

  private vaultKeypair(address: string): Keypair {
    const kp = walletService.getSolanaKeypair(address);
    if (!kp) throw new Error(`No key material for escrow vault ${address}`);
    return kp;
  }

  /** Token balance held in the vault, in base units. */
  async getVaultBalance(vaultAddress: string): Promise<bigint> {
    const mint = new PublicKey(this.token.mint);
    const ata = getAssociatedTokenAddressSync(mint, new PublicKey(vaultAddress), true);

    try {
      const account = await getAccount(this.conn(), ata);
      return account.amount;
    } catch {
      // No token account yet means nothing has been sent.
      return 0n;
    }
  }

  /** Lamports held for rent and fees. */
  async getVaultLamports(vaultAddress: string): Promise<number> {
    return this.conn().getBalance(new PublicKey(vaultAddress));
  }

  /**
   * Move the escrowed tokens out of the vault.
   *
   * `feeBaseUnits` is split off to the platform treasury in the same
   * transaction, so a release either pays both parties or neither — there is no
   * window where the seller is paid but the fee is lost, or vice versa.
   */
  private async payOut(
    vaultAddress: string,
    destination: string,
    amount: bigint,
    feeBaseUnits: bigint,
    feeDestination?: string
  ): Promise<string> {
    const connection = this.conn();
    const vault = this.vaultKeypair(vaultAddress);
    const mint = new PublicKey(this.token.mint);

    const vaultAta = getAssociatedTokenAddressSync(mint, vault.publicKey, true);
    const destOwner = new PublicKey(destination);
    const destAta = getAssociatedTokenAddressSync(mint, destOwner, true);

    const tx = new Transaction();

    // The recipient may never have held this token; create their account first.
    // The vault pays the rent, which is why it needs a small SOL balance.
    if (!(await this.accountExists(destAta))) {
      tx.add(
        createAssociatedTokenAccountInstruction(vault.publicKey, destAta, destOwner, mint)
      );
    }

    tx.add(
      createTransferInstruction(vaultAta, destAta, vault.publicKey, amount, [], TOKEN_PROGRAM_ID)
    );

    if (feeBaseUnits > 0n && feeDestination) {
      const feeOwner = new PublicKey(feeDestination);
      const feeAta = getAssociatedTokenAddressSync(mint, feeOwner, true);

      if (!(await this.accountExists(feeAta))) {
        tx.add(
          createAssociatedTokenAccountInstruction(vault.publicKey, feeAta, feeOwner, mint)
        );
      }

      tx.add(
        createTransferInstruction(
          vaultAta,
          feeAta,
          vault.publicKey,
          feeBaseUnits,
          [],
          TOKEN_PROGRAM_ID
        )
      );
    }

    return sendAndConfirmTransaction(connection, tx, [vault], { commitment: 'confirmed' });
  }

  private async accountExists(address: PublicKey): Promise<boolean> {
    return (await this.conn().getAccountInfo(address)) !== null;
  }

  /** Release to the seller, taking the platform's escrow fee. */
  async release(
    vaultAddress: string,
    sellerAddress: string,
    amount: string
  ): Promise<{ signature: string; fee: bigint; net: bigint }> {
    const { decimals } = this.token;
    const total = BigInt(Math.round(Number(amount) * 10 ** decimals));

    const breakdown = computeFee(Number(amount), 'escrow');
    const fee = BigInt(Math.round(breakdown.fee * 10 ** decimals));
    const net = total - fee;

    const held = await this.getVaultBalance(vaultAddress);
    if (held < total) {
      throw new Error(
        `Vault holds ${Number(held) / 10 ** decimals} ${this.token.symbol}, which is less than the ${amount} this deal is for`
      );
    }

    const treasury = process.env.PLATFORM_FEE_SOLANA_ADDRESS;
    const signature = await this.payOut(
      vaultAddress,
      sellerAddress,
      net,
      treasury ? fee : 0n,
      treasury
    );

    if (!treasury && fee > 0n) {
      console.warn(
        `⚠️  Escrow fee of ${breakdown.fee} ${this.token.symbol} left in vault ${vaultAddress} — PLATFORM_FEE_SOLANA_ADDRESS is not set`
      );
    }

    return { signature, fee: treasury ? fee : 0n, net };
  }

  /** Return the full balance to the buyer. No fee is charged on a refund. */
  async refund(vaultAddress: string, buyerAddress: string): Promise<string> {
    const held = await this.getVaultBalance(vaultAddress);
    if (held === 0n) throw new Error('This escrow vault is empty');
    return this.payOut(vaultAddress, buyerAddress, held, 0n);
  }

  /**
   * Recover the vault's leftover rent SOL once the deal is closed.
   * Small, but it is the buyer's money and should not be stranded.
   */
  async sweepRent(vaultAddress: string, destination: string): Promise<string | null> {
    const connection = this.conn();
    const vault = this.vaultKeypair(vaultAddress);
    const balance = await connection.getBalance(vault.publicKey);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const probe = new Transaction({
      feePayer: vault.publicKey,
      blockhash,
      lastValidBlockHeight,
    }).add(
      SystemProgram.transfer({
        fromPubkey: vault.publicKey,
        toPubkey: new PublicKey(destination),
        lamports: 1,
      })
    );
    const networkFee = (await connection.getFeeForMessage(probe.compileMessage())).value ?? 5000;

    const lamports = balance - networkFee;
    if (lamports <= 0) return null;

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: vault.publicKey,
        toPubkey: new PublicKey(destination),
        lamports,
      })
    );
    const signature = await sendAndConfirmTransaction(connection, tx, [vault]);
    queries.markWalletKeySwept.run(vaultAddress);
    return signature;
  }

  /** Human-readable amount from base units. */
  format(baseUnits: bigint): string {
    return (Number(baseUnits) / 10 ** this.token.decimals).toFixed(this.token.decimals);
  }

  /** Rent needed in the vault before it can create token accounts. */
  get minimumVaultLamports(): number {
    return Number(process.env.SOLANA_ESCROW_MIN_RENT || 0.005 * LAMPORTS_PER_SOL);
  }
}

export const solanaEscrowService = new SolanaEscrowService();
