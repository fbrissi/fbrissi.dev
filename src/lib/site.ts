import enMessages from '@/i18n/messages/en.json';
import ptMessages from '@/i18n/messages/pt-BR.json';
import enProfile from '@/content/profile/en.json';
import enProfileMarkdown from '@/content/profile/en.md?raw';
import ptProfile from '@/content/profile/pt-BR.json';
import ptProfileMarkdown from '@/content/profile/pt-BR.md?raw';

import type { Locale } from './i18n';
import { parseMarkdown } from './markdown';

export const siteUrl = import.meta.env.VITE_SITE_URL ?? 'https://fbrissi.dev';

export const messages = {
  en: enMessages,
  'pt-BR': ptMessages
} as const;

type ProfileFrontMatter = {
  headline: string;
  summary: string;
};

const enProfileContent = parseMarkdown<ProfileFrontMatter>(enProfileMarkdown);
const ptProfileContent = parseMarkdown<ProfileFrontMatter>(ptProfileMarkdown);

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
