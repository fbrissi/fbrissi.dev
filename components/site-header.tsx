"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

import { getAlternateLocale, localizedPath, type Locale } from '@/lib/i18n';
import { getMessages, getProfile } from '@/lib/site';
import { LanguageSwitcher } from './language-switcher';

type SiteHeaderProps = {
  locale: Locale;
  activePage: 'home' | 'about' | 'projects' | 'works' | 'articles' | 'contact';
};

const navItems = [
  { key: 'projects', labelKey: 'projects', path: '/projects' },
  { key: 'works', labelKey: 'works', path: '/works' },
  { key: 'articles', labelKey: 'articles', path: '/articles' },
  { key: 'contact', labelKey: 'contact', path: '/contact' }
] as const;

export function SiteHeader({ locale, activePage }: SiteHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const messages = getMessages(locale);
  const profile = getProfile(locale);
  const alternateLocale = getAlternateLocale(locale);

  const avatarUrl = 'https://www.gravatar.com/avatar/4d13d720e5104e8dc0272582f48cf25f?s=256&d=identicon&r=pg';

  const currentPath = navItems.find((item) => item.key === activePage)?.path ?? '/';

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 20);
    }

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-50 transition-all duration-500 ${isScrolled ? 'bg-bg/95 shadow-xl backdrop-blur-sm' : 'mb-16 border-b border-line'}`}>
      {/* Mobile: Layout horizontal compacto sempre */}
      <div className="mb-8 flex items-center justify-between gap-4 border-b border-line px-4 py-4 sm:hidden">
        <Link className="flex-shrink-0 transition-transform duration-300 hover:scale-105" href={localizedPath(locale, '/')}>
          <Image 
            className="h-[50px] w-[50px] rounded-full border-2 border-line shadow-lg"
            src={avatarUrl} 
            alt={profile.name} 
            width={50} 
            height={50} 
            priority 
            unoptimized 
          />
        </Link>

        <nav className="flex flex-1 flex-wrap justify-center gap-3 text-sm" aria-label={messages.nav.primary}>
          {navItems.map((item) => (
            <Link
              key={item.key}
              className={`relative font-light tracking-wide transition-colors duration-300 hover:text-accent ${
                activePage === item.key 
                  ? 'text-accent after:absolute after:bottom-[-4px] after:left-0 after:h-[1px] after:w-full after:bg-accent' 
                  : 'text-text-secondary'
              }`}
              href={localizedPath(locale, item.path)}
            >
              {messages.nav[item.labelKey]}
            </Link>
          ))}
        </nav>

        <div className="flex-shrink-0">
          <LanguageSwitcher locale={locale} alternatePath={localizedPath(alternateLocale, currentPath)} compact />
        </div>
      </div>

      {/* Desktop: Layout com transição suave */}
      <div className={`relative hidden transition-all duration-500 sm:block ${isScrolled ? 'py-3' : 'py-10 pb-12'}`}>
        <div className="absolute right-0 top-0 z-10">
          <LanguageSwitcher locale={locale} alternatePath={localizedPath(alternateLocale, currentPath)} />
        </div>

        {/* Container centralizado sempre */}
        <div className="flex flex-col items-center gap-4 transition-all duration-500">
          {/* Avatar com transição de tamanho */}
          <Link className="inline-block transition-transform duration-300 hover:scale-105" href={localizedPath(locale, '/')}>
            <Image 
              className={`rounded-full border-2 border-line shadow-lg transition-all duration-500 ${isScrolled ? 'h-[60px] w-[60px]' : 'h-[150px] w-[150px]'}`}
              src={avatarUrl} 
              alt={profile.name} 
              width={150} 
              height={150} 
              priority 
              unoptimized 
            />
          </Link>

          {/* Nome com fade out quando scrolled */}
          <Link 
            className={`group inline-block overflow-hidden transition-all duration-500 ${isScrolled ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100'}`} 
            href={localizedPath(locale, '/')}
          >
            <h1 className="whitespace-nowrap text-center text-3xl font-normal tracking-tight transition-colors duration-300 group-hover:text-accent">
              {profile.name}
            </h1>
          </Link>

          {/* Navegação */}
          <nav className="flex flex-wrap justify-center gap-6 text-base" aria-label={messages.nav.primary}>
            {navItems.map((item) => (
              <Link
                key={item.key}
                className={`relative font-light tracking-wide transition-colors duration-300 hover:text-accent ${
                  activePage === item.key 
                    ? 'text-accent after:absolute after:bottom-[-4px] after:left-0 after:h-[1px] after:w-full after:bg-accent' 
                    : 'text-text-secondary'
                }`}
                href={localizedPath(locale, item.path)}
              >
                {messages.nav[item.labelKey]}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
