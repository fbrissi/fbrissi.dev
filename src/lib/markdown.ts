import { parse } from 'yaml';

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseMarkdown<T extends Record<string, unknown>>(source: string): { data: T; content: string } {
  const match = source.match(frontmatterPattern);
  if (!match) {
    throw new Error('Markdown content must start with YAML frontmatter');
  }

  return {
    data: parse(match[1]) as T,
    content: match[2]
  };
}
