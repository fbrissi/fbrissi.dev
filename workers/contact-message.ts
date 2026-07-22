export const contactLocales = ['en', 'pt-BR'] as const;
export const contactEnvironments = ['production', 'sandbox', 'local'] as const;

export type ContactLocale = (typeof contactLocales)[number];
export type ContactEnvironment = (typeof contactEnvironments)[number];

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
  locale: ContactLocale;
  environment?: ContactEnvironment;
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

export function resolveContactEnvironment(value: unknown): ContactEnvironment {
  return contactEnvironments.includes(value as ContactEnvironment) ? value as ContactEnvironment : 'production';
}
