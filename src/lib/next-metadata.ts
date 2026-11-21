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
  alternatePathname = pathname,
  title,
  description,
  image = socialImage,
  type = 'website',
  publishedTime,
  modifiedTime
}: {
  locale: Locale;
  pathname: string;
  /** Path of the same page in the other locale when its slug differs, or null when the page has no translation. */
  alternatePathname?: string | null;
  title: string;
  description: string;
  image?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
}): Metadata {
  const currentPath = localizedPath(locale, pathname);
  const alternateLocale = getAlternateLocale(locale);
  const imageUrl = new URL(image, siteUrl).toString();
  const paths = { [locale]: pathname, [alternateLocale]: alternatePathname } as Record<Locale, string | null>;

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    authors: [{ name: 'Filipe Bojikian Rissi', url: siteUrl }],
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    alternates: {
      canonical: currentPath,
      languages: {
        ...(paths.en === null ? {} : { en: localizedPath('en', paths.en) }),
        ...(paths['pt-BR'] === null ? {} : { 'pt-BR': localizedPath('pt-BR', paths['pt-BR']) }),
        ...(paths.en === null ? {} : { 'x-default': localizedPath('en', paths.en) })
      }
    },
    openGraph: {
      title,
      description,
      url: currentPath,
      siteName: 'Filipe Bojikian Rissi',
      locale: locale === 'pt-BR' ? 'pt_BR' : 'en_US',
      alternateLocale: alternateLocale === 'pt-BR' ? 'pt_BR' : 'en_US',
      images: [{ url: imageUrl, width: 1200, height: 630, type: 'image/png', alt: title }],
      ...(type === 'article'
        ? { type, publishedTime, modifiedTime: modifiedTime ?? publishedTime, authors: [siteUrl] }
        : { type })
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl]
    }
  };
}
