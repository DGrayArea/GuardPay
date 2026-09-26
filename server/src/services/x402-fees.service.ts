import type { PaymentRequirements } from '@x402/core/types';
import { queries } from '../config/database';
import { x402Service } from './x402.service';

export interface X402FeeBalance {
  network: string;
  /** Lowercased token address. */
  asset: string;
  /** Atomic units, as decimal strings. */
  accrued: string;
  paid: string;
  owed: string;
}

/**
 * What a merchant owes in x402 facilitator fees, per network and asset.
 * Payments still settling count as paid, so two concurrent pay-downs can't
 * both be accepted against the same balance.
 */
export function x402FeeLedger(merchantId: string): X402FeeBalance[] {
  const accrued = queries.getX402FeesAccrued.all(merchantId) as any[];
  const paid = queries.getX402FeesPaid.all(merchantId) as any[];

  const byKey = new Map<string, X402FeeBalance>();
  const row = (network: string, asset: string) => {
    const key = `${network}:${asset}`;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { network, asset, accrued: '0', paid: '0', owed: '0' };
      byKey.set(key, entry);
    }
    return entry;
  };

  for (const a of accrued) row(a.network, a.asset).accrued = BigInt(a.accrued).toString();
  for (const p of paid) row(p.network, p.asset).paid = BigInt(p.paid).toString();

  for (const entry of byKey.values()) {
    const owed = BigInt(entry.accrued) - BigInt(entry.paid);
    entry.owed = (owed > 0n ? owed : 0n).toString();
  }
  return [...byKey.values()];
}

/** Terms for paying `amount` of fees on one network/asset to the platform fee address. */
export async function feeRequirements(
  network: string,
  asset: string,
  amount: string
): Promise<PaymentRequirements> {
  const payTo = process.env.PLATFORM_FEE_ADDRESS;
  if (!payTo) throw new Error('PLATFORM_FEE_ADDRESS is not set, so fees cannot be collected');

  const extra = await x402Service.tokenDomain(network, asset);
  return {
    scheme: 'exact',
    network: network as PaymentRequirements['network'],
    asset,
    amount,
    payTo,
    maxTimeoutSeconds: 600,
    extra,
  };
}
