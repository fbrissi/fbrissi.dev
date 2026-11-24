import localizedSlugs from '../../scripts/localized-slugs.json';

export const locales = ['en', 'pt-BR'] as const;

export type Locale = (typeof locales)[number];

export const preferredLocaleStorageKey = 'fbrissi.dev:preferred-locale';

const localeSwitchablePaths = new Set([
  '/',
  '/about',
  '/articles',
  '/contact',
  '/open-source',
  '/projects',
  '/works',
  '/study-groups',
  '/study-groups/terms',
  '/privacy',
]);

/**
 * Portuguese slugs that differ from the English path (the rest mirror it under `/pt-br`). One JSON source shared with the
 * sitemap and the redirects, so they can't drift.
 */
const portugueseSlugs: Record<string, string> = localizedSlugs;
const englishPaths: Record<string, string> = Object.fromEntries(Object.entries(portugueseSlugs).map(([english, portuguese]) => [portuguese, english]));

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
    return normalized === '/' ? '/pt-br' : `/pt-br${portugueseSlugs[normalized] ?? normalized}`;
  }

  return normalized;
}

export function normalizeRoute(path: string): string {
  const route = path === '/pt-br' ? '/' : path.replace(/^\/pt-br/, '') || '/';
  return englishPaths[route] ?? route;
}

export function getPathLocale(path: string): Locale {
  return path === '/pt-br' || path.startsWith('/pt-br/') ? 'pt-BR' : 'en';
}

export function detectBrowserLocale(languages: readonly string[] = []): Locale {
  for (const language of languages) {
    if (language.toLowerCase().startsWith('pt')) {
      return 'pt-BR';
    }
  }

  return 'en';
}

export function getPreferredLocale(storage: Pick<Storage, 'getItem'> | null = getBrowserStorage()): Locale | null {
  const value = storage?.getItem(preferredLocaleStorageKey);
  return value && isLocale(value) ? value : null;
}

export function setPreferredLocale(
  locale: Locale,
  storage: Pick<Storage, 'setItem'> | null = getBrowserStorage()
): void {
  storage?.setItem(preferredLocaleStorageKey, locale);
}

export function resolveLocaleRedirectPath(
  pathname: string,
  options: {
    languages?: readonly string[];
    storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  } = {}
): string | null {
  const storage = options.storage === undefined ? getBrowserStorage() : options.storage;
  const pathLocale = getPathLocale(pathname);
  const normalizedPath = normalizeRoute(pathname);
  const canSwitchPath = localeSwitchablePaths.has(normalizedPath);
  let preferred = getPreferredLocale(storage);

  if (!preferred) {
    preferred = canSwitchPath
      ? detectBrowserLocale(options.languages ?? getBrowserLanguages())
      : pathLocale;
    setPreferredLocale(preferred, storage);
  }

  if (!canSwitchPath || preferred === pathLocale) {
    return null;
  }

  return localizedPath(preferred, normalizedPath);
}

export function formatDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'pt-BR' ? 'pt-BR' : 'en-US', {
    dateStyle: 'medium'
  }).format(new Date(`${date}T00:00:00Z`));
}

function getBrowserStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function getBrowserLanguages(): readonly string[] {
  try {
    const langs = Array.from(navigator.languages ?? []);
    if (langs.length > 0) return langs;
    return navigator.language ? [navigator.language] : [];
  } catch {
    return [];
  }
}
