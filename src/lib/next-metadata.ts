import type { Metadata } from 'next';

import { getAlternateLocale, localizedPath, type Locale } from './i18n';
import { siteUrl, socialImage } from './site';

export function createUnlistedNextMetadata({ title, description }: { title: string; description: string }): Metadata {
  return {
    title,
    description,
    referrer: 'no-referrer',
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false, noimageindex: true }
    }
  };
}

export function createNextMetadata({
  locale,
  pathname,
  title,
  description,
  keywords = [],
  type = 'website'
}: {
  locale: Locale;
  pathname: string;
  title: string;
  description: string;
  keywords?: string[];
  type?: 'website' | 'article';
}): Metadata {
  const currentPath = localizedPath(locale, pathname);
  const alternateLocale = getAlternateLocale(locale);
  const imageUrl = new URL(socialImage, siteUrl).toString();

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    keywords,
    authors: [{ name: 'Filipe Bojikian Rissi' }],
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    alternates: {
      canonical: currentPath,
      languages: {
        en: localizedPath('en', pathname),
        'pt-BR': localizedPath('pt-BR', pathname),
        'x-default': localizedPath('en', pathname)
      }
    },
    openGraph: {
      title,
      description,
      url: currentPath,
      siteName: 'Filipe Bojikian Rissi',
      locale: locale === 'pt-BR' ? 'pt_BR' : 'en_US',
      alternateLocale: alternateLocale === 'pt-BR' ? 'pt_BR' : 'en_US',
      type,
      images: [{ url: imageUrl, width: 1200, height: 630, type: 'image/png', alt: title }]
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl]
    }
  };
}
