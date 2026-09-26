import type { Metadata } from 'next';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/landing/Hero';
import {
  Chains,
  Developers,
  Faq,
  FinalCta,
  HowItWorks,
  Pricing,
  Products,
  faqs,
} from '@/components/landing/Sections';
import { siteUrl } from '@/lib/site';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

/** Structured data so search results can show the product, not just a link. */
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'GuardPay',
      url: siteUrl,
      logo: `${siteUrl}/icon-512.png`,
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
        'Crypto payment gateway with payment links, on-chain escrow, signed webhooks and an x402 facilitator for per-request API payments.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
};

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070B14]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main>
        <Hero />
        <Chains />
        <Products />
        <HowItWorks />
        <Pricing />
        <Developers />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
