import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/home/Hero';
import Features from '@/components/home/Features';
import PaymentDemo from '@/components/home/PaymentDemo';
import EscrowExplainer from '@/components/home/EscrowExplainer';
import MerchantPreview from '@/components/home/MerchantPreview';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/** Structured data so search results can show the product, not just a link. */
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'GuardPay',
      url: siteUrl,
      logo: `${siteUrl}/icon.svg`,
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'GuardPay',
      publisher: { '@id': `${siteUrl}/#organization` },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'GuardPay',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web',
      description:
        'Crypto payment gateway with shareable payment links, automatic on-chain confirmation, signed webhooks and smart-contract escrow.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
  ],
};

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main>
        <Hero />
        <Features />
        <PaymentDemo />
        <EscrowExplainer />
        <MerchantPreview />
      </main>
      <Footer />
    </div>
  );
}
