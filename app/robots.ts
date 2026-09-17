import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Checkout sessions and the merchant console carry per-user state and
      // must never be indexed.
      disallow: ['/dashboard', '/dashboard/', '/invoice/', '/pay/', '/login'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
