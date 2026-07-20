import { describe, expect, it } from 'vitest';

import {
  getMarkdownCollectionItems,
  getMarkdownCollectionSlugs,
  readMarkdownCollectionItem
} from '@/lib/markdown-collection';

describe('markdown collections', () => {
  it('loads known collection slugs through Vite', () => {
    expect(getMarkdownCollectionSlugs('projects', 'en')).toEqual(['fbrissi-dev']);
    expect(getMarkdownCollectionSlugs('contributions', 'en')).toEqual([
      'apache-commons-net',
      'infinispan',
      'jgroups-aws',
      'keycloak',
      'kool-dev',
      'laravel',
      'pentaho-data-integration',
      'primefaces',
      'wirechat'
    ]);
    expect(getMarkdownCollectionSlugs('works', 'pt-BR')).toEqual([
      'exlink',
      'ferrasi',
      'finch',
      'firework',
      'gp',
      'mega-bilheteria',
      'nm-sistemas',
      'pagbank'
    ]);
    expect(getMarkdownCollectionSlugs('unknown', 'en')).toEqual([]);
  });

  it('returns null for a missing item', () => {
    expect(readMarkdownCollectionItem('projects', 'en', 'missing')).toBeNull();
  });

  it('parses frontmatter and Markdown content', () => {
    expect(readMarkdownCollectionItem<{ title: string }>('projects', 'en', 'fbrissi-dev')).toMatchObject({
      slug: 'fbrissi-dev',
      title: 'fbrissi.dev',
      content: expect.any(String)
    });
  });

  it('returns all items in a collection', () => {
    expect(getMarkdownCollectionItems('works', 'en')).toHaveLength(8);
    expect(getMarkdownCollectionItems('contributions', 'pt-BR')).toHaveLength(9);
  });
});
