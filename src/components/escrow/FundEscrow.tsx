'use client';

import React, { useEffect, useState } from 'react';
import { useAccount, useSwitchChain, useWriteContract, usePublicClient } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { ConnectKitButton } from 'connectkit';
import { Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api, EscrowPaymentInfo } from '@/lib/api';
import { cn } from '@/lib/utils';

const BASE_SEPOLIA = 84532;

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const PAYMENT_INFO_COMPONENTS = [
  { name: 'operator', type: 'address' },
  { name: 'payer', type: 'address' },
  { name: 'receiver', type: 'address' },
  { name: 'token', type: 'address' },
  { name: 'maxAmount', type: 'uint120' },
  { name: 'preApprovalExpiry', type: 'uint48' },
  { name: 'authorizationExpiry', type: 'uint48' },
  { name: 'refundExpiry', type: 'uint48' },
  { name: 'minFeeBps', type: 'uint16' },
  { name: 'maxFeeBps', type: 'uint16' },
  { name: 'feeReceiver', type: 'address' },
  { name: 'salt', type: 'uint256' },
] as const;

const PRE_APPROVAL_ABI = [
  {
    name: 'preApprove',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'paymentInfo', type: 'tuple', components: PAYMENT_INFO_COMPONENTS }],
    outputs: [],
  },
] as const;

type Step = 'approve' | 'preapprove' | 'authorize' | 'done';

/**
 * Funds an escrow deal.
 *
 * Three steps, and only the first two are the buyer's: approve the collector to
 * move the tokens, register the exact payment with preApprove, then ask the
 * operator to pull the funds into escrow. The buyer signs the same struct the
 * operator submits — including the fee ceiling — so nothing about the deal can
 * change between approval and settlement.
 */
const FundEscrow: React.FC<{ escrowId: string; onFunded: () => void }> = ({
  escrowId,
  onFunded,
}) => {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [info, setInfo] = useState<EscrowPaymentInfo | null>(null);
  const [step, setStep] = useState<Step>('approve');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getEscrowPaymentInfo(escrowId)
      .then(setInfo)
      .catch((e) =>
        setError(e?.response?.data?.error ?? 'Could not prepare this escrow for funding')
      );
  }, [escrowId]);

  // Skip the approval step if the allowance already covers it.
  useEffect(() => {
    if (!info || !address || !publicClient) return;
    (async () => {
      try {
        const allowance = (await publicClient.readContract({
          address: info.token.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [address, info.collector as `0x${string}`],
        } as never)) as bigint;
        if (allowance >= BigInt(info.amount)) setStep('preapprove');
      } catch {
        /* Read failure just means we show the approve step. */
      }
    })();
  }, [info, address, publicClient]);

  const tuple = (i: EscrowPaymentInfo['paymentInfo']) => ({
    operator: i.operator as `0x${string}`,
    payer: i.payer as `0x${string}`,
    receiver: i.receiver as `0x${string}`,
    token: i.token as `0x${string}`,
    maxAmount: BigInt(i.maxAmount),
    preApprovalExpiry: i.preApprovalExpiry,
    authorizationExpiry: i.authorizationExpiry,
    refundExpiry: i.refundExpiry,
    minFeeBps: i.minFeeBps,
    maxFeeBps: i.maxFeeBps,
    feeReceiver: i.feeReceiver as `0x${string}`,
    salt: BigInt(i.salt),
  });

  const ensureChain = async () => {
    if (chainId !== BASE_SEPOLIA) await switchChainAsync({ chainId: BASE_SEPOLIA });
  };

  const run = async (fn: () => Promise<void>, failure: string) => {
    setBusy(true);
    setError(null);
    try {
      await ensureChain();
      await fn();
    } catch (e: any) {
      const rejected = /reject|denied/i.test(e?.message ?? '');
      const message = rejected ? 'You rejected the transaction' : e?.shortMessage || failure;
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const doApprove = () =>
    run(async () => {
      if (!info) return;
      const hash = await writeContractAsync({
        address: info.token.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [info.collector as `0x${string}`, BigInt(info.amount)],
        account: address as `0x${string}`,
        chain: baseSepolia,
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      toast.success(`${info.token.symbol} approved`);
      setStep('preapprove');
    }, 'Approval failed');

  const doPreApprove = () =>
    run(async () => {
      if (!info) return;
      const hash = await writeContractAsync({
        address: info.collector as `0x${string}`,
        abi: PRE_APPROVAL_ABI,
        functionName: 'preApprove',
        args: [tuple(info.paymentInfo)],
        account: address as `0x${string}`,
        chain: baseSepolia,
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      toast.success('Payment pre-approved');
      setStep('authorize');
    }, 'Pre-approval failed');

  const doAuthorize = () =>
    run(async () => {
      await api.authorizeEscrow(escrowId);
      toast.success('Funds locked in escrow');
      setStep('done');
      onFunded();
    }, 'Could not move the funds into escrow');

  if (error && !info) {
    return <p className="rounded-lg border border-warn/30 bg-warn-soft p-3 text-sm text-ink">{error}</p>;
  }

  if (!info) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" /> Preparing escrow…
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-ink-soft">Connect the buyer wallet to fund this escrow.</p>
        <div className="flex justify-center">
          <ConnectKitButton />
        </div>
      </div>
    );
  }

  if (address && address.toLowerCase() !== info.paymentInfo.payer.toLowerCase()) {
    return (
      <p className="rounded-lg border border-warn/30 bg-warn-soft p-3 text-sm text-ink">
        This escrow is funded by{' '}
        <span className="font-mono">{info.paymentInfo.payer.slice(0, 10)}…</span>, but you are
        connected as <span className="font-mono">{address.slice(0, 10)}…</span>. Switch accounts to
        continue.
      </p>
    );
  }

  const steps: { key: Step; label: string; action: () => void; hint: string }[] = [
    {
      key: 'approve',
      label: `Approve ${info.token.symbol}`,
      action: doApprove,
      hint: 'Lets the escrow collector move exactly this amount.',
    },
    {
      key: 'preapprove',
      label: 'Pre-approve the deal',
      action: doPreApprove,
      hint: 'Registers these exact terms — amount, seller, and fee cap — on-chain.',
    },
    {
      key: 'authorize',
      label: 'Lock funds in escrow',
      action: doAuthorize,
      hint: 'Moves the funds into the escrow contract. Neither side can spend them.',
    },
  ];

  const activeIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {steps.map((s, i) => {
          const done = step === 'done' || i < activeIndex;
          const active = i === activeIndex;
          return (
            <li key={s.key} className="flex items-start gap-3">
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  done
                    ? 'border-ok bg-ok text-white'
                    : active
                      ? 'border-escrow bg-escrow text-white'
                      : 'border-border text-ink-soft'
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', active ? 'text-ink' : 'text-ink-soft')}>
                  {s.label}
                </p>
                {active && <p className="mt-0.5 text-xs text-ink-soft">{s.hint}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {step !== 'done' && (
        <Button
          onClick={steps[activeIndex].action}
          disabled={busy}
          className="h-11 w-full bg-escrow text-white hover:bg-escrow/90"
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {chainId !== BASE_SEPOLIA ? 'Switch to Base Sepolia' : steps[activeIndex].label}
        </Button>
      )}
    </div>
  );
};

export default FundEscrow;
