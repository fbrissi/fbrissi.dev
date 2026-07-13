import fs from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getMarkdownCollectionItems,
  getMarkdownCollectionSlugs,
  readMarkdownCollectionItem
} from '@/lib/markdown-collection';

describe('markdown collections', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns no slugs when a locale collection directory is absent', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(getMarkdownCollectionSlugs('examples', 'en')).toEqual([]);
  });

  it('returns sorted markdown slugs and excludes other files', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['zeta.md', 'notes.txt', 'alpha.md', 'README'] as never);

    expect(getMarkdownCollectionSlugs('examples', 'en')).toEqual(['alpha', 'zeta']);
  });

  it('returns null rather than reading a missing item', () => {
    const readFileSync = vi.spyOn(fs, 'readFileSync');
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(readMarkdownCollectionItem('examples', 'pt-BR', 'missing')).toBeNull();
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it('parses frontmatter and preserves markdown content for an item', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('---\ntitle: Example\norder: 2\n---\n\nBody text');

    expect(readMarkdownCollectionItem<{ title: string; order: number }>('examples', 'en', 'example')).toEqual({
      title: 'Example',
      order: 2,
      slug: 'example',
      content: '\nBody text'
    });
  });

  it('reads all available slugs and filters items that disappear before they are read', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((target) => !String(target).endsWith('/vanished.md'));
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['available.md', 'vanished.md'] as never);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('---\ntitle: Available\n---\nContent');

    expect(getMarkdownCollectionItems<{ title: string }>('examples', 'en')).toEqual([
      { title: 'Available', slug: 'available', content: 'Content' }
    ]);
  });
});
