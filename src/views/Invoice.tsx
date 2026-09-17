'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { api, Invoice as InvoiceType } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, AlertTriangle, CheckCircle, Copy, ExternalLink } from 'lucide-react';
import BrandedQR from '@/components/checkout/BrandedQR';
import { toast } from 'sonner';
import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WalletPay from '@/components/checkout/WalletPay';

/** Drops trailing zeros for reading; the copied value keeps full precision. */
const trimAmount = (value: string) =>
  value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;

const Invoice: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceType | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Load invoice
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const data = await api.getInvoice(id);
        if (data) {
          setInvoice(data);
          const expires = new Date(data.expiresAt).getTime();
          const now = new Date().getTime();
          setTimeLeft(Math.max(0, Math.floor((expires - now) / 1000)));
        }
      } catch (error) {
        console.error('Failed to load invoice:', error);
        toast.error('Failed to load invoice');
      }
      setLoading(false);
    };
    load();
  }, [id]);

  // Poll for payment status
  useEffect(() => {
    if (!id || !invoice || invoice.status === 'paid' || invoice.status === 'expired') return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await api.getInvoiceStatus(id);

        if (status.status !== invoice.status || status.receivedAmount !== invoice.receivedAmount) {
          setInvoice((prev) =>
            prev
              ? {
                  ...prev,
                  status: status.status as InvoiceType['status'],
                  receivedAmount: status.receivedAmount,
                  paidAt: status.paidAt,
                }
              : null
          );

          if (status.status === 'paid') {
            toast.success('Payment received!');
          } else if (status.status === 'underpaid') {
            toast.warning('Partial payment received — send the remainder to finish.');
          }
        }
      } catch (error) {
        console.error('Failed to check payment status:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [id, invoice]);

  // Countdown timer
  useEffect(() => {
    if (!invoice || invoice.status === 'paid' || invoice.status === 'expired') return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Do NOT mark it expired here. A payment sent in the final seconds is
          // still credited server-side; only the backend decides expiry.
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [invoice]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const copy = (value: string | undefined, what: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast.success(`${what} copied`);
  };

  const copyAddress = () =>
    copy(
      invoice?.chain === 'SOLANA' ? invoice.solanaAddress : invoice?.paymentAddress,
      'Address'
    );

  /** Copies the exact quoted amount — the full precision, not the trimmed display. */
  const copyAmount = () => copy(invoice?.expectedAmount, 'Amount');

  const getExplorerUrl = (txHash: string, chain: string) => {
    const explorers: { [key: string]: string } = {
      ETH: `https://sepolia.etherscan.io/tx/${txHash}`,
      BSC: `https://testnet.bscscan.com/tx/${txHash}`,
      SOLANA: `https://explorer.solana.com/tx/${txHash}?cluster=devnet`,
    };
    return explorers[chain] || '#';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-border border-b-brand"></div>
          <p className="text-sm text-ink-soft">Loading invoice…</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-warn" />
            <h2 className="mb-2 text-xl font-bold tracking-tight text-ink">Invoice not found</h2>
            <p className="text-sm text-ink-soft">This invoice does not exist or has been removed.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invoice.status === 'expired') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warn-soft">
              <AlertTriangle className="h-8 w-8 text-warn" />
            </div>
            <h2 className="mb-2 text-2xl font-bold tracking-tight text-ink">Invoice expired</h2>
            <p className="mb-6 text-sm text-ink-soft">This payment session timed out. Open the payment link again to start a new one.</p>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="h-12 w-full rounded-xl bg-ink font-medium text-background transition hover:opacity-90"
            >
              Go back
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invoice.status === 'paid') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-ok-soft">
              <CheckCircle className="h-8 w-8 text-ok" />
            </div>
            <h2 className="mb-2 text-2xl font-bold tracking-tight text-ink">Payment received</h2>
            <p className="mb-6 text-sm text-ink-soft">Confirmed on-chain. You can close this page.</p>
            
            {invoice.transactions && invoice.transactions.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-2">Transaction Hash:</p>
                <a
                  href={getExplorerUrl(invoice.transactions[0].txHash, invoice.chain)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 break-all font-mono text-sm text-brand hover:underline"
                >
                  {invoice.transactions[0].txHash.substring(0, 10)}...{invoice.transactions[0].txHash.substring(invoice.transactions[0].txHash.length - 8)}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const paymentAddress = invoice.chain === 'SOLANA' ? invoice.solanaAddress : invoice.paymentAddress;

  return (
    <div className="flex min-h-screen flex-col items-center bg-muted/40 px-4 py-8 sm:py-12">
      <Link href="/" className="mb-6 sm:mb-8">
        <Logo />
      </Link>

      {/* Rate lock */}
      <div
        className={cn(
          'mb-6 flex items-center gap-2.5 rounded-full border px-5 py-2 text-sm shadow-sm transition-colors',
          timeLeft > 0 && timeLeft < 60
            ? 'border-warn/30 bg-warn-soft text-warn'
            : 'border-border bg-background text-ink-soft'
        )}
        role="status"
      >
        <Clock size={15} aria-hidden />
        <span className="font-medium">Rate locked for</span>
        <span className="font-mono font-semibold tabular-nums text-ink">
          {timeLeft > 0 ? formatTime(timeLeft) : 'expiring…'}
        </span>
      </div>

      <Card className="w-full max-w-lg shadow-sm">
        <CardHeader className="border-b pb-6 text-center">
          <CardTitle className="text-base font-medium text-ink-soft">
            {invoice.linkTitle || 'Payment invoice'}
          </CardTitle>
          <button
            type="button"
            onClick={copyAmount}
            title="Copy the exact amount"
            className="group mt-2 inline-flex flex-wrap items-center justify-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <span className="break-all font-mono text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              {trimAmount(invoice.expectedAmount)}
            </span>
            <span className="text-2xl font-semibold text-ink-soft sm:text-3xl">{invoice.crypto}</span>
            <Copy
              className="h-4 w-4 shrink-0 text-ink-soft opacity-60 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
            <span className="sr-only">Copy exact amount</span>
          </button>
          <p className="mt-1 text-sm text-ink-soft">
            ≈ {invoice.amount.toFixed(2)} {invoice.currency}
          </p>

          {/* Only itemise the fee when the PAYER actually bears it. When the
              merchant absorbs it, the payer's total is just the list price and a
              fee line would imply a charge they are not paying. */}
          {invoice.fee && invoice.fee.amount > 0 && invoice.fee.paidBy === 'payer' && (
            <dl className="mx-auto mt-4 w-full max-w-xs space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd className="tabular-nums text-ink">
                  {invoice.fee.subtotal.toFixed(2)} {invoice.currency}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">
                  Network &amp; platform fee ({(invoice.fee.bps / 100).toFixed(2)}%)
                </dt>
                <dd className="tabular-nums text-ink">
                  {invoice.fee.amount.toFixed(2)} {invoice.currency}
                </dd>
              </div>
              <div className="flex justify-between border-t pt-1 font-medium">
                <dt className="text-ink">Total</dt>
                <dd className="tabular-nums text-ink">
                  {invoice.fee.total.toFixed(2)} {invoice.currency}
                </dd>
              </div>
            </dl>
          )}
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <Tabs defaultValue="wallet">
            <TabsList className="grid h-11 w-full grid-cols-2">
              <TabsTrigger value="wallet" className="text-sm">Connect wallet</TabsTrigger>
              <TabsTrigger value="manual" className="text-sm">Send manually</TabsTrigger>
            </TabsList>

            <TabsContent value="wallet" className="pt-6">
              <WalletPay invoice={invoice} />
            </TabsContent>

            <TabsContent value="manual" className="space-y-5 pt-6">
              {/* The QR scales with the viewport instead of overflowing small screens. */}
              <div className="mx-auto w-full max-w-[16rem] rounded-xl border bg-white p-4 sm:p-5">
                <BrandedQR
                  value={paymentAddress || ''}
                  label={`QR code for the ${invoice.chain} payment address`}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="pay-address" className="block text-sm font-medium text-ink">
                    Send exactly{' '}
                    <button
                      type="button"
                      onClick={copyAmount}
                      className="font-mono underline decoration-dotted underline-offset-2 hover:text-brand"
                    >
                      {trimAmount(invoice.expectedAmount)}
                    </button>{' '}
                    {invoice.crypto} on {invoice.chain}
                  </label>
                </div>
                <div className="flex gap-2">
                  <input
                    id="pay-address"
                    type="text"
                    value={paymentAddress || ''}
                    readOnly
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 truncate rounded-lg border bg-muted px-3 py-2.5 font-mono text-xs text-ink sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={copyAddress}
                    aria-label="Copy payment address"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-ink-soft">
                  Single-use address for this invoice. Sending a different amount is fine — we
                  credit what arrives and tell you if anything is outstanding.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Status */}
          <div className={cn('rounded-lg border p-4', invoice.status === 'underpaid' ? 'border-warn/30 bg-warn-soft' : 'border-brand/25 bg-brand-soft')}>
            <div className="flex items-center gap-2">
              <span className={cn('h-2 w-2 shrink-0 animate-pulse rounded-full', invoice.status === 'underpaid' ? 'bg-warn' : 'bg-brand')} />
              <p className="text-sm font-medium text-ink">
                {invoice.status === 'confirming'
                  ? 'Confirming payment…'
                  : invoice.status === 'underpaid'
                    ? 'Partial payment received'
                    : 'Waiting for payment…'}
              </p>
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              {invoice.status === 'underpaid' && invoice.receivedAmount
                ? `Received ${invoice.receivedAmount} of ${invoice.expectedAmount} ${invoice.crypto}. Send the remainder to the same address to complete this payment.`
                : 'Payment will be confirmed automatically once received'}
            </p>
          </div>

          {/* Transactions */}
          {invoice.transactions && invoice.transactions.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Transactions:</label>
              {invoice.transactions.map((tx: any) => (
                <div key={tx.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-mono text-gray-900">
                      {tx.txHash.substring(0, 10)}...{tx.txHash.substring(tx.txHash.length - 8)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {tx.confirmations} confirmations • {tx.status}
                    </p>
                  </div>
                  <a
                    href={getExplorerUrl(tx.txHash, invoice.chain)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-brand hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 break-all px-4 text-center text-xs text-ink-soft">
        Invoice ID: {invoice.id}
      </div>
    </div>
  );
};

export default Invoice;
