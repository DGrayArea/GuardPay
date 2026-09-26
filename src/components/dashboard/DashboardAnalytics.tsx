'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api, Transaction } from '@/lib/api';
import RevenueChart from '@/components/dashboard/charts/RevenueChart';
import ChainVolumeChart from '@/components/dashboard/charts/ChainVolumeChart';

const RANGES = { '7d': 7, '30d': 30, '90d': 90 } as const;
type Range = keyof typeof RANGES;

const money = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

/** Every figure here is computed from the merchant's own completed payments. */
const DashboardAnalytics: React.FC = () => {
  const [range, setRange] = useState<Range>('30d');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .getTransactions()
      .then(setTransactions)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const days = RANGES[range];

  const inRange = useMemo(() => {
    const since = Date.now() - days * 86_400_000;
    return transactions.filter(
      (t) => t.status === 'completed' && new Date(t.timestamp).getTime() >= since
    );
  }, [transactions, days]);

  const summary = useMemo(() => {
    const volume = inRange.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const customers = new Set(inRange.map((t) => t.customer).filter(Boolean)).size;
    return {
      volume,
      count: inRange.length,
      average: inRange.length ? volume / inRange.length : 0,
      customers,
    };
  }, [inRange]);

  const topLinks = useMemo(() => {
    const byTitle = new Map<string, { count: number; volume: number }>();
    for (const t of inRange) {
      const key = t.linkTitle || 'Direct payment';
      const entry = byTitle.get(key) ?? { count: 0, volume: 0 };
      entry.count += 1;
      entry.volume += Number(t.amount || 0);
      byTitle.set(key, entry);
    }
    return [...byTitle.entries()].sort((a, b) => b[1].volume - a[1].volume).slice(0, 5);
  }, [inRange]);

  const cards = [
    { title: 'Volume', value: money(summary.volume) },
    { title: 'Payments', value: summary.count.toLocaleString() },
    { title: 'Average payment', value: money(summary.average) },
    { title: 'Unique customers', value: summary.customers.toLocaleString() },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Analytics</h1>
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList>
            <TabsTrigger value="7d">7 days</TabsTrigger>
            <TabsTrigger value="30d">30 days</TabsTrigger>
            <TabsTrigger value="90d">90 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Couldn't load payments. Check that the API is running.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
              ) : (
                <div className="text-lg font-bold tracking-tight text-ink sm:text-2xl">{c.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment volume</CardTitle>
          <CardDescription>Completed payments per day, last {days} days</CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueChart transactions={transactions} days={days} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Volume by chain</CardTitle>
            <CardDescription>Completed payments, all time</CardDescription>
          </CardHeader>
          <CardContent>
            <ChainVolumeChart transactions={transactions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top payment links</CardTitle>
            <CardDescription>By volume, last {days} days</CardDescription>
          </CardHeader>
          <CardContent>
            {topLinks.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-soft">
                {loading ? 'Loading…' : 'No completed payments in this period yet.'}
              </p>
            ) : (
              <ul className="divide-y">
                {topLinks.map(([title, v]) => (
                  <li key={title} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="min-w-0 truncate text-ink">{title}</span>
                    <span className="shrink-0 text-right">
                      <span className="font-medium text-ink">{money(v.volume)}</span>
                      <span className="ml-2 text-xs text-ink-soft">
                        {v.count} {v.count === 1 ? 'payment' : 'payments'}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardAnalytics;
