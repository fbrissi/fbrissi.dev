import { getMarkdownCollectionItems, type MarkdownCollectionItem } from './markdown-collection';
import type { Locale } from './i18n';

const collectionName = 'projects';

type ProjectFrontMatter = {
  title: string;
  description: string;
  url: string;
  stack: string[];
  order?: number;
};

export type ProjectItem = MarkdownCollectionItem<ProjectFrontMatter>;

export function getProjectSlugs(locale: Locale): string[] {
  return getProjects(locale).map((project) => project.slug);
}

export function getProject(locale: Locale, slug: string): ProjectItem | null {
  return getProjects(locale).find((project) => project.slug === slug) ?? null;
}

export function getProjects(locale: Locale): ProjectItem[] {
  return getMarkdownCollectionItems<ProjectFrontMatter>(collectionName, locale)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.title.localeCompare(right.title));
}
