import { describe, expect, it } from 'vitest';

import { parseMarkdown } from '@/lib/markdown';

describe('markdown frontmatter', () => {
  it('parses YAML metadata and preserves Markdown content', () => {
    expect(parseMarkdown<{ title: string; tags: string[] }>('---\ntitle: Example\ntags:\n  - vite\n---\n\nBody')).toEqual({
      data: { title: 'Example', tags: ['vite'] },
      content: '\nBody'
    });
  });

  it('rejects Markdown without frontmatter', () => {
    expect(() => parseMarkdown('Body')).toThrow('Markdown content must start with YAML frontmatter');
  });
});
