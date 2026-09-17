'use client';

import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Transaction } from '@/lib/api';
import { CHART, formatCompact, formatMoney } from './theme';

interface RevenueChartProps {
  transactions: Transaction[];
  days?: number;
  currency?: string;
}

/**
 * Revenue over time.
 *
 * One series, so no legend — the card title names it. Days with no payments are
 * filled with zero rather than skipped, otherwise the x-axis compresses gaps and
 * implies activity that never happened.
 */
const RevenueChart: React.FC<RevenueChartProps> = ({
  transactions,
  days = 30,
  currency = 'USD',
}) => {
  const [isDark, setIsDark] = useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () =>
      setIsDark(document.documentElement.classList.contains('dark') || mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const c = isDark ? CHART.dark : CHART.light;

  const data = useMemo(() => {
    const buckets = new Map<string, number>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }

    for (const tx of transactions) {
      if (tx.status !== 'completed') continue;
      const key = new Date(tx.timestamp ?? tx.createdAt).toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + Number(tx.amount || 0));
    }

    return [...buckets.entries()].map(([date, value]) => ({
      date,
      label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value,
    }));
  }, [transactions, days]);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-lg border border-dashed text-center">
        <p className="text-sm font-medium text-ink">No revenue yet</p>
        <p className="mt-1 max-w-xs text-xs text-ink-soft">
          Completed payments from the last {days} days will chart here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="gp-revenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.series1} stopOpacity={0.22} />
              <stop offset="100%" stopColor={c.series1} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Recessive grid: horizontal only, no vertical rules. */}
          <CartesianGrid stroke={c.grid} vertical={false} />

          <XAxis
            dataKey="label"
            tick={{ fill: c.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            tick={{ fill: c.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={formatCompact}
          />

          <Tooltip
            cursor={{ stroke: c.axis, strokeWidth: 1, strokeDasharray: '3 3' }}
            contentStyle={{
              background: c.surface,
              border: `1px solid ${c.grid}`,
              borderRadius: 10,
              fontSize: 12,
              boxShadow: '0 4px 16px rgba(0,0,0,.08)',
            }}
            labelStyle={{ color: c.axis, marginBottom: 2 }}
            formatter={(value: number) => [formatMoney(value, currency), 'Revenue']}
          />

          <Area
            type="monotone"
            dataKey="value"
            stroke={c.series1}
            strokeWidth={2}
            fill="url(#gp-revenue)"
            // Points appear on hover only; a dot per day is noise at 30 days.
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RevenueChart;
