import enMessages from '@/messages/en.json';
import ptMessages from '@/messages/pt-BR.json';
import enProfile from '@/content/profile/en.json';
import ptProfile from '@/content/profile/pt-BR.json';

import type { Locale } from './i18n';

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fbrissi.dev';

export const messages = {
  en: enMessages,
  'pt-BR': ptMessages
} as const;

export const profiles = {
  en: enProfile,
  'pt-BR': ptProfile
} as const;

export type Messages = (typeof messages)['en'];
export type Profile = (typeof profiles)['en'];

export function getMessages(locale: Locale): Messages {
  return messages[locale] ?? messages.en;
}

export function getProfile(locale: Locale): Profile {
  return profiles[locale] ?? profiles.en;
}
