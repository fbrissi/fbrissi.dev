import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/markdown-collection', () => ({
  getMarkdownCollectionItems: vi.fn()
}));

import { getMarkdownCollectionItems } from '@/lib/markdown-collection';
import { getProject, getProjects, getProjectSlugs } from '@/lib/projects';

const getItems = vi.mocked(getMarkdownCollectionItems);

describe('projects', () => {
  it('sorts projects by order and then title, treating omitted order as zero', () => {
    getItems.mockReturnValue([
      { slug: 'third', title: 'Zulu', description: '', url: '', stack: [], order: 2, content: '' },
      { slug: 'second', title: 'Bravo', description: '', url: '', stack: [], content: '' },
      { slug: 'first', title: 'Alpha', description: '', url: '', stack: [], order: 0, content: '' }
    ]);

    expect(getProjects('en').map(({ slug }) => slug)).toEqual(['first', 'second', 'third']);
    expect(getItems).toHaveBeenCalledWith('projects', 'en');
  });

  it('returns project slugs in display order', () => {
    getItems.mockReturnValue([
      { slug: 'beta', title: 'Beta', description: '', url: '', stack: [], order: 2, content: '' },
      { slug: 'alpha', title: 'Alpha', description: '', url: '', stack: [], order: 1, content: '' }
    ]);

    expect(getProjectSlugs('pt-BR')).toEqual(['alpha', 'beta']);
  });

  it('finds a project by slug or returns null', () => {
    const project = { slug: 'found', title: 'Found', description: '', url: '', stack: [], content: '' };
    getItems.mockReturnValue([project]);

    expect(getProject('en', 'found')).toBe(project);
    expect(getProject('en', 'missing')).toBeNull();
  });
});
