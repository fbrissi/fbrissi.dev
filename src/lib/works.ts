import { getMarkdownCollectionItems, type MarkdownCollectionItem } from './markdown-collection';
import type { Locale } from './i18n';

const collectionName = 'works';

type WorkFrontMatter = {
  company: string;
  title: string;
  dateRange: string;
  summary: string;
  location: string;
  employmentType: string;
  companyUrl: string;
  logo: string;
  skills: string[];
  startDate: string;
  endDate?: string;
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
    // Current roles (no end date) first, then newest start date first (D-2).
    .sort((left, right) => Number(Boolean(left.endDate)) - Number(Boolean(right.endDate)) || right.startDate.localeCompare(left.startDate) || left.company.localeCompare(right.company));
}
