import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/markdown-collection', () => ({
  getMarkdownCollectionItems: vi.fn()
}));

import { getMarkdownCollectionItems } from '@/lib/markdown-collection';
import { getWork, getWorks, getWorkSlugs } from '@/lib/works';

const getItems = vi.mocked(getMarkdownCollectionItems);
const details = { location: '', employmentType: '', companyUrl: '', logo: '', skills: [], startDate: '' };

describe('works', () => {
  it('sorts works by order and then company, treating omitted order as zero', () => {
    getItems.mockReturnValue([
      { slug: 'third', company: 'Zulu', title: '', dateRange: '', summary: '', order: 2, content: '', ...details },
      { slug: 'second', company: 'Bravo', title: '', dateRange: '', summary: '', content: '', ...details },
      { slug: 'first', company: 'Alpha', title: '', dateRange: '', summary: '', order: 0, content: '', ...details }
    ]);

    expect(getWorks('en').map(({ slug }) => slug)).toEqual(['first', 'second', 'third']);
    expect(getItems).toHaveBeenCalledWith('works', 'en');
  });

  it('returns work slugs in display order', () => {
    getItems.mockReturnValue([
      { slug: 'later', company: 'Later', title: '', dateRange: '', summary: '', order: 2, content: '', ...details },
      { slug: 'earlier', company: 'Earlier', title: '', dateRange: '', summary: '', order: 1, content: '', ...details }
    ]);

    expect(getWorkSlugs('pt-BR')).toEqual(['earlier', 'later']);
  });

  it('finds a work entry by slug or returns null', () => {
    const work = { slug: 'found', company: 'Found', title: '', dateRange: '', summary: '', content: '', ...details };
    getItems.mockReturnValue([work]);

    expect(getWork('en', 'found')).toBe(work);
    expect(getWork('en', 'missing')).toBeNull();
  });
});
