import fs from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getArticle, getArticles, getArticleSlugs } from '@/lib/articles';

describe('articles', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns no slugs when the locale directory is absent', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(getArticleSlugs('en')).toEqual([]);
  });

  it('returns sorted markdown slugs only', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['later.md', 'draft.txt', 'earlier.md'] as never);

    expect(getArticleSlugs('pt-BR')).toEqual(['earlier', 'later']);
  });

  it('returns null for a missing article without reading it', () => {
    const readFileSync = vi.spyOn(fs, 'readFileSync');
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(getArticle('en', 'missing')).toBeNull();
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it('builds an article with parsed metadata, URLs, date labels, and a minimum reading time', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      '---\ntitle: Example\ndescription: Description\ndate: "2026-07-12"\ntags:\n  - testing\n---\nword'
    );

    expect(getArticle('en', 'example')).toEqual({
      title: 'Example',
      description: 'Description',
      date: '2026-07-12',
      tags: ['testing'],
      slug: 'example',
      content: 'word',
      readingTime: '1 min read',
      url: 'https://fbrissi.dev/articles/example',
      dateLabel: 'Jul 12, 2026'
    });
  });

  it('sorts articles newest first, calculates longer reading times, and omits files that disappear', () => {
    const longContent = Array.from({ length: 201 }, () => 'word').join(' ');
    vi.spyOn(fs, 'existsSync').mockImplementation((target) => !String(target).endsWith('/gone.md'));
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['old.md', 'gone.md', 'new.md'] as never);
    vi.spyOn(fs, 'readFileSync').mockImplementation((target) => {
      if (String(target).endsWith('/new.md')) {
        return `---\ntitle: New\ndescription: Newer\ndate: "2026-07-12"\n---\n${longContent}`;
      }

      return '---\ntitle: Old\ndescription: Older\ndate: "2026-01-01"\n---\n';
    });

    expect(getArticles('pt-BR')).toMatchObject([
      {
        slug: 'new',
        readingTime: '2 min read',
        url: 'https://fbrissi.dev/pt-br/articles/new',
        dateLabel: '12 de jul. de 2026'
      },
      { slug: 'old', readingTime: '1 min read' }
    ]);
  });
});
