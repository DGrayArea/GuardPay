'use client';

import React, { useEffect, useState } from 'react';
import { Users, CreditCard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Chip from '@/components/ui/Chip';
import Link from 'next/link';
import { api, Stats, Transaction } from '@/lib/api';
import RevenueChart from '@/components/dashboard/charts/RevenueChart';
import ChainVolumeChart from '@/components/dashboard/charts/ChainVolumeChart';

const DashboardHome: React.FC = () => {
  const [stats, setStats] = useState<Stats>({
    totalVolume: 0,
    grossVolume: 0,
    feesPaid: 0,
    totalTransactions: 0,
    totalTx: 0,
    pendingInvoices: 0,
    activeEscrows: 0,
    recentTransactions: [],
  });
  const [recentTx, setRecentTx] = useState<Transaction[]>([]);
  const [allTx, setAllTx] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        const s = await api.getStats();
        const tx = await api.getTransactions();
        setStats(s);
        setAllTx(tx);
        setRecentTx(tx.slice(0, 5));
        setLoading(false);
    };
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Dashboard</h1>
        <div className="flex items-center space-x-4">
          <Chip variant="primary" size="sm">Premium Merchant</Chip>
          <Button variant="outline" size="sm">Create Invoice</Button>
          <Button size="sm">New Payment</Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <div className="text-xl font-bold tracking-tight text-ink sm:text-2xl">${stats.totalVolume.toFixed(2)}</div>
            )}
            <div className="mt-1 text-xs text-ink-soft">
              {stats.feesPaid > 0
                ? `Net of $${stats.feesPaid.toFixed(2)} in fees`
                : 'Net of platform fees'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <div className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{stats.totalTx}</div>
            )}
            <div className="mt-1 text-xs text-ink-soft">Lifetime</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Escrows
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <div className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{stats.activeEscrows}</div>
            )}
            <div className="mt-1 text-xs text-ink-soft">Pending action</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Awaiting payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <div className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{stats.pendingInvoices}</div>
            )}
            <div className="mt-1 flex items-center text-xs text-ink-soft">
              <span>Open invoices</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity and Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Transaction volume over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-72 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
              </div>
            ) : (
              <RevenueChart transactions={allTx} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest transaction activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? <div className="text-center py-4"><Loader2 className="animate-spin mx-auto" /></div> : recentTx.map((tx) => (
                <div key={tx.id} className="flex items-start justify-between gap-3 border-b pb-4 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    {/* Prefer the product name; fall back to the payer address.
                        Not every chain exposes a sender we can attribute. */}
                    <div className="truncate font-medium text-ink">{tx.linkTitle || 'Payment'}</div>
                    <div className="truncate text-sm text-ink-soft">
                      {/* Short month/day — the full locale date does not fit
                          this column and truncating a date is unreadable. */}
                      {new Date(tx.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                      {tx.customer && (
                        <span className="ml-2 font-mono text-xs">
                          {tx.customer.slice(0, 6)}…
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-medium tabular-nums text-ink">
                      {Number(tx.amount).toFixed(2)}
                      <span className="ml-1 text-xs font-normal text-ink-soft">{tx.currency}</span>
                    </div>
                    <div className={`text-xs ${
                      tx.status === 'completed' ? 'text-ok' :
                      tx.status === 'failed' ? 'text-destructive' : 'text-warn'
                    }`}>
                      {tx.status}
                    </div>
                  </div>
                </div>
              ))}
              <Link href="/dashboard/payments">
                <Button variant="link" className="p-0 h-auto w-full justify-start mt-4">
                  View all transactions
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Volume by chain */}
      <Card>
        <CardHeader>
          <CardTitle>Volume by chain</CardTitle>
          <CardDescription>Completed payments, all time</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
            </div>
          ) : (
            <ChainVolumeChart transactions={allTx} />
          )}
        </CardContent>
      </Card>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="mr-2 h-5 w-5" />
              Payment Links
            </CardTitle>
            <CardDescription>
              Create shareable payment links
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/links">
                <Button variant="outline" className="w-full">
                Manage Links
                </Button>
            </Link>
          </CardContent>
        </Card>
        {/* ... keeping other cards static for now as they are less prio ... */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              Settings
            </CardTitle>
            <CardDescription>
              Configure wallet & preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/settings">
                <Button variant="outline" className="w-full">
                Go to Settings
                </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardHome;
