import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'GuardPay — Crypto payments with escrow protection',
    template: '%s · GuardPay',
  },
  description:
    'Accept crypto payments across Ethereum, Base, BSC and Solana. Shareable payment links, automatic on-chain confirmation, signed webhooks, and smart-contract escrow that protects both sides.',
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
  ],
  authors: [{ name: 'GuardPay' }],
  creator: 'GuardPay',
  openGraph: {
    type: 'website',
    siteName: 'GuardPay',
    url: siteUrl,
    title: 'GuardPay — Crypto payments with escrow protection',
    description:
      'Shareable payment links, automatic on-chain confirmation, and smart-contract escrow that protects both sides.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GuardPay — Crypto payments with escrow protection',
    description:
      'Shareable payment links, automatic on-chain confirmation, and smart-contract escrow that protects both sides.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom must stay available; payment addresses are small text.
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0A1024' },
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
