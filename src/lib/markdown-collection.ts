import type { Locale } from './i18n';
import { parseMarkdown } from './markdown';
import { markdownSources } from '@/generated/content-data';

export type MarkdownCollectionItem<TFrontMatter extends Record<string, unknown>> = TFrontMatter & {
  slug: string;
  content: string;
};

export function getMarkdownCollectionSlugs(collection: string, locale: Locale): string[] {
  const prefix = `${collection}/${locale}/`;
  return Object.keys(markdownSources)
    .filter((fileName) => fileName.startsWith(prefix))
    .map((fileName) => fileName.slice(prefix.length))
    .sort();
}

export function readMarkdownCollectionItem<TFrontMatter extends Record<string, unknown>>(
  collection: string,
  locale: Locale,
  slug: string
): MarkdownCollectionItem<TFrontMatter> | null {
  const source = markdownSources[`${collection}/${locale}/${slug}` as keyof typeof markdownSources];
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
