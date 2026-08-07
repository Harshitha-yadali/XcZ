import { absoluteUrl, DEFAULT_OG_IMAGE, LOGO_IMAGE, SITE_NAME, SITE_URL, SOCIAL_PROFILES } from './constants';

/**
 * Pure builder functions returning plain schema.org JSON-LD objects. Pass the
 * result (or an array of results) into <Seo jsonLd={...} />. Kept dependency-free
 * (no React) so they can also be used from the Node prerender/sitemap scripts.
 */

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: LOGO_IMAGE,
    sameAs: SOCIAL_PROFILES,
    areaServed: 'IN',
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { '@id': `${SITE_URL}/#organization` },
    potentialAction: searchActionSchema(),
  };
}

export function searchActionSchema() {
  return {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/blog?search={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  };
}

export function softwareApplicationSchema(opts?: {
  name?: string;
  description?: string;
  category?: string;
  ratingValue?: number;
  ratingCount?: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: opts?.name || SITE_NAME,
    description:
      opts?.description ||
      'Free ATS resume checking, job-specific AI resume optimization, job discovery, interview preparation and expert career guidance.',
    url: SITE_URL,
    applicationCategory: opts?.category || 'BusinessApplication',
    operatingSystem: 'Web',
    image: DEFAULT_OG_IMAGE,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
      description: 'Free ATS Resume Score Check',
    },
    ...(opts?.ratingValue
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: opts.ratingValue,
            ratingCount: opts.ratingCount ?? 1,
            bestRating: '5',
            worstRating: '1',
          },
        }
      : {}),
    provider: { '@id': `${SITE_URL}/#organization` },
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function faqPageSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function breadcrumbListSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function webPageSchema(opts: {
  path: string;
  name: string;
  description: string;
  breadcrumb?: BreadcrumbItem[];
  datePublished?: string;
  dateModified?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': absoluteUrl(opts.path),
    url: absoluteUrl(opts.path),
    name: opts.name,
    description: opts.description,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
    ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
    ...(opts.breadcrumb ? { breadcrumb: breadcrumbListSchema(opts.breadcrumb) } : {}),
  };
}

export function articleSchema(opts: {
  path: string;
  headline: string;
  description: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  section?: string;
  keywords?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.headline,
    description: opts.description,
    image: opts.image || DEFAULT_OG_IMAGE,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified || opts.datePublished,
    author: { '@type': 'Person', name: opts.authorName || SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: LOGO_IMAGE },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(opts.path) },
    ...(opts.section ? { articleSection: opts.section } : {}),
    ...(opts.keywords ? { keywords: opts.keywords } : {}),
  };
}

export function howToSchema(opts: {
  name: string;
  description: string;
  totalTime?: string;
  steps: { name: string; text: string; image?: string }[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: opts.name,
    description: opts.description,
    ...(opts.totalTime ? { totalTime: opts.totalTime } : {}),
    step: opts.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.image ? { image: step.image } : {}),
    })),
  };
}

export function productSchema(opts: {
  name: string;
  description: string;
  image?: string;
  priceINR: string;
  ratingValue?: number;
  ratingCount?: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: opts.name,
    description: opts.description,
    image: opts.image || DEFAULT_OG_IMAGE,
    brand: { '@type': 'Brand', name: SITE_NAME },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: opts.priceINR,
      availability: 'https://schema.org/InStock',
      url: SITE_URL,
    },
    ...(opts.ratingValue
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: opts.ratingValue,
            ratingCount: opts.ratingCount ?? 1,
          },
        }
      : {}),
  };
}

export function reviewSchema(opts: {
  itemReviewed: string;
  authorName: string;
  reviewBody: string;
  ratingValue: number;
  datePublished: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: { '@type': 'Product', name: opts.itemReviewed },
    author: { '@type': 'Person', name: opts.authorName },
    reviewBody: opts.reviewBody,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: opts.ratingValue,
      bestRating: '5',
      worstRating: '1',
    },
    datePublished: opts.datePublished,
  };
}

export function videoObjectSchema(opts: {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration?: string;
  contentUrl?: string;
  embedUrl?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: opts.name,
    description: opts.description,
    thumbnailUrl: [opts.thumbnailUrl],
    uploadDate: opts.uploadDate,
    ...(opts.duration ? { duration: opts.duration } : {}),
    ...(opts.contentUrl ? { contentUrl: opts.contentUrl } : {}),
    ...(opts.embedUrl ? { embedUrl: opts.embedUrl } : {}),
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: LOGO_IMAGE },
    },
  };
}
