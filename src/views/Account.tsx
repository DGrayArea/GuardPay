'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Receipt,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, Account as AccountType, BuyerPayment } from '@/lib/api';
import { useAuth } from '@/components/providers/AuthProvider';
import { Logo } from '@/components/brand/Logo';

const short = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—');

const STATUS_STYLE: Record<string, string> = {
  paid: 'text-ok',
  confirming: 'text-warn',
  underpaid: 'text-warn',
  expired: 'text-ink-soft',
};

const Account: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [account, setAccount] = useState<AccountType | null>(null);
  const [payments, setPayments] = useState<BuyerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  const load = useCallback(async () => {
    try {
      const [acct, paid] = await Promise.all([api.getAccount(), api.getMyPayments()]);
      setAccount(acct);
      setPayments(paid);
      setDisplayName(acct.displayName ?? '');
      setEmail(acct.email ?? '');
    } catch {
      toast.error('Could not load your account');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) load();
    else if (!authLoading) setLoading(false);
  }, [authLoading, isAuthenticated, load]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateAccount({ displayName, email });
      setAccount((a) => (a ? { ...a, ...updated } : a));
      toast.success('Profile saved');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'Could not save your profile');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Loader2 className="h-6 w-6 animate-spin text-ink-soft" />
      </div>
    );
  }

  if (!isAuthenticated || !account) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft">
              <UserRound className="h-7 w-7 text-brand" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-ink">Your account</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Connect your wallet to see what you&apos;ve paid for and the deals you&apos;re part of.
            </p>
            <Link href="/login">
              <Button className="mt-6 h-11 w-full">Connect wallet</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tiles = [
    { label: 'Payments made', value: account.stats.paymentsMade },
    {
      label: 'Total spent',
      value: `$${account.stats.totalSpent.toFixed(2)}`,
    },
    { label: 'Open escrows', value: account.stats.openEscrows },
    { label: 'Merchants paid', value: account.stats.merchantsPaid },
  ];

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/">
            <Logo />
          </Link>
          {/* The seller dashboard is a different surface; only offer it to sellers. */}
          {account.isSeller && (
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <Store size={15} className="mr-2" /> Merchant dashboard
              </Button>
            </Link>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            {account.displayName || 'Your account'}
          </h1>
          <p className="mt-1 font-mono text-sm text-ink-soft">{account.walletAddress}</p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tiles.map((t) => (
            <Card key={t.label}>
              <CardContent className="p-4">
                <p className="text-xs text-ink-soft">{t.label}</p>
                <p className="mt-1 text-xl font-bold tracking-tight text-ink sm:text-2xl">
                  {t.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="payments">
          <TabsList className="mb-4 w-full sm:w-auto">
            <TabsTrigger value="payments">Purchases</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Purchases</CardTitle>
                <CardDescription>Everything you&apos;ve paid for through GuardPay</CardDescription>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft">
                      <Receipt className="h-6 w-6 text-brand" />
                    </div>
                    <p className="font-medium text-ink">No purchases yet</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
                      Payments you make through a GuardPay link appear here automatically — there is
                      nothing to sign up for.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {payments.map((p) => (
                      <li
                        key={`${p.invoiceId}-${p.txHash}`}
                        className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{p.title}</p>
                          <p className="truncate text-sm text-ink-soft">
                            {p.merchantName} ·{' '}
                            {new Date(p.paidAt ?? p.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="shrink-0 sm:text-right">
                          <p className="font-medium tabular-nums text-ink">
                            {p.amount.toFixed(2)}{' '}
                            <span className="text-xs font-normal text-ink-soft">{p.currency}</span>
                          </p>
                          <p className="text-xs">
                            <span className={STATUS_STYLE[p.status] ?? 'text-ink-soft'}>
                              {p.status}
                            </span>
                            {p.explorerUrl && (
                              <a
                                href={p.explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 inline-flex items-center gap-1 text-brand hover:underline"
                              >
                                receipt <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-escrow" />
                  <div>
                    <p className="font-medium text-ink">Buying something that needs trust?</p>
                    <p className="text-sm text-ink-soft">
                      Open an escrow and the funds stay locked until you&apos;re satisfied.
                    </p>
                  </div>
                </div>
                <Link href="/escrow" className="shrink-0">
                  <Button className="w-full bg-escrow text-white hover:bg-escrow/90 sm:w-auto">
                    Go to escrow
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>
                  A name helps counterparties recognise you in an escrow instead of reading a hex
                  address.
                </CardDescription>
              </CardHeader>
              <CardContent className="max-w-lg space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="acct-name">Display name</Label>
                  <Input
                    id="acct-name"
                    value={displayName}
                    maxLength={60}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How others see you"
                  />
                  <p className="text-xs text-ink-soft">
                    Shown publicly to anyone you transact with.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="acct-email">Email (optional)</Label>
                  <Input
                    id="acct-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                  <p className="text-xs text-ink-soft">
                    Private — used for receipts only, never shown to counterparties.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Wallet</Label>
                  <p className="break-all rounded-lg bg-muted p-3 font-mono text-xs text-ink">
                    {account.walletAddress}
                  </p>
                </div>

                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save profile
                </Button>
              </CardContent>
            </Card>

            {!account.isSeller && (
              <Card className="mt-6">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-3">
                    <Store className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                    <div>
                      <p className="font-medium text-ink">Want to get paid too?</p>
                      <p className="text-sm text-ink-soft">
                        Create a payment link and the merchant dashboard opens up. Same wallet, no
                        separate account.
                      </p>
                    </div>
                  </div>
                  <Link href="/dashboard/links" className="shrink-0">
                    <Button variant="outline" className="w-full sm:w-auto">
                      Start selling
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-8">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={15} className="mr-2" /> Back to GuardPay
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Account;
