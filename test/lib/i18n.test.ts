import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  detectBrowserLocale,
  formatDate,
  getAlternateLocale,
  getLocaleLabel,
  getPathLocale,
  getPreferredLocale,
  isLocale,
  locales,
  localizedPath,
  normalizeRoute,
  preferredLocaleStorageKey,
  resolveLocaleRedirectPath,
  setPreferredLocale,
} from '@/lib/i18n';

function makeStorage(initial: Record<string, string> = {}): Storage {
  const store = { ...initial };
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  } as unknown as Storage;
}

describe('i18n', () => {
  it('exposes and identifies supported locales', () => {
    expect(locales).toEqual(['en', 'pt-BR']);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('pt-BR')).toBe(true);
    expect(isLocale('pt-br')).toBe(false);
  });

  it('maps locale metadata in both directions', () => {
    expect(getAlternateLocale('en')).toBe('pt-BR');
    expect(getAlternateLocale('pt-BR')).toBe('en');
    expect(getLocaleLabel('en')).toBe('English');
    expect(getLocaleLabel('pt-BR')).toBe('Português');
  });

  it('creates localized paths from root, absolute, and relative paths', () => {
    expect(localizedPath('en', '/')).toBe('/');
    expect(localizedPath('en', 'articles')).toBe('/articles');
    expect(localizedPath('pt-BR', '/')).toBe('/pt-br');
    expect(localizedPath('pt-BR', 'articles/example')).toBe('/pt-br/articles/example');
  });

  it('removes the Portuguese route prefix and preserves other paths', () => {
    expect(normalizeRoute('/pt-br')).toBe('/');
    expect(normalizeRoute('/pt-br/articles/example')).toBe('/articles/example');
    expect(normalizeRoute('/articles/example')).toBe('/articles/example');
    expect(normalizeRoute('/pt-bravo')).toBe('avo');
    expect(normalizeRoute(new String('/pt-br') as unknown as string)).toBe('/');
  });

  it('formats date-only values in each locale without timezone drift', () => {
    expect(formatDate('2026-07-12', 'en')).toBe('Jul 12, 2026');
    expect(formatDate('2026-07-12', 'pt-BR')).toBe('12 de jul. de 2026');
  });

  it('detects the locale from browser language preferences', () => {
    expect(detectBrowserLocale(['pt-BR', 'en'])).toBe('pt-BR');
    expect(detectBrowserLocale(['pt', 'en-US'])).toBe('pt-BR');
    expect(detectBrowserLocale(['en-US', 'en'])).toBe('en');
    expect(detectBrowserLocale([])).toBe('en');
  });

  it('reads and writes the preferred locale from storage', () => {
    const storage = makeStorage();
    expect(getPreferredLocale(storage)).toBeNull();

    setPreferredLocale('pt-BR', storage);
    expect(storage.getItem(preferredLocaleStorageKey)).toBe('pt-BR');
    expect(getPreferredLocale(storage)).toBe('pt-BR');

    setPreferredLocale('en', storage);
    expect(getPreferredLocale(storage)).toBe('en');
  });

  it('ignores invalid values in storage', () => {
    const storage = makeStorage({ [preferredLocaleStorageKey]: 'fr' });
    expect(getPreferredLocale(storage)).toBeNull();
  });

  it('returns null from getPreferredLocale when storage is null', () => {
    expect(getPreferredLocale(null)).toBeNull();
  });

  it('derives the locale from the URL path', () => {
    expect(getPathLocale('/')).toBe('en');
    expect(getPathLocale('/contact')).toBe('en');
    expect(getPathLocale('/pt-br')).toBe('pt-BR');
    expect(getPathLocale('/pt-br/contact')).toBe('pt-BR');
  });

  describe('resolveLocaleRedirectPath', () => {
    it('returns null when the path locale matches the preferred locale', () => {
      const storage = makeStorage({ [preferredLocaleStorageKey]: 'en' });
      expect(resolveLocaleRedirectPath('/', { storage })).toBeNull();
      expect(resolveLocaleRedirectPath('/contact', { storage })).toBeNull();
    });

    it('redirects / to /pt-br when preference is pt-BR', () => {
      const storage = makeStorage({ [preferredLocaleStorageKey]: 'pt-BR' });
      expect(resolveLocaleRedirectPath('/', { storage })).toBe('/pt-br');
      expect(resolveLocaleRedirectPath('/contact', { storage })).toBe('/pt-br/contact');
    });

    it('redirects /pt-br to / when preference is en', () => {
      const storage = makeStorage({ [preferredLocaleStorageKey]: 'en' });
      expect(resolveLocaleRedirectPath('/pt-br', { storage })).toBe('/');
      expect(resolveLocaleRedirectPath('/pt-br/contact', { storage })).toBe('/contact');
    });

    it('detects browser locale and persists it when no preference is stored (switchable path)', () => {
      const storage = makeStorage();
      const result = resolveLocaleRedirectPath('/', { languages: ['pt-BR'], storage });
      expect(result).toBe('/pt-br');
      expect(getPreferredLocale(storage)).toBe('pt-BR');
    });

    it('returns null for non-switchable paths regardless of preference', () => {
      const storage = makeStorage({ [preferredLocaleStorageKey]: 'pt-BR' });
      expect(resolveLocaleRedirectPath('/articles/some-slug', { storage })).toBeNull();
      expect(resolveLocaleRedirectPath('/pt-br/articles/some-slug', { storage })).toBeNull();
    });

    it('persists the path locale for non-switchable paths when no preference is stored', () => {
      const storage = makeStorage();
      resolveLocaleRedirectPath('/articles/some-slug', { languages: ['pt-BR'], storage });
      expect(getPreferredLocale(storage)).toBe('en');
    });

    it('returns null and does not throw when localStorage is unavailable', () => {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
      Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('blocked'); }, configurable: true });
      try {
        expect(() => resolveLocaleRedirectPath('/', { languages: ['en'] })).not.toThrow();
      } finally {
        if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
      }
    });
  });

  describe('getBrowserLanguages fallbacks', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('defaults to en when navigator throws', () => {
      vi.stubGlobal('navigator', undefined);
      const storage = makeStorage();
      expect(resolveLocaleRedirectPath('/', { storage })).toBeNull();
      expect(getPreferredLocale(storage)).toBe('en');
    });

    it('falls back to navigator.language when navigator.languages is empty', () => {
      vi.stubGlobal('navigator', { languages: [], language: 'pt-BR' });
      const storage = makeStorage();
      expect(resolveLocaleRedirectPath('/', { storage })).toBe('/pt-br');
    });

    it('uses navigator.languages when non-empty', () => {
      vi.stubGlobal('navigator', { languages: ['pt-BR', 'en'], language: 'pt-BR' });
      const storage = makeStorage();
      expect(resolveLocaleRedirectPath('/', { storage })).toBe('/pt-br');
    });

    it('falls back to navigator.language when navigator.languages is undefined', () => {
      vi.stubGlobal('navigator', { languages: undefined, language: 'pt-BR' });
      const storage = makeStorage();
      expect(resolveLocaleRedirectPath('/', { storage })).toBe('/pt-br');
    });

    it('defaults to en when navigator.languages is empty and navigator.language is falsy', () => {
      vi.stubGlobal('navigator', { languages: [], language: '' });
      const storage = makeStorage();
      expect(resolveLocaleRedirectPath('/', { storage })).toBeNull();
    });

    it('returns null and does not throw when localStorage throws', () => {
      const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
      Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('blocked'); }, configurable: true });
      try {
        expect(() => resolveLocaleRedirectPath('/', { languages: ['en'] })).not.toThrow();
      } finally {
        if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
      }
    });
  });
});
