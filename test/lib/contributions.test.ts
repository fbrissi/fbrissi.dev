import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/markdown-collection', () => ({
  getMarkdownCollectionItems: vi.fn()
}));

import { getMarkdownCollectionItems } from '@/lib/markdown-collection';
import { getContribution, getContributions, getContributionSlugs } from '@/lib/contributions';

const getItems = vi.mocked(getMarkdownCollectionItems);

const contribution = (slug: string, title: string, order?: number) => ({
  slug,
  title,
  repository: `org/${slug}`,
  repositoryUrl: `https://github.com/org/${slug}`,
  description: '',
  period: '2024',
  tags: [],
  evidence: [{ label: 'PR', url: 'https://example.com/pr' }],
  order,
  content: ''
});

describe('contributions', () => {
  it('sorts contributions by order and then title', () => {
    getItems.mockReturnValue([contribution('third', 'Zulu', 2), contribution('second', 'Bravo'), contribution('first', 'Alpha', 0)]);

    expect(getContributions('en').map(({ slug }) => slug)).toEqual(['first', 'second', 'third']);
    expect(getItems).toHaveBeenCalledWith('contributions', 'en');
  });

  it('returns slugs in display order', () => {
    getItems.mockReturnValue([contribution('beta', 'Beta', 2), contribution('alpha', 'Alpha', 1)]);
    expect(getContributionSlugs('pt-BR')).toEqual(['alpha', 'beta']);
  });

  it('finds a contribution by slug or returns null', () => {
    const found = contribution('found', 'Found');
    getItems.mockReturnValue([found]);
    expect(getContribution('en', 'found')).toBe(found);
    expect(getContribution('en', 'missing')).toBeNull();
  });
});
