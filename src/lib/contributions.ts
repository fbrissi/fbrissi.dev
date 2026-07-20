import { getMarkdownCollectionItems, type MarkdownCollectionItem } from './markdown-collection';
import type { Locale } from './i18n';

const collectionName = 'contributions';

export type ContributionEvidence = {
  label: string;
  url: string;
};

type ContributionFrontMatter = {
  title: string;
  repository: string;
  repositoryUrl: string;
  description: string;
  period: string;
  tags: string[];
  evidence: ContributionEvidence[];
  featured?: boolean;
  order?: number;
};

export type Contribution = MarkdownCollectionItem<ContributionFrontMatter>;

export function getContributionSlugs(locale: Locale): string[] {
  return getContributions(locale).map((contribution) => contribution.slug);
}

export function getContribution(locale: Locale, slug: string): Contribution | null {
  return getContributions(locale).find((contribution) => contribution.slug === slug) ?? null;
}

export function getContributions(locale: Locale): Contribution[] {
  return getMarkdownCollectionItems<ContributionFrontMatter>(collectionName, locale)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.title.localeCompare(right.title));
}
