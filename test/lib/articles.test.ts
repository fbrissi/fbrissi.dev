import { describe, expect, it } from 'vitest';

import { getArticle, getArticles, getArticleSlugs } from '@/lib/articles';

describe('articles', () => {
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
});
