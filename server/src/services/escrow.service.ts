import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import * as bip39 from 'bip39';
import { queries } from '../config/database';
import { computeFee, FEE_SCHEDULES } from './fee.service';
import {
  AUTH_CAPTURE_ESCROW_ABI,
  COMMERCE_PAYMENTS,
  ESCROW_TOKENS,
} from '../config/escrow.contracts';

/**
 * PaymentInfo as the Commerce Payments Protocol defines it. Field order is
 * load-bearing: the contract hashes the struct, so any reordering produces a
 * different payment and the on-chain state lookup silently misses.
 */
export interface PaymentInfo {
  operator: string;
  payer: string;
  receiver: string;
  token: string;
  maxAmount: bigint;
  preApprovalExpiry: number;
  authorizationExpiry: number;
  refundExpiry: number;
  minFeeBps: number;
  maxFeeBps: number;
  feeReceiver: string;
  salt: bigint;
}

const CHAIN_KEY = process.env.ESCROW_CHAIN || 'base-sepolia';

/** Windows, in seconds. preApproval <= authorization <= refund is enforced on-chain. */
const PRE_APPROVAL_WINDOW = Number(process.env.ESCROW_PREAPPROVAL_WINDOW || 60 * 60 * 24 * 3);
const AUTHORIZATION_WINDOW = Number(process.env.ESCROW_AUTH_WINDOW || 60 * 60 * 24 * 30);
const REFUND_WINDOW = Number(process.env.ESCROW_REFUND_WINDOW || 60 * 60 * 24 * 60);

class EscrowService {
  private provider: ethers.JsonRpcProvider | null = null;
  private operator: ethers.Wallet | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const rpc = process.env.BASE_RPC_URL || 'https://sepolia.base.org';
    this.provider = new ethers.JsonRpcProvider(rpc);

    // A dedicated operator key is preferred. Falling back to a distinct
    // derivation path off MASTER_SEED keeps local development working without
    // introducing a second secret — it is deliberately NOT the payment-address
    // path, so operator duties and payment custody never share a key.
    const explicit = process.env.OPERATOR_PRIVATE_KEY;
    const seed = process.env.MASTER_SEED;

    if (explicit) {
      this.operator = new ethers.Wallet(explicit, this.provider);
    } else if (seed && bip39.validateMnemonic(seed)) {
      const root = ethers.HDNodeWallet.fromSeed(bip39.mnemonicToSeedSync(seed));
      const derived = root.derivePath("44'/60'/7'/0/0");
      this.operator = new ethers.Wallet(derived.privateKey, this.provider);
    }

    if (this.operator) {
      console.log(`✅ Escrow operator ready (${this.operator.address} on ${CHAIN_KEY})`);
    } else {
      console.warn('⚠️  No escrow operator key — escrow actions will be unavailable');
    }
  }

  get isConfigured() {
    return Boolean(this.operator && this.provider);
  }

  get operatorAddress() {
    return this.operator?.address ?? null;
  }

  get token() {
    return ESCROW_TOKENS[CHAIN_KEY] ?? ESCROW_TOKENS['base-sepolia'];
  }

  get chainKey() {
    return CHAIN_KEY;
  }

  private contract() {
    if (!this.operator) throw new Error('Escrow operator is not configured');
    return new ethers.Contract(
      COMMERCE_PAYMENTS.authCaptureEscrow,
      AUTH_CAPTURE_ESCROW_ABI as unknown as string[],
      this.operator
    );
  }

  /**
   * Build the PaymentInfo for a deal.
   *
   * The fee bounds are pinned to GuardPay's escrow schedule and written into
   * the struct, so the contract itself caps what the operator may take at
   * capture time — the payer can verify the ceiling before funding.
   */
  buildPaymentInfo(deal: {
    buyerAddress: string;
    sellerAddress: string;
    amount: string;
    salt: string;
    createdAt?: number;
  }): PaymentInfo {
    const token = this.token;
    const now = deal.createdAt ?? Math.floor(Date.now() / 1000);
    const bps = FEE_SCHEDULES.escrow.bps;

    return {
      operator: this.operatorAddress ?? ethers.ZeroAddress,
      payer: ethers.getAddress(deal.buyerAddress),
      receiver: ethers.getAddress(deal.sellerAddress),
      token: ethers.getAddress(token.address),
      maxAmount: ethers.parseUnits(deal.amount, token.decimals),
      preApprovalExpiry: now + PRE_APPROVAL_WINDOW,
      authorizationExpiry: now + AUTHORIZATION_WINDOW,
      refundExpiry: now + REFUND_WINDOW,
      // Equal bounds: the fee is fixed at creation, not negotiable at capture.
      minFeeBps: bps,
      maxFeeBps: bps,
      feeReceiver: ethers.getAddress(
        process.env.PLATFORM_FEE_ADDRESS || this.operatorAddress || ethers.ZeroAddress
      ),
      salt: BigInt(deal.salt),
    };
  }

  /** Serialise for the wire; bigints are not JSON-safe. */
  serialize(info: PaymentInfo) {
    return {
      ...info,
      maxAmount: info.maxAmount.toString(),
      salt: info.salt.toString(),
    };
  }

  deserialize(raw: any): PaymentInfo {
    return { ...raw, maxAmount: BigInt(raw.maxAmount), salt: BigInt(raw.salt) };
  }

  /** Struct ordered as a tuple, which is what ethers encodes against. */
  private tuple(info: PaymentInfo) {
    return [
      info.operator,
      info.payer,
      info.receiver,
      info.token,
      info.maxAmount,
      info.preApprovalExpiry,
      info.authorizationExpiry,
      info.refundExpiry,
      info.minFeeBps,
      info.maxFeeBps,
      info.feeReceiver,
      info.salt,
    ];
  }

  async getHash(info: PaymentInfo): Promise<string> {
    return this.contract().getHash(this.tuple(info));
  }

  async getOnchainState(info: PaymentInfo) {
    const [hasCollectedPayment, capturableAmount, refundableAmount] =
      await this.contract().paymentState(await this.getHash(info));
    return {
      hasCollectedPayment,
      capturableAmount: capturableAmount as bigint,
      refundableAmount: refundableAmount as bigint,
    };
  }

  /**
   * Pull the buyer's pre-approved funds into escrow.
   * Requires the buyer to have already approved the collector and called
   * preApprove — both are wallet actions taken by the buyer, not by us.
   */
  async authorize(info: PaymentInfo, amount: bigint): Promise<string> {
    const tx = await this.contract().authorize(
      this.tuple(info),
      amount,
      COMMERCE_PAYMENTS.collectors.preApproval,
      '0x'
    );
    await tx.wait();
    return tx.hash;
  }

  /** Release escrowed funds to the seller; the contract splits the fee out. */
  async capture(info: PaymentInfo, amount: bigint): Promise<{ hash: string; fee: bigint }> {
    const token = this.token;
    const fiat = Number(ethers.formatUnits(amount, token.decimals));
    const breakdown = computeFee(fiat, 'escrow');
    const feeAmount = ethers.parseUnits(breakdown.fee.toFixed(token.decimals), token.decimals);

    const tx = await this.contract().capture(
      this.tuple(info),
      amount,
      feeAmount,
      info.feeReceiver
    );
    await tx.wait();
    return { hash: tx.hash, fee: feeAmount };
  }

  /** Cancel an authorization and return the funds to the buyer. */
  async void(info: PaymentInfo): Promise<string> {
    const tx = await this.contract().void(this.tuple(info));
    await tx.wait();
    return tx.hash;
  }

  /** Return already-captured funds. Requires the operator to hold the tokens. */
  async refund(info: PaymentInfo, amount: bigint): Promise<string> {
    const tx = await this.contract().refund(
      this.tuple(info),
      amount,
      COMMERCE_PAYMENTS.operatorRefundCollector,
      '0x'
    );
    await tx.wait();
    return tx.hash;
  }

  /** Append to the deal's audit trail. */
  logEvent(escrowId: string, type: string, actor: string | null, note?: string, txHash?: string) {
    queries.createEscrowEvent.run(uuidv4(), escrowId, type, actor, note ?? null, txHash ?? null);
  }
}

export const escrowService = new EscrowService();
