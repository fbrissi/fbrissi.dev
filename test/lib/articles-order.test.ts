import { describe, expect, it, vi } from 'vitest';

vi.mock('@/generated/content-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/generated/content-data')>()),
  markdownSources: {
    'articles/en/older': '---\ntitle: Older\ndescription: Older article\ndate: 2025-01-10\n---\nOlder content',
    'articles/en/newer': '---\ntitle: Newer\ndescription: Newer article\ndate: 2026-03-20\n---\nNewer content',
  },
}));

import { getArticles } from '@/lib/articles';

describe('article ordering', () => {
  it('sorts several articles newest first', () => {
    expect(getArticles('en').map((article) => article.slug)).toEqual(['newer', 'older']);
  });
});
