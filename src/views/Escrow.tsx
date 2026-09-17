'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldCheck,
  Clock,
  Check,
  AlertTriangle,
  RotateCcw,
  Loader2,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Chip from '@/components/ui/Chip';
import { toast } from 'sonner';
import { api, Escrow as EscrowType, EscrowDetail, EscrowStatus } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import FundEscrow from '@/components/escrow/FundEscrow';
import FundSolanaEscrow from '@/components/escrow/FundSolanaEscrow';
import CreateEscrowDialog from '@/components/escrow/CreateEscrowDialog';
import { cn } from '@/lib/utils';

const STATUS: Record<EscrowStatus, { label: string; className: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', className: 'bg-muted text-ink-soft', icon: <Clock className="h-3.5 w-3.5" /> },
  pending_funding: {
    label: 'Awaiting funding',
    className: 'bg-warn-soft text-warn',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  funded: {
    label: 'In escrow',
    className: 'bg-escrow-soft text-escrow',
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
  },
  active: {
    label: 'In escrow',
    className: 'bg-escrow-soft text-escrow',
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
  },
  disputed: {
    label: 'Disputed',
    className: 'bg-warn-soft text-warn',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  released: {
    label: 'Released',
    className: 'bg-ok-soft text-ok',
    icon: <Check className="h-3.5 w-3.5" />,
  },
  refunded: {
    label: 'Refunded',
    className: 'bg-muted text-ink-soft',
    icon: <RotateCcw className="h-3.5 w-3.5" />,
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-muted text-ink-soft',
    icon: <RotateCcw className="h-3.5 w-3.5" />,
  },
};

const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');
/** Transaction links must follow the deal's own chain, not always Base. */
const explorerTx = (hash: string, custodial: boolean) =>
  custodial
    ? `https://explorer.solana.com/tx/${hash}?cluster=devnet`
    : `https://sepolia.basescan.org/tx/${hash}`;

const StatusChip: React.FC<{ status: EscrowStatus }> = ({ status }) => {
  const s = STATUS[status] ?? STATUS.draft;
  return (
    <Chip size="sm" className={cn('gap-1', s.className)}>
      {s.icon}
      <span>{s.label}</span>
    </Chip>
  );
};

/**
 * States who is actually holding the money for THIS deal.
 *
 * The two escrow paths have genuinely different trust models, so they get
 * genuinely different copy — reusing the non-custodial reassurance on a
 * custodial deal would misrepresent who can move the funds.
 */
const CustodyPanel: React.FC<{ escrow: EscrowDetail }> = ({ escrow }) => {
  const custodial = escrow.custody === 'custodial';

  const held = escrow.onchain
    ? (Number(escrow.onchain.capturableAmount) / 1e6).toFixed(2)
    : null;

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base">{custodial ? 'Custody' : 'On-chain'}</CardTitle>
        <CardDescription>
          {custodial
            ? 'Held by GuardPay in a vault for this deal'
            : 'Held by an audited contract, not by GuardPay'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 text-sm">
        <div>
          <h3 className="mb-1 text-ink-soft">{custodial ? 'Vault address' : 'Escrow contract'}</h3>
          <p className="break-all rounded bg-muted p-2 font-mono text-xs text-ink">
            {custodial ? escrow.depositAddress : escrow.contractAddress}
          </p>
          <a
            href={
              custodial
                ? `https://explorer.solana.com/address/${escrow.depositAddress}?cluster=devnet`
                : `https://sepolia.basescan.org/address/${escrow.contractAddress}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-escrow hover:underline"
          >
            {custodial ? 'View on Solana Explorer' : 'View on Basescan'}{' '}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {held !== null && (
          <div>
            <h3 className="mb-1 text-ink-soft">Held in escrow</h3>
            <p className="font-mono text-ink">
              {held} {escrow.currency}
            </p>
          </div>
        )}

        <ul className="space-y-2 border-t pt-4 text-xs text-ink-soft">
          {custodial ? (
            <>
              <li className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
                <span>
                  <span className="font-medium text-ink">GuardPay controls this vault.</span> Solana
                  deals are custodial, so you are trusting GuardPay to honour the release.
                </span>
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
                A fresh vault per deal — nothing is pooled with other users&apos; funds
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
                The balance is publicly verifiable on Solana Explorer
              </li>
            </>
          ) : (
            <>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
                Base Commerce Payments Protocol, audited by Spearbit and Coinbase
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
                GuardPay operates the deal but never holds the funds
              </li>
              <li className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
                The buyer can reclaim directly if the deal is left unsettled
              </li>
            </>
          )}
        </ul>
      </CardContent>
    </Card>
  );
};

const Escrow: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [deals, setDeals] = useState<EscrowType[]>([]);
  const [selected, setSelected] = useState<EscrowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  /** address → display name, so counterparties read as people not hex. */
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const rows = await api.getEscrows();
      setDeals(rows);

      // One batched lookup rather than a request per row.
      const addresses = [...new Set(rows.flatMap((d) => [d.buyerAddress, d.sellerAddress]))];
      if (addresses.length > 0) {
        const found = await api.lookupProfiles(addresses).catch(() => ({}));
        setNames(
          Object.fromEntries(
            Object.entries(found)
              .filter(([, v]) => v.displayName)
              .map(([addr, v]) => [addr.toLowerCase(), v.displayName as string])
          )
        );
      }
    } catch {
      toast.error('Could not load your escrows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) load();
    else if (!authLoading) setLoading(false);
  }, [authLoading, isAuthenticated, load]);

  const open = async (id: string) => {
    try {
      setSelected(await api.getEscrow(id));
    } catch {
      toast.error('Could not open that escrow');
    }
  };

  const act = async (fn: () => Promise<unknown>, success: string) => {
    setActing(true);
    try {
      await fn();
      toast.success(success);
      await load();
      if (selected) setSelected(await api.getEscrow(selected.id));
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'That action did not go through');
    } finally {
      setActing(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-escrow-soft">
              <ShieldCheck className="h-7 w-7 text-escrow" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-ink">Escrow</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Connect your wallet to open a deal or review one you are party to.
            </p>
            <Link href="/login">
              <Button className="mt-6 h-11 w-full">Connect wallet</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------------------------------------------------------------- detail --
  if (selected) {
    const isBuyer = selected.viewerRole === 'buyer';
    const s = selected.status;

    return (
      <div className="min-h-screen bg-muted/40">
        <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-4">
            <ArrowLeft size={16} className="mr-2" /> All escrows
          </Button>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-xl tracking-tight">{selected.title}</CardTitle>
                    <CardDescription className="font-mono text-xs">{selected.id}</CardDescription>
                  </div>
                  <StatusChip status={s} />
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="mb-1 text-sm text-ink-soft">Amount</h3>
                    <p className="text-2xl font-bold tracking-tight text-ink">
                      {selected.amount}{' '}
                      <span className="text-lg font-semibold text-ink-soft">
                        {selected.currency}
                      </span>
                    </p>
                  </div>
                  <div>
                    <h3 className="mb-1 text-sm text-ink-soft">
                      {isBuyer ? 'Seller' : 'Buyer'}
                    </h3>
                    {(() => {
                      const addr = isBuyer ? selected.sellerAddress : selected.buyerAddress;
                      const name = names[addr.toLowerCase()];
                      return (
                        <>
                          {name && <p className="text-sm font-medium text-ink">{name}</p>}
                          <p className="break-all font-mono text-xs text-ink-soft">{addr}</p>
                        </>
                      );
                    })()}
                    <p className="mt-1 text-xs text-ink-soft">
                      You are the {selected.viewerRole}
                    </p>
                  </div>
                </div>

                {selected.description && (
                  <div>
                    <h3 className="mb-2 text-sm text-ink-soft">Description</h3>
                    <p className="rounded-lg bg-muted p-4 text-sm text-ink">{selected.description}</p>
                  </div>
                )}

                {selected.conditions && (
                  <div>
                    <h3 className="mb-2 text-sm text-ink-soft">Release conditions</h3>
                    <p className="rounded-lg bg-muted p-4 text-sm text-ink">{selected.conditions}</p>
                  </div>
                )}

                {/* Funding is the buyer's job and only before the money moves. */}
                {isBuyer && ['draft', 'pending_funding'].includes(s) && (
                  <div className="rounded-lg border border-escrow/25 bg-escrow-soft p-4">
                    <h3 className="mb-3 text-sm font-medium text-ink">Fund this escrow</h3>
                    {selected.custody === 'custodial' ? (
                      <FundSolanaEscrow escrow={selected} onFunded={() => open(selected.id)} />
                    ) : (
                      <FundEscrow escrowId={selected.id} onFunded={() => open(selected.id)} />
                    )}
                  </div>
                )}

                <div className="border-t pt-6">
                  <h3 className="mb-3 text-sm text-ink-soft">Timeline</h3>
                  <ol className="space-y-4">
                    {selected.events.map((e) => (
                      <li key={e.id} className="flex gap-3">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-escrow" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium capitalize text-ink">{e.type}</p>
                          {e.note && <p className="text-sm text-ink-soft">{e.note}</p>}
                          <p className="text-xs text-ink-soft">
                            {new Date(e.created_at).toLocaleString()}
                            {e.actor && <span className="ml-2 font-mono">{short(e.actor)}</span>}
                          </p>
                          {e.tx_hash && (
                            <a
                              href={explorerTx(e.tx_hash, selected.custody === 'custodial')}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-escrow hover:underline"
                            >
                              {short(e.tx_hash)} <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:justify-end">
                {['funded', 'active', 'disputed'].includes(s) && isBuyer && (
                  <Button
                    onClick={() => act(() => api.releaseEscrow(selected.id), 'Funds released to the seller')}
                    disabled={acting}
                    className="w-full sm:w-auto"
                  >
                    {acting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Release funds
                  </Button>
                )}
                {['funded', 'active'].includes(s) && (
                  <Button
                    variant="outline"
                    disabled={acting}
                    onClick={() => act(() => api.disputeEscrow(selected.id), 'Dispute raised')}
                    className="w-full sm:w-auto"
                  >
                    <AlertTriangle size={16} className="mr-2" /> Raise dispute
                  </Button>
                )}
                {(['draft', 'pending_funding'].includes(s) ||
                  (!isBuyer && ['funded', 'disputed'].includes(s))) && (
                  <Button
                    variant="outline"
                    disabled={acting}
                    onClick={() =>
                      act(
                        () => api.cancelEscrow(selected.id),
                        ['draft', 'pending_funding'].includes(s)
                          ? 'Escrow cancelled'
                          : 'Funds returned to the buyer'
                      )
                    }
                    className="w-full sm:w-auto"
                  >
                    {['draft', 'pending_funding'].includes(s) ? 'Cancel' : 'Return funds'}
                  </Button>
                )}
              </CardFooter>
            </Card>

            <CustodyPanel escrow={selected} />
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ list --
  const visible = deals.filter((d) => {
    if (filter === 'open') return ['draft', 'pending_funding', 'funded', 'active', 'disputed'].includes(d.status);
    if (filter === 'closed') return ['released', 'refunded', 'cancelled'].includes(d.status);
    return true;
  });

  return (
    <div className="min-h-screen bg-muted/40">
      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={16} className="mr-2" /> Dashboard
              </Button>
            </Link>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-ink sm:text-2xl">
              <ShieldCheck size={22} className="shrink-0 text-escrow" /> Escrow
            </h1>
          </div>
          <CreateEscrowDialog
            onCreated={load}
            trigger={
              <Button className="w-full bg-escrow text-white hover:bg-escrow/90 sm:w-auto">
                <Plus size={16} className="mr-2" /> New escrow
              </Button>
            }
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Your deals</CardTitle>
                <CardDescription>Escrows where you are the buyer or the seller</CardDescription>
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="open">Open</TabsTrigger>
                  <TabsTrigger value="closed">Closed</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>

          <CardContent>
            {visible.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-escrow-soft">
                  <ShieldCheck className="h-6 w-6 text-escrow" />
                </div>
                <p className="font-medium text-ink">
                  {deals.length === 0 ? 'No escrows yet' : 'Nothing in this view'}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
                  {deals.length === 0
                    ? 'Open a deal and the funds stay locked on-chain until both sides are satisfied.'
                    : 'Try a different filter.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {visible.map((d) => {
                  const iAmBuyer = user?.address?.toLowerCase() === d.buyerAddress.toLowerCase();
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => open(d.id)}
                        className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/60"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-medium text-ink">{d.title}</h3>
                              <StatusChip status={d.status} />
                            </div>
                            <p className="mt-1 text-sm text-ink-soft">
                              {new Date(d.createdAt).toLocaleDateString()} ·{' '}
                              <span className="font-mono text-xs">{d.id}</span>
                            </p>
                          </div>
                          <div className="shrink-0 sm:text-right">
                            <p className="font-medium text-ink">
                              {d.amount} {d.currency}
                            </p>
                            <p className="mt-1 text-sm text-ink-soft">
                              {iAmBuyer ? 'To' : 'From'}{' '}
                              {(() => {
                                const addr = iAmBuyer ? d.sellerAddress : d.buyerAddress;
                                const name = names[addr.toLowerCase()];
                                return name ? (
                                  <span>{name}</span>
                                ) : (
                                  <span className="font-mono text-xs">{short(addr)}</span>
                                );
                              })()}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Escrow;
