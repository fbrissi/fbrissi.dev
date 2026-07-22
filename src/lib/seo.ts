import { getAlternateLocale, localizedPath, type Locale } from './i18n';
import { getMessages, siteUrl } from './site';

const baseUrl = new URL(siteUrl);

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, baseUrl).toString();
}

type PageMetadataInput = {
  locale: Locale;
  pathname: string;
  title: string;
  description: string;
  image?: string;
  keywords?: string[];
};

export type PageMetadata = ReturnType<typeof createPageMetadata>;

export function createPageMetadata({ locale, pathname, title, description, image = '/images/og/og-image-avatar.png', keywords = [] }: PageMetadataInput) {
  const alternateLocale = getAlternateLocale(locale);
  const currentPath = localizedPath(locale, pathname);
  const messages = getMessages(locale);

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: absoluteUrl(currentPath),
      languages: {
        en: absoluteUrl(localizedPath('en', pathname)),
        'pt-BR': absoluteUrl(localizedPath('pt-BR', pathname))
      }
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(currentPath),
      siteName: messages.site.name,
      locale: locale === 'pt-BR' ? 'pt_BR' : 'en_US',
      alternateLocale: alternateLocale === 'pt-BR' ? 'pt_BR' : 'en_US',
      type: 'website',
      images: [
        {
          url: absoluteUrl(image),
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: title
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [absoluteUrl(image)],
      imageAlt: title
    }
  };
}
