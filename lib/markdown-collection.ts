import fs from 'node:fs';
import path from 'node:path';

import matter from 'gray-matter';

import type { Locale } from './i18n';

const contentRoot = path.join(process.cwd(), 'content');

export type MarkdownCollectionItem<TFrontMatter extends Record<string, unknown>> = TFrontMatter & {
  slug: string;
  content: string;
};

function getCollectionDir(collection: string, locale: Locale): string {
  return path.join(contentRoot, collection, locale);
}

export function getMarkdownCollectionSlugs(collection: string, locale: Locale): string[] {
  const directory = getCollectionDir(collection, locale);

  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory)
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => fileName.replace(/\.md$/, ''))
    .sort();
}

export function readMarkdownCollectionItem<TFrontMatter extends Record<string, unknown>>(
  collection: string,
  locale: Locale,
  slug: string
): MarkdownCollectionItem<TFrontMatter> | null {
  const filePath = path.join(getCollectionDir(collection, locale), `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(source);

  return {
    ...(data as TFrontMatter),
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
