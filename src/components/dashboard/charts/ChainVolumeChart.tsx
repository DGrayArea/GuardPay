'use client';

import React, { useMemo } from 'react';
import type { Transaction } from '@/lib/api';
import { formatMoney } from './theme';

/**
 * Volume by chain.
 *
 * Deliberately not a pie and not a multi-hue bar chart: the chains are already
 * named on the rows, so colouring each one differently would encode identity
 * twice and burn four categorical slots for nothing. One hue, length carries the
 * magnitude, and every row is directly labelled.
 *
 * Plain CSS rather than a chart library — at this size an SVG chart would add
 * weight without adding legibility.
 */
const ChainVolumeChart: React.FC<{ transactions: Transaction[]; currency?: string }> = ({
  transactions,
  currency = 'USD',
}) => {
  const rows = useMemo(() => {
    const totals = new Map<string, { value: number; count: number }>();

    for (const tx of transactions) {
      if (tx.status !== 'completed') continue;
      const key = tx.chain || 'Unknown';
      const cur = totals.get(key) ?? { value: 0, count: 0 };
      totals.set(key, { value: cur.value + Number(tx.amount || 0), count: cur.count + 1 });
    }

    const list = [...totals.entries()]
      .map(([chain, t]) => ({ chain, ...t }))
      .sort((a, b) => b.value - a.value);

    const max = list[0]?.value ?? 0;
    return list.map((r) => ({ ...r, pct: max > 0 ? (r.value / max) * 100 : 0 }));
  }, [transactions]);

  if (rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-ink-soft">No completed payments yet</p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {rows.map((row) => (
        <li key={row.chain}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-ink">{row.chain}</span>
            <span className="shrink-0 text-sm tabular-nums text-ink-soft">
              {formatMoney(row.value, currency)}
              <span className="ml-2 text-xs">
                ({row.count} {row.count === 1 ? 'payment' : 'payments'})
              </span>
            </span>
          </div>
          {/* 4px rounded data-end, anchored to the baseline. */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500"
              style={{ width: `${Math.max(row.pct, 2)}%` }}
              role="img"
              aria-label={`${row.chain}: ${formatMoney(row.value, currency)}`}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};

export default ChainVolumeChart;
