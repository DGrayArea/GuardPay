/**
 * Chart tokens.
 *
 * These hexes are the validated palette — checked with the data-viz validator
 * for lightness band, chroma floor, CVD separation, normal-vision separation and
 * contrast against each surface. Light and dark are separately stepped, not an
 * automatic flip. Re-run the validator before changing any of them.
 */
export const CHART = {
  light: {
    series1: '#0f958c', // brand teal — payments
    series2: '#7056f0', // violet — escrow
    grid: 'rgba(15, 23, 42, 0.08)',
    axis: '#44506a',
    surface: '#ffffff',
  },
  dark: {
    series1: '#14a893',
    series2: '#8d77f8',
    grid: 'rgba(255, 255, 255, 0.10)',
    axis: '#94a3b8',
    surface: '#0b1020',
  },
} as const;

/** Compact money formatting for axes: 1.2k, 340, 2.4M. */
export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toFixed(0);
}

export const formatMoney = (value: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
