'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAccount, useSignTypedData, useSwitchChain } from 'wagmi';
import { ConnectKitButton } from 'connectkit';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { api, X402FeeBalance } from '@/lib/api';

/** Human amount from atomic units. Every token x402 settles today is a 6dp stablecoin. */
const formatAtomic = (atomic: string, decimals = 6) => {
  const value = BigInt(atomic);
  const unit = 10n ** BigInt(decimals);
  const cents = ((value % unit) * 100n) / unit;
  return `${value / unit}.${cents.toString().padStart(2, '0')}`;
};

const NETWORK_LABELS: Record<string, string> = {
  'eip155:84532': 'Base Sepolia',
  'eip155:8453': 'Base',
};

const randomNonce = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
};

/**
 * Fees the merchant owes GuardPay for settling their x402 payments.
 *
 * Paying is itself an x402 payment: the merchant signs an EIP-3009
 * authorization to the platform fee address and GuardPay settles it, so no
 * gas or approval transaction is needed on their side.
 */
const X402Fees: React.FC = () => {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();

  const [fees, setFees] = useState<X402FeeBalance[]>([]);
  const [collecting, setCollecting] = useState(false);
  const [paying, setPaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getX402FeesOwed();
      setFees(data.fees);
      setCollecting(data.collecting);
    } catch {
      /* No x402 activity is the common case; show nothing. */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pay = async (fee: X402FeeBalance) => {
    const terms = fee.paymentRequirements;
    if (!terms || !address) return;

    const key = `${fee.network}:${fee.asset}`;
    setPaying(key);
    try {
      const targetChain = Number(terms.network.split(':')[1]);
      if (chainId !== targetChain) await switchChainAsync({ chainId: targetChain });

      const authorization = {
        from: address,
        to: terms.payTo as `0x${string}`,
        value: BigInt(terms.amount),
        validAfter: 0n,
        validBefore: BigInt(Math.floor(Date.now() / 1000) + terms.maxTimeoutSeconds),
        nonce: randomNonce(),
      };

      const signature = await signTypedDataAsync({
        account: address,
        domain: {
          name: terms.extra.name,
          version: terms.extra.version,
          chainId: targetChain,
          verifyingContract: terms.asset as `0x${string}`,
        },
        types: {
          TransferWithAuthorization: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' },
          ],
        },
        primaryType: 'TransferWithAuthorization',
        message: authorization,
      });

      const result = await api.payX402Fees({
        x402Version: 2,
        accepted: terms,
        payload: {
          signature,
          authorization: {
            ...authorization,
            value: authorization.value.toString(),
            validAfter: authorization.validAfter.toString(),
            validBefore: authorization.validBefore.toString(),
          },
        },
      });
      toast.success(`Fees paid${result.transaction ? ` (${result.transaction.slice(0, 10)}…)` : ''}`);
      await load();
    } catch (e: any) {
      const rejected = /reject|denied/i.test(e?.message ?? '');
      toast.error(
        rejected
          ? 'You rejected the signature'
          : e?.response?.data?.errorReason ?? e?.response?.data?.error ?? 'Fee payment failed'
      );
    } finally {
      setPaying(null);
    }
  };

  const outstanding = fees.filter((f) => BigInt(f.accrued) > 0n);
  if (outstanding.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>x402 fees</CardTitle>
        <CardDescription>
          What you owe GuardPay for settling your per-request API payments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {outstanding.map((fee) => {
          const key = `${fee.network}:${fee.asset}`;
          const owed = BigInt(fee.owed) > 0n;
          return (
            <div
              key={key}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="text-lg font-semibold text-ink">
                  {formatAtomic(fee.owed)} USDC owed
                </div>
                <div className="text-xs text-ink-soft">
                  {NETWORK_LABELS[fee.network] ?? fee.network} · {formatAtomic(fee.accrued)} accrued,{' '}
                  {formatAtomic(fee.paid)} paid
                </div>
              </div>
              {!owed ? (
                <span className="text-sm text-ink-soft">All paid</span>
              ) : !collecting || !fee.paymentRequirements ? (
                <span className="text-sm text-ink-soft">Collection not enabled yet</span>
              ) : !isConnected ? (
                <ConnectKitButton />
              ) : (
                <Button size="sm" disabled={paying !== null} onClick={() => pay(fee)}>
                  {paying === key && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Pay {formatAtomic(fee.owed)} USDC
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default X402Fees;
