export const locales = ['en', 'pt-BR'] as const;

export type Locale = (typeof locales)[number];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getAlternateLocale(locale: Locale): Locale {
  return locale === 'en' ? 'pt-BR' : 'en';
}

export function getLocaleLabel(locale: Locale): string {
  return locale === 'en' ? 'English' : 'Português';
}

export function localizedPath(locale: Locale, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;

  if (locale === 'pt-BR') {
    return normalized === '/' ? '/pt-br' : `/pt-br${normalized}`;
  }

  return normalized;
}

export function normalizeRoute(path: string): string {
  return path === '/pt-br' ? '/' : path.replace(/^\/pt-br/, '') || '/';
}

export function formatDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'pt-BR' ? 'pt-BR' : 'en-US', {
    dateStyle: 'medium'
  }).format(new Date(`${date}T00:00:00Z`));
}
