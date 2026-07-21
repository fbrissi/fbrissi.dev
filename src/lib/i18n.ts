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
]);

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
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function getBrowserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') {
    return [];
  }

  return navigator.languages?.length ? navigator.languages : [navigator.language].filter(Boolean);
}
