'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Chip from '@/components/ui/Chip';
import { api, Transaction } from '@/lib/api';
import X402Fees from './X402Fees';

type Filter = 'all' | 'link' | 'escrow';

const STATUS_STYLES: Record<Transaction['status'], string> = {
  completed: 'bg-green-100 text-green-800',
  confirming: 'bg-blue-100 text-blue-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
};

const short = (value: string | null | undefined) =>
  value ? `${value.slice(0, 6)}…${value.slice(-4)}` : 'Unknown';

/** Spreadsheet-safe CSV cell: quote everything, and neutralise formula prefixes. */
const csvCell = (value: unknown) => {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

function exportCsv(rows: Transaction[]) {
  const header = ['Date', 'Title', 'Amount', 'Currency', 'Crypto amount', 'Crypto', 'Chain', 'Type', 'Status', 'Customer', 'Tx hash'];
  const lines = rows.map((t) =>
    [
      new Date(t.timestamp).toISOString(),
      t.linkTitle,
      t.amount,
      t.currency,
      t.cryptoAmount,
      t.crypto,
      t.chain,
      t.type,
      t.status,
      t.customer,
      t.txHash,
    ]
      .map(csvCell)
      .join(',')
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `guardpay-payments-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const DashboardPayments: React.FC = () => {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (filter === 'escrow' && t.type !== 'escrow') return false;
      if (filter === 'link' && t.type === 'escrow') return false;
      if (!q) return true;
      return [t.linkTitle, t.customer, t.txHash, t.crypto, t.chain]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
    });
  }, [transactions, filter, query]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Payments</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={visible.length === 0} onClick={() => exportCsv(visible)}>
            <Download size={16} className="mr-2" />
            Export CSV
          </Button>
          <Link href="/dashboard/links">
            <Button size="sm">New payment link</Button>
          </Link>
        </div>
      </div>

      <X402Fees />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Transaction history</CardTitle>
          <CardDescription>Every payment received through your links and escrow deals.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, customer or hash"
                aria-label="Search transactions"
                className="w-full rounded-md border p-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="link">Links</TabsTrigger>
                <TabsTrigger value="escrow">Escrow</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-ink-soft" />
                      </TableCell>
                    </TableRow>
                  ) : visible.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-ink-soft">
                        {error
                          ? "Couldn't load payments. Check that the API is running."
                          : transactions.length === 0
                            ? 'No payments yet. Share a payment link to take your first one.'
                            : 'Nothing matches that search.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    visible.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="whitespace-nowrap text-xs text-ink-soft">
                          {new Date(t.timestamp).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm">{t.linkTitle || 'Direct payment'}</TableCell>
                        <TableCell className="font-mono text-xs text-ink-soft">{short(t.customer)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="font-medium">
                            {t.amount} {t.currency}
                          </div>
                          <div className="text-xs text-ink-soft">
                            {t.cryptoAmount} {t.crypto}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip variant={t.type === 'escrow' ? 'primary' : 'secondary'} size="sm">
                            {t.type === 'escrow' ? 'Escrow' : 'Link'}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status] ?? STATUS_STYLES.pending}`}
                          >
                            {t.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {t.invoiceId ? (
                            <Link href={`/invoice/${t.invoiceId}`}>
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                            </Link>
                          ) : (
                            <span className="text-xs text-ink-soft">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPayments;
