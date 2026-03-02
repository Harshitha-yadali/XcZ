import { useEffect } from 'react';

const BASE_TITLE = 'PrimoBoost AI';
const BASE_URL = 'https://primoboost.ai';

interface SEOOptions {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogType?: string;
  ogImage?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  noIndex?: boolean;
}

export function useSEO(options: SEOOptions) {
  useEffect(() => {
    const {
      title,
      description,
      keywords,
      canonical,
      ogTitle,
      ogDescription,
      ogType,
      ogImage,
      twitterCard,
      noIndex,
    } = options;

    if (title) {
      document.title = `${title} | ${BASE_TITLE}`;
    }

    if (description) {
      updateMeta('description', description);
    }

    if (keywords) {
      updateMeta('keywords', keywords);
    }

    if (canonical) {
      updateLink('canonical', `${BASE_URL}${canonical}`);
    }

    if (ogTitle || title) {
      updateMetaProperty('og:title', ogTitle || `${title} | ${BASE_TITLE}`);
    }

    if (ogDescription || description) {
      updateMetaProperty('og:description', ogDescription || description || '');
    }

    if (ogType) {
      updateMetaProperty('og:type', ogType);
    }

    if (canonical) {
      updateMetaProperty('og:url', `${BASE_URL}${canonical}`);
    }

    if (ogImage) {
      updateMetaProperty('og:image', ogImage);
      updateMetaProperty('og:image:alt', ogTitle || title || BASE_TITLE);
    }

    if (twitterCard) {
      updateMeta('twitter:card', twitterCard);
      updateMeta('twitter:title', ogTitle || `${title} | ${BASE_TITLE}`);
      updateMeta('twitter:description', ogDescription || description || '');
      if (ogImage) {
        updateMeta('twitter:image', ogImage);
      }
    }

    if (noIndex) {
      updateMeta('robots', 'noindex, nofollow');
    }

    return () => {
      document.title = `${BASE_TITLE} - AI-Powered Resume Optimizer | ATS-Friendly Resume Builder`;
      updateMeta('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    };
  }, [options.title, options.description, options.keywords, options.canonical, options.ogTitle, options.ogDescription, options.ogType, options.ogImage, options.twitterCard, options.noIndex]);
}

function updateMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (el) {
    el.content = content;
  } else {
    el = document.createElement('meta');
    el.name = name;
    el.content = content;
    document.head.appendChild(el);
  }
}

function updateMetaProperty(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (el) {
    el.content = content;
  } else {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    el.content = content;
    document.head.appendChild(el);
  }
}

function updateLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (el) {
    el.href = href;
  } else {
    el = document.createElement('link');
    el.rel = rel;
    el.href = href;
    document.head.appendChild(el);
  }
}

export function injectJsonLd(id: string, data: Record<string, unknown>) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function removeJsonLd(id: string) {
  const el = document.getElementById(id);
  if (el) el.remove();
}
