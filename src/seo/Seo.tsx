import { Helmet } from 'react-helmet-async';
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME } from './constants';
import { safeJsonLdString } from './jsonLdSafety';

export interface SeoProps {
  /** Page-specific title WITHOUT the site suffix — the suffix is appended automatically. */
  title: string;
  description: string;
  /** Site-relative path used to build the canonical + og:url, e.g. "/resume-for/software-engineer" */
  canonicalPath: string;
  keywords?: string;
  ogType?: 'website' | 'article' | 'product';
  ogImage?: string;
  noIndex?: boolean;
  /** One or more schema.org JSON-LD graphs to embed on this page. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Set false to render the raw title with no site suffix (rarely needed). */
  appendSiteName?: boolean;
}

/**
 * Canonical per-page SEO tag component. Renders through react-helmet-async so the
 * same tree works both client-side (HelmetProvider in main.tsx) and during the
 * build-time prerender pass (HelmetProvider + renderToStaticMarkup in scripts/prerender.mjs),
 * which is what makes non-JS crawlers (Bing, LinkedIn, Slack, X unfurlers) see real
 * per-route metadata instead of the generic index.html shell.
 */
export function Seo({
  title,
  description,
  canonicalPath,
  keywords,
  ogType = 'website',
  ogImage = DEFAULT_OG_IMAGE,
  noIndex = false,
  jsonLd,
  appendSiteName = true,
}: SeoProps) {
  const fullTitle = appendSiteName ? `${title} | ${SITE_NAME}` : title;
  const url = absoluteUrl(canonicalPath);
  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={url} />
      <meta
        name="robots"
        content={noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}
      />

      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={fullTitle} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {safeJsonLdString(schema)}
        </script>
      ))}
    </Helmet>
  );
}
