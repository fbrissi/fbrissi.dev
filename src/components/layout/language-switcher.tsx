 'use client';

import Link from 'next/link';
import { getAlternateLocale, setPreferredLocale, type Locale } from '@/lib/i18n';

type LanguageSwitcherProps = {
  locale: Locale;
  alternatePath: string;
  compact?: boolean;
};

const languages = {
  en: { label: 'English', short: 'EN' },
  'pt-BR': { label: 'Português', short: 'PT' }
} as const;

/**
 * A direct link to the same page in the other locale, labelled in that locale's own language. The compact variant shows
 * the language code and keeps it at the start of the accessible name (WCAG 2.5.3).
 */
export function LanguageSwitcher({ locale, alternatePath, compact = false }: LanguageSwitcherProps) {
  const alternateLocale = getAlternateLocale(locale);
  const alternateLang = languages[alternateLocale];

  return (
    <Link
      href={alternatePath}
      hrefLang={alternateLocale}
      lang={alternateLocale}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-bg-soft px-3 text-sm tracking-wide text-text-secondary transition-all duration-200 hover:border-line-bright hover:text-accent"
      onClick={() => setPreferredLocale(alternateLocale)}
    >
      {compact ? (
        <>
          {alternateLang.short}{' '}
          <span className="sr-only">{alternateLang.label}</span>
        </>
      ) : alternateLang.label}
    </Link>
  );
}
