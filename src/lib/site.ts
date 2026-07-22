import enMessages from '@/i18n/messages/en.json';
import ptMessages from '@/i18n/messages/pt-BR.json';
import enProfile from '@/content/profile/en.json';
import ptProfile from '@/content/profile/pt-BR.json';

import type { Locale } from './i18n';
import { parseMarkdown } from './markdown';
import { profileSources } from '@/generated/content-data';

/* c8 ignore next: Vite is retained only as a migration fallback. */
export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VITE_SITE_URL ?? 'https://fbrissi.dev';

export const messages = {
  en: enMessages,
  'pt-BR': ptMessages
} as const;

type ProfileFrontMatter = {
  headline: string;
  summary: string;
};

function readProfileMarkdown(locale: Locale): { data: ProfileFrontMatter; content: string } {
  return parseMarkdown<ProfileFrontMatter>(profileSources[locale]);
}

const enProfileContent = readProfileMarkdown('en');
const ptProfileContent = readProfileMarkdown('pt-BR');

export const profiles = {
  en: { ...enProfile, ...enProfileContent.data, about: enProfileContent.content },
  'pt-BR': { ...ptProfile, ...ptProfileContent.data, about: ptProfileContent.content }
} as const;

export type Messages = (typeof messages)['en'];
export type Profile = (typeof profiles)['en'];

export function getMessages(locale: Locale): Messages {
  return messages[locale] ?? messages.en;
}

export function getProfile(locale: Locale): Profile {
  return profiles[locale] ?? profiles.en;
}
