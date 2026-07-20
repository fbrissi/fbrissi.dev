import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { type Locale } from '@/lib/i18n';

type LanguageSwitcherProps = {
  locale: Locale;
  alternatePath: string;
  compact?: boolean;
};

const languages = {
  'en': { label: 'English', flag: '🇺🇸' },
  'pt-BR': { label: 'Português', flag: '🇧🇷' }
} as const;

export function LanguageSwitcher({ locale, alternatePath, compact = false }: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLang = languages[locale];
  const alternateLang = languages[locale === 'en' ? 'pt-BR' : 'en'];

  if (compact) {
    // Compact version: flag only
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          className="flex items-center justify-center rounded-lg border border-line bg-bg-soft p-2 transition-all duration-200 hover:border-line-bright hover:shadow-md"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Select language"
          aria-expanded={isOpen}
        >
          <span className="text-xl leading-none">{currentLang.flag}</span>
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 min-w-[140px] animate-[fadeIn_150ms_ease-in] rounded-lg border border-line bg-bg-card shadow-lg">
            <Link
              to={alternatePath}
              className="flex items-center gap-3 px-4 py-3 text-sm transition-colors duration-200 hover:bg-bg-soft hover:text-accent"
              onClick={() => setIsOpen(false)}
            >
              <span className="text-base leading-none">{alternateLang.flag}</span>
              <span className="font-light">{alternateLang.label}</span>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="flex items-center gap-2 rounded-lg border border-line bg-bg-soft px-3 py-2 text-sm transition-all duration-200 hover:border-line-bright hover:shadow-md"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select language"
        aria-expanded={isOpen}
      >
        <span className="text-base leading-none">{currentLang.flag}</span>
        <span className="font-light tracking-wide">{locale === 'en' ? 'EN' : 'PT'}</span>
        <svg
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 min-w-[140px] animate-[fadeIn_150ms_ease-in] rounded-lg border border-line bg-bg-card shadow-lg">
          <Link
            to={alternatePath}
            className="flex items-center gap-3 px-4 py-3 text-sm transition-colors duration-200 hover:bg-bg-soft hover:text-accent"
            onClick={() => setIsOpen(false)}
          >
            <span className="text-base leading-none">{alternateLang.flag}</span>
            <span className="font-light">{alternateLang.label}</span>
          </Link>
        </div>
      )}
    </div>
  );
}
