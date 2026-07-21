export const contactLocales = ['en', 'pt-BR'] as const;

export type ContactLocale = (typeof contactLocales)[number];

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
  locale: ContactLocale;
}

export interface ContactFormRequest extends ContactMessage {
  'cf-turnstile-response': string;
}

export function isContactLocale(value: unknown): value is ContactLocale {
  return contactLocales.includes(value as ContactLocale);
}

export function resolveContactLocale(value: unknown): ContactLocale {
  return isContactLocale(value) ? value : 'en';
}
