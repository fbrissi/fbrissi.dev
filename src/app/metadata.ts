import { useEffect, type ReactNode } from 'react';

import type { Locale } from '@/lib/i18n';
import type { PageMetadata } from '@/lib/seo';

function setMeta(name: string, content: string, property = false) {
  const attribute = property ? 'property' : 'name';
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, name);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`;
  let element = document.head.querySelector<HTMLLinkElement>(selector);
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    if (hreflang) element.hreflang = hreflang;
    document.head.appendChild(element);
  }
  element.href = href;
}

function useDocumentMetadata(locale: Locale, metadata: PageMetadata) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = metadata.title;
    setMeta('description', metadata.description);
    setMeta('keywords', metadata.keywords.join(', '));
    setLink('canonical', metadata.alternates.canonical);
    Object.entries(metadata.alternates.languages).forEach(([language, href]) => setLink('alternate', href, language));
    setMeta('og:title', metadata.openGraph.title, true);
    setMeta('og:description', metadata.openGraph.description, true);
    setMeta('og:url', metadata.openGraph.url, true);
    setMeta('og:type', metadata.openGraph.type, true);
    setMeta('og:site_name', metadata.openGraph.siteName, true);
    setMeta('og:locale', metadata.openGraph.locale, true);
    setMeta('og:locale:alternate', metadata.openGraph.alternateLocale, true);
    setMeta('og:image', metadata.openGraph.images[0].url, true);
    setMeta('og:image:alt', metadata.openGraph.images[0].alt, true);
    setMeta('twitter:card', metadata.twitter.card);
    setMeta('twitter:title', metadata.twitter.title);
    setMeta('twitter:description', metadata.twitter.description);
    setMeta('twitter:image', metadata.twitter.images[0]);
  }, [locale, metadata]);
}

export function DocumentMetadata({ locale, metadata, children }: { locale: Locale; metadata: PageMetadata; children: ReactNode }) {
  useDocumentMetadata(locale, metadata);
  return children;
}
