import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';
import { siteUrl, indexable } from '@/lib/site';

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// Addresses, amounts and hashes are read character by character — they need a
// mono face with unambiguous 0/O and 1/l.
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'GuardPay: crypto payments, escrow and x402 settlement',
    template: '%s · GuardPay',
  },
  description:
    'Accept crypto payments on Ethereum, Base, BNB Chain and Solana. Payment links, on-chain escrow for deals between strangers, and x402 settlement for paid APIs and AI agents.',
  applicationName: 'GuardPay',
  keywords: [
    'crypto payment gateway',
    'accept crypto payments',
    'crypto escrow',
    'stablecoin payments',
    'USDC payments',
    'payment links',
    'web3 checkout',
    'Solana payments',
    'Base payments',
    'x402 facilitator',
    'pay per request API',
    'AI agent payments',
  ],
  authors: [{ name: 'GuardPay' }],
  creator: 'GuardPay',
  openGraph: {
    type: 'website',
    siteName: 'GuardPay',
    url: siteUrl,
    title: 'GuardPay: crypto payments, escrow and x402 settlement',
    description:
      'Get paid in crypto. Hold it in escrow when trust is thin. Settle x402 payments for APIs and agents.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GuardPay: crypto payments, escrow and x402 settlement',
    description:
      'Get paid in crypto. Hold it in escrow when trust is thin. Settle x402 payments for APIs and agents.',
  },
  manifest: '/manifest.webmanifest',
  robots: {
    index: indexable,
    follow: indexable,
    googleBot: { index: indexable, follow: indexable, 'max-image-preview': 'large' },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom must stay available; payment addresses are small text.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#070B14' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
