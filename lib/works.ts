import { getMarkdownCollectionItems, type MarkdownCollectionItem } from './markdown-collection';
import type { Locale } from './i18n';

const collectionName = 'works';

type WorkFrontMatter = {
  company: string;
  title: string;
  dateRange: string;
  summary: string;
  order?: number;
};

export type WorkEntry = MarkdownCollectionItem<WorkFrontMatter>;

export function getWorkSlugs(locale: Locale): string[] {
  return getWorks(locale).map((work) => work.slug);
}

export function getWork(locale: Locale, slug: string): WorkEntry | null {
  return getWorks(locale).find((work) => work.slug === slug) ?? null;
}

export function getWorks(locale: Locale): WorkEntry[] {
  return getMarkdownCollectionItems<WorkFrontMatter>(collectionName, locale)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.company.localeCompare(right.company));
}
