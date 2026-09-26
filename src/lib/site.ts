/**
 * Public origin for canonical URLs, Open Graph, sitemap and structured data.
 *
 * NEXT_PUBLIC_SITE_URL wins when set. On Vercel, fall back to the project's
 * production domain, then the deployment's own URL, so a deploy without the
 * variable never advertises localhost to search engines and social cards.
 */
const fromVercel =
  process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || null;

export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (fromVercel ? `https://${fromVercel}` : 'http://localhost:3000')
).replace(/\/$/, '');

/** Preview and dev deploys must not compete with production in search. */
export const indexable =
  process.env.VERCEL_ENV ? process.env.VERCEL_ENV === 'production' : true;
