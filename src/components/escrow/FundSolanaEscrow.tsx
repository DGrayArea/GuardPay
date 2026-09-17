'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import BrandedQR from '@/components/checkout/BrandedQR';
import { api, EscrowDetail } from '@/lib/api';

interface Props {
  escrow: EscrowDetail;
  onFunded: () => void;
}

/**
 * Funding panel for a custodial Solana escrow.
 *
 * There is no authorize step here: the buyer sends tokens to a vault address and
 * we confirm by reading the balance. Because GuardPay controls that vault, the
 * trust model genuinely differs from the contract-held EVM path — this component
 * says so plainly rather than reusing the non-custodial reassurance.
 */
const FundSolanaEscrow: React.FC<Props> = ({ escrow, onFunded }) => {
  const [checking, setChecking] = useState(false);
  const [held, setHeld] = useState<string | null>(null);

  const vault = escrow.depositAddress ?? '';

  const check = useCallback(
    async (quiet = false) => {
      setChecking(true);
      try {
        const result = await api.checkEscrowFunding(escrow.id);
        setHeld(result.held);
        if (result.funded) {
          toast.success('Deposit confirmed');
          onFunded();
        } else if (!quiet) {
          toast.info(`Vault holds ${Number(result.held).toFixed(2)} of ${result.expected}`);
        }
      } catch (e: any) {
        if (!quiet) toast.error(e?.response?.data?.error ?? 'Could not read the vault');
      } finally {
        setChecking(false);
      }
    },
    [escrow.id, onFunded]
  );

  // Poll while the panel is open so a deposit lands without the buyer acting.
  useEffect(() => {
    check(true);
    const timer = setInterval(() => check(true), 15000);
    return () => clearInterval(timer);
  }, [check]);

  const copy = () => {
    navigator.clipboard.writeText(vault);
    toast.success('Vault address copied');
  };

  return (
    <div className="space-y-4">
      {/* The custody difference is the first thing shown, not a footnote. */}
      <div className="flex gap-2.5 rounded-lg border border-warn/30 bg-warn-soft p-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
        <p className="text-xs text-ink">
          <span className="font-medium">GuardPay holds this vault.</span> Solana deals are custodial
          — unlike our Base escrows, the funds sit in an address GuardPay controls until you
          release or the seller returns them. The vault is unique to this deal and you can verify
          its balance on-chain.
        </p>
      </div>

      <div className="mx-auto w-full max-w-[13rem] rounded-xl border bg-white p-3">
        <BrandedQR value={vault} label="Escrow vault deposit address" />
      </div>

      <div className="space-y-2">
        <label htmlFor="vault-address" className="block text-sm font-medium text-ink">
          Send {escrow.amount} {escrow.currency} to this vault
        </label>
        <div className="flex gap-2">
          <input
            id="vault-address"
            readOnly
            value={vault}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 truncate rounded-lg border bg-muted px-3 py-2.5 font-mono text-xs text-ink"
          />
          <button
            type="button"
            onClick={copy}
            aria-label="Copy vault address"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-escrow text-white transition hover:bg-escrow/90"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-ink-soft">
          {escrow.currency} on Solana devnet only. Sending a different token will not be credited.
        </p>
      </div>

      {held !== null && (
        <p className="text-sm text-ink-soft">
          Vault balance:{' '}
          <span className="font-mono text-ink">
            {Number(held).toFixed(2)} {escrow.currency}
          </span>{' '}
          of {escrow.amount}
        </p>
      )}

      <Button variant="outline" onClick={() => check(false)} disabled={checking} className="w-full">
        {checking ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        Check for deposit
      </Button>
    </div>
  );
};

export default FundSolanaEscrow;
