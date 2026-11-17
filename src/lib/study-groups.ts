import { programDocumentSources } from '@/generated/content-data';

import type { Locale } from './i18n';
import { parseMarkdown } from './markdown';

export type ProgramDocumentName = 'terms' | 'privacy';

export interface ProgramDocument {
  title: string;
  description: string;
  version: string;
  content: string;
}

export const programPaths = {
  landing: '/study-groups',
  terms: '/study-groups/terms',
  privacy: '/study-groups/privacy'
} as const;

export function getProgramDocument(locale: Locale, name: ProgramDocumentName): ProgramDocument {
  const { data, content } = parseMarkdown<Omit<ProgramDocument, 'content'>>(programDocumentSources[locale][name]);
  return { ...data, content };
}
