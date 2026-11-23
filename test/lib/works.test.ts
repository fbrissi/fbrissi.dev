import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/markdown-collection', () => ({
  getMarkdownCollectionItems: vi.fn()
}));

import { getMarkdownCollectionItems } from '@/lib/markdown-collection';
import { getWork, getWorks, getWorkSlugs } from '@/lib/works';

const getItems = vi.mocked(getMarkdownCollectionItems);
const details = { location: '', employmentType: '', companyUrl: '', logo: '', skills: [], startDate: '' };

describe('works', () => {
  it('sorts works by start date, newest first, and then company (D-2)', () => {
    getItems.mockReturnValue([
      { slug: 'third', company: 'Zulu', title: '', dateRange: '', summary: '', content: '', ...details, startDate: '2019-09' },
      { slug: 'second', company: 'Bravo', title: '', dateRange: '', summary: '', content: '', ...details, startDate: '2021-08' },
      { slug: 'first', company: 'Alpha', title: '', dateRange: '', summary: '', content: '', ...details, startDate: '2021-08' }
    ]);

    expect(getWorks('en').map(({ slug }) => slug)).toEqual(['first', 'second', 'third']);
    expect(getItems).toHaveBeenCalledWith('works', 'en');
  });

  it('lists current roles (no end date) before finished ones, whatever their start date', () => {
    getItems.mockReturnValue([
      { slug: 'recent-finished', company: 'Recent', title: '', dateRange: '', summary: '', content: '', ...details, startDate: '2024-09', endDate: '2026-05' },
      { slug: 'current', company: 'Current', title: '', dateRange: '', summary: '', content: '', ...details, startDate: '2019-09' },
      { slug: 'old-finished', company: 'Old', title: '', dateRange: '', summary: '', content: '', ...details, startDate: '2010-01', endDate: '2011-01' }
    ]);

    expect(getWorks('en').map(({ slug }) => slug)).toEqual(['current', 'recent-finished', 'old-finished']);
  });

  it('returns work slugs in display order', () => {
    getItems.mockReturnValue([
      { slug: 'earlier', company: 'Earlier', title: '', dateRange: '', summary: '', content: '', ...details, startDate: '2010-01' },
      { slug: 'later', company: 'Later', title: '', dateRange: '', summary: '', content: '', ...details, startDate: '2020-01' }
    ]);

    expect(getWorkSlugs('pt-BR')).toEqual(['later', 'earlier']);
  });

  it('finds a work entry by slug or returns null', () => {
    const work = { slug: 'found', company: 'Found', title: '', dateRange: '', summary: '', content: '', ...details };
    getItems.mockReturnValue([work]);

    expect(getWork('en', 'found')).toBe(work);
    expect(getWork('en', 'missing')).toBeNull();
  });
});
