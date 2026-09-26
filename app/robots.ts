import type { MetadataRoute } from 'next';
import { siteUrl, indexable } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  if (!indexable) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

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
