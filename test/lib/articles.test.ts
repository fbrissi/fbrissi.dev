import { afterEach, describe, expect, it, vi } from 'vitest';

import { getArticle, getArticles, getArticleSlugs, getArticleTranslationSlug } from '@/lib/articles';
import * as markdown from '@/lib/markdown';

describe('articles', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads localized Markdown articles through Vite', () => {
    expect(getArticleSlugs('en')).toEqual(['registry-lookup-with-digital-certificates']);
    expect(getArticleSlugs('pt-BR')).toEqual(['consulta-de-cadastros-com-certificacao-digital']);
  });

  it('returns null for an unknown article', () => {
    expect(getArticle('en', 'missing')).toBeNull();
  });

  it('parses metadata and derives article fields', () => {
    const article = getArticle('en', 'registry-lookup-with-digital-certificates');
    expect(article).toMatchObject({
      slug: 'registry-lookup-with-digital-certificates',
      readingTime: expect.stringMatching(/^\d+ min read$/),
      url: 'https://fbrissi.dev/articles/registry-lookup-with-digital-certificates',
      dateLabel: expect.any(String)
    });
    expect(article?.content).toContain('Every day, when shopping');
  });

  it('returns articles newest first', () => {
    const articles = getArticles('pt-BR');
    expect(articles).toEqual([...articles].sort((left, right) => right.date.localeCompare(left.date)));
  });

  it('localizes the reading time (C-7)', () => {
    expect(getArticle('pt-BR', 'consulta-de-cadastros-com-certificacao-digital')?.readingTime).toMatch(/^\d+ min de leitura$/);
  });

  it('resolves the translated slug in the other locale by translation key (S-1)', () => {
    expect(getArticleTranslationSlug('en', 'registry-lookup-with-digital-certificates')).toBe('consulta-de-cadastros-com-certificacao-digital');
    expect(getArticleTranslationSlug('pt-BR', 'consulta-de-cadastros-com-certificacao-digital')).toBe('registry-lookup-with-digital-certificates');
    expect(getArticleTranslationSlug('en', 'missing')).toBeNull();
  });

  it('has no translation when the other locale lacks the translation key', () => {
    const parse = markdown.parseMarkdown;
    vi.spyOn(markdown, 'parseMarkdown').mockImplementation((source) => {
      const parsed = parse<Record<string, unknown>>(source);
      return { ...parsed, data: { ...parsed.data, translationKey: parsed.data.title === 'Registry lookup via web service using digital certificates for data encryption' ? 'only-english' : parsed.data.translationKey } } as never;
    });
    expect(getArticleTranslationSlug('en', 'registry-lookup-with-digital-certificates')).toBeNull();
  });
});
