/**
 * Platform fee structure.
 *
 * One module owns every fee so the checkout quote, the settlement sweep, the
 * merchant's payout and the dashboard can never disagree about what was
 * charged. Rates are basis points (100 bps = 1%).
 */

export type FeeContext = 'merchant' | 'p2p' | 'escrow';

export interface FeeSchedule {
  /** Percentage cut, in basis points. */
  bps: number;
  /** Flat amount in the invoice's fiat currency, applied on top of bps. */
  flat: number;
  /** Fee is never less than this, in fiat. */
  min: number;
  /** Fee is capped here, in fiat. 0 means uncapped. */
  max: number;
  /** Who pays: the receiver absorbs it, or the payer is charged on top. */
  paidBy: 'receiver' | 'payer';
}

const num = (key: string, fallback: number) => {
  const raw = process.env[key];
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Defaults are deliberately modest and env-overridable so pricing can change
 * without a deploy. Escrow costs more than a plain payment because it carries
 * contract interaction, a longer custody window and dispute handling.
 */
export const FEE_SCHEDULES: Record<FeeContext, FeeSchedule> = {
  // Merchant accepting a payment through a payment link.
  merchant: {
    bps: num('FEE_MERCHANT_BPS', 100), // 1.00%
    flat: num('FEE_MERCHANT_FLAT', 0),
    min: num('FEE_MERCHANT_MIN', 0),
    max: num('FEE_MERCHANT_MAX', 0),
    paidBy: (process.env.FEE_MERCHANT_PAID_BY as FeeSchedule['paidBy']) || 'receiver',
  },
  // One person paying another directly.
  p2p: {
    bps: num('FEE_P2P_BPS', 50), // 0.50%
    flat: num('FEE_P2P_FLAT', 0),
    min: num('FEE_P2P_MIN', 0),
    max: num('FEE_P2P_MAX', 0),
    paidBy: (process.env.FEE_P2P_PAID_BY as FeeSchedule['paidBy']) || 'payer',
  },
  // Escrow deal: charged once, on release.
  escrow: {
    bps: num('FEE_ESCROW_BPS', 150), // 1.50%
    flat: num('FEE_ESCROW_FLAT', 0),
    min: num('FEE_ESCROW_MIN', 1),
    max: num('FEE_ESCROW_MAX', 0),
    paidBy: (process.env.FEE_ESCROW_PAID_BY as FeeSchedule['paidBy']) || 'receiver',
  },
};

export interface FeeBreakdown {
  context: FeeContext;
  /** What the goods or service cost, in fiat. */
  subtotal: number;
  /** Platform fee, in fiat. */
  fee: number;
  /** What the payer sends, in fiat. */
  total: number;
  /** What the receiver keeps, in fiat. */
  netToReceiver: number;
  paidBy: FeeSchedule['paidBy'];
  bps: number;
}

/** Round to 2dp without accumulating binary float error. */
const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Compute the fee for an amount in fiat.
 *
 * `paidBy: 'payer'` adds the fee on top of the price, so the receiver still
 * gets the full amount. `paidBy: 'receiver'` deducts it, so the payer is
 * charged exactly the listed price.
 */
export function computeFee(
  subtotal: number,
  context: FeeContext,
  override?: Partial<FeeSchedule>
): FeeBreakdown {
  const schedule = { ...FEE_SCHEDULES[context], ...override };

  let fee = (subtotal * schedule.bps) / 10_000 + schedule.flat;
  if (schedule.min > 0) fee = Math.max(fee, schedule.min);
  if (schedule.max > 0) fee = Math.min(fee, schedule.max);

  // Never let the fee exceed the payment itself.
  fee = money(Math.min(fee, subtotal));

  const payerPays = schedule.paidBy === 'payer';

  return {
    context,
    subtotal: money(subtotal),
    fee,
    total: money(payerPays ? subtotal + fee : subtotal),
    netToReceiver: money(payerPays ? subtotal : subtotal - fee),
    paidBy: schedule.paidBy,
    bps: schedule.bps,
  };
}

/**
 * Round a crypto amount UP to `decimals` places.
 *
 * Always up, never to-nearest: rounding down would quote a payer less than the
 * invoice is worth, and the shortfall would land as an underpayment. The extra
 * is sub-cent dust.
 */
export function ceilCrypto(amount: number, decimals = 8): string {
  const factor = 10 ** decimals;
  // Nudge by an epsilon first so a value that is already exact at this
  // precision isn't pushed up a whole unit by float representation error.
  const ceiled = Math.ceil(amount * factor - 1e-9) / factor;
  return ceiled.toFixed(decimals);
}

/**
 * x402 facilitator fee.
 *
 * An `exact` x402 payment moves tokens payer → payee directly via EIP-3009, so
 * the fee cannot be skimmed from the transfer itself. Instead it accrues
 * against the payee's merchant account per settlement and is collected
 * separately. Amounts here are in the token's atomic units (USDC: 6dp), the
 * same units x402 carries, so no float or fiat conversion is involved.
 */
export const X402_FEE = {
  bps: BigInt(Math.max(0, Math.trunc(num('X402_FEE_BPS', 100)))), // 1.00%
  /** Floor per settlement, atomic units — covers the gas GuardPay pays. */
  min: BigInt(Math.max(0, Math.trunc(num('X402_FEE_MIN', 0)))),
  /**
   * Unpaid fees, atomic units, above which settlement stops for that payee
   * until they pay. 0 means no limit.
   */
  creditLimit: BigInt(Math.max(0, Math.trunc(num('X402_FEE_CREDIT_LIMIT', 0)))),
};

/** Fee owed for one settled x402 payment, in atomic units. Never exceeds the amount. */
export function computeX402Fee(amount: string): string {
  let value: bigint;
  try {
    value = BigInt(amount);
  } catch {
    return '0';
  }
  if (value <= 0n) return '0';

  let fee = (value * X402_FEE.bps) / 10_000n;
  if (fee < X402_FEE.min) fee = X402_FEE.min;
  if (fee > value) fee = value;
  return fee.toString();
}

/** Display precision per asset — 8dp of SOL is noise to a human. */
export const DISPLAY_DECIMALS: Record<string, number> = {
  ETH: 6,
  BNB: 6,
  SOL: 5,
  USDC: 2,
  USDT: 2,
};
