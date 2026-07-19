import type { Locale } from './i18n';
import { parseMarkdown } from './markdown';

const markdownSources = import.meta.glob<string>('/src/content/{projects,works}/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
});

export type MarkdownCollectionItem<TFrontMatter extends Record<string, unknown>> = TFrontMatter & {
  slug: string;
  content: string;
};

export function getMarkdownCollectionSlugs(collection: string, locale: Locale): string[] {
  const prefix = `/src/content/${collection}/${locale}/`;
  return Object.keys(markdownSources)
    .filter((fileName) => fileName.startsWith(prefix))
    .map((fileName) => fileName.slice(prefix.length).replace(/\.md$/, ''))
    .sort();
}

export function readMarkdownCollectionItem<TFrontMatter extends Record<string, unknown>>(
  collection: string,
  locale: Locale,
  slug: string
): MarkdownCollectionItem<TFrontMatter> | null {
  const source = markdownSources[`/src/content/${collection}/${locale}/${slug}.md`];
  if (!source) {
    return null;
  }
  const { data, content } = parseMarkdown<TFrontMatter>(source);

  return {
    ...data,
    slug,
    content
  };
}

export function getMarkdownCollectionItems<TFrontMatter extends Record<string, unknown>>(
  collection: string,
  locale: Locale
): Array<MarkdownCollectionItem<TFrontMatter>> {
  return getMarkdownCollectionSlugs(collection, locale)
    .map((slug) => readMarkdownCollectionItem<TFrontMatter>(collection, locale, slug))
    .filter((item): item is MarkdownCollectionItem<TFrontMatter> => item !== null);
}
