import { describe, expect, it } from 'vitest';

import {
  formatDate,
  getAlternateLocale,
  getLocaleLabel,
  isLocale,
  locales,
  localizedPath,
  normalizeRoute
} from '@/lib/i18n';

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
});
