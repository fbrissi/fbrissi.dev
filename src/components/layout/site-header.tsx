 'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import profileImage from '@/assets/images/profile.webp';
import enMessages from '@/i18n/messages/en.json';
import ptMessages from '@/i18n/messages/pt-BR.json';
import enProfile from '@/content/profile/en.json';
import ptProfile from '@/content/profile/pt-BR.json';
import { getAlternateLocale, localizedPath, type Locale } from '@/lib/i18n';
import type { Messages, Profile } from '@/lib/site';
import { LanguageSwitcher } from './language-switcher';
import { ResumeDownloadMenu } from './resume-download-menu';

/* c8 ignore next: Vite and Next expose imported assets with different shapes. */
const profileImageUrl = typeof profileImage === 'string' ? profileImage : profileImage.src;

export type ActivePage = 'home' | 'about' | 'projects' | 'works' | 'articles' | 'contact' | 'studyGroups' | 'privacy';

export const activePagePaths: Record<ActivePage, string> = {
  home: '/',
  about: '/about',
  projects: '/projects',
  works: '/works',
  articles: '/articles',
  contact: '/contact',
  studyGroups: '/study-groups',
  privacy: '/privacy'
};

type SiteHeaderProps = {
  locale: Locale;
  activePage: ActivePage;
  currentPath?: string;
  /** Unlocalized path of this page in the other locale, when its slug differs. */
  alternatePath?: string;
  /** Articles join the navigation once there are enough of them (D-4). */
  showArticles?: boolean;
  messages?: Messages;
  profile?: Pick<Profile, 'name' | 'shortName' | 'publicLinks'>;
};

const navItems = [
  { key: 'home', labelKey: 'home', path: '/' },
  { key: 'about', labelKey: 'aboutMe', path: '/about' },
  { key: 'works', labelKey: 'works', path: '/works' },
  { key: 'projects', labelKey: 'projects', path: '/projects' },
  { key: 'studyGroups', labelKey: 'englishGroups', path: '/study-groups' },
  { key: 'articles', labelKey: 'articles', path: '/articles' },
  { key: 'contact', labelKey: 'contact', path: '/contact' }
] as const;

export function SiteHeader({ locale, activePage, currentPath, alternatePath, showArticles = false, messages: providedMessages, profile: providedProfile }: SiteHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const messages = providedMessages ?? (locale === 'pt-BR' ? ptMessages : enMessages);
  const profile = providedProfile ?? (locale === 'pt-BR' ? ptProfile : enProfile);
  const path = currentPath ?? activePagePaths[activePage];
  const languageHref = localizedPath(getAlternateLocale(locale), alternatePath ?? path);
  const items = navItems.filter((item) => item.key !== 'articles' || showArticles);
  const isHome = activePage === 'home';

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 24);
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      // A nested popup (the resume menu) prevents the default when it handles Escape itself.
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      setIsMenuOpen(false);
      menuButtonRef.current!.focus();
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isMenuOpen]);

  const linkClass = (key: string) => `relative whitespace-nowrap tracking-wide transition-colors duration-300 hover:text-accent ${
    activePage === key ? 'text-accent after:absolute after:bottom-[-4px] after:left-0 after:h-px after:w-full after:bg-accent' : 'text-text-secondary'
  }`;
  // "page" only on the exact page; a detail page marks its section with "true" (QA-F4).
  const ariaCurrent = (key: string, itemPath: string) => (activePage !== key ? undefined : path === itemPath ? 'page' : 'true');

  return (
    <header className={`site-header-shell sticky top-0 z-50 mb-12 sm:mb-16 sm:border-b sm:border-line ${isScrolled || isMenuOpen ? 'site-header-shell-fixed' : ''}`}>
      {/* Mobile: avatar, name, language and a menu disclosure with 44px rows */}
      <div className="-mx-4 border-b border-line px-4 py-3 sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link className="flex min-w-0 items-center gap-3" href={localizedPath(locale, '/')}>
            <img className="h-11 w-11 shrink-0 rounded-full border-2 border-line" src={profileImageUrl} alt="" width={44} height={44} />
            <span className="truncate text-base">{profile.shortName}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher locale={locale} alternatePath={languageHref} compact />
            <button
              ref={menuButtonRef}
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line bg-bg-soft px-3 text-sm text-text-secondary transition-colors duration-200 hover:border-line-bright hover:text-accent"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-navigation"
              aria-label={isMenuOpen ? messages.nav.closeMenu : messages.nav.menu}
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {isMenuOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
              <span>{messages.nav.menu}</span>
            </button>
          </div>
        </div>
        {isMenuOpen && (
          <nav id="mobile-navigation" className="mt-3" aria-label={messages.nav.primary}>
            <ul className="flex flex-col">
              {items.map((item) => (
                <li key={item.key} className="border-t border-line">
                  <Link
                    className={`flex min-h-11 items-center tracking-wide transition-colors duration-300 hover:text-accent ${activePage === item.key ? 'text-accent' : 'text-text-secondary'}`}
                    href={localizedPath(locale, item.path)}
                    aria-current={ariaCurrent(item.key, item.path)}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {messages.nav[item.labelKey]}
                  </Link>
                </li>
              ))}
              <li className="border-t border-line">
                <ResumeDownloadMenu locale={locale} resumeLabel={messages.nav.resume} buttonClassName="min-h-11 w-full" />
              </li>
            </ul>
          </nav>
        )}
      </div>

      {/* Desktop: the large profile header only on home; inner pages start compact (L-2) */}
      <div className={`site-header-desktop-shell relative hidden sm:block ${isHome ? '' : 'site-header-compact'}`}>
        <div className={`absolute right-0 z-10 ${isHome ? 'top-0' : 'top-1/2 -translate-y-1/2'}`}>
          <LanguageSwitcher locale={locale} alternatePath={languageHref} />
        </div>

        <div className="site-header-desktop-stack flex flex-col items-center">
          <Link className="site-header-desktop-avatar border-2 border-line shadow-lg transition-transform duration-300 hover:scale-105" href={localizedPath(locale, '/')}>
            <img className="h-full w-full object-cover" src={profileImageUrl} alt={profile.name} width={150} height={150} />
          </Link>

          {isHome && (
            <Link className="site-header-desktop-name group inline-block overflow-hidden" href={localizedPath(locale, '/')}>
              <p className="whitespace-nowrap text-center text-3xl tracking-tight transition-colors duration-300 group-hover:text-accent">
                {profile.name}
              </p>
            </Link>
          )}

          <nav className="site-header-desktop-nav flex flex-wrap justify-center text-base" aria-label={messages.nav.primary}>
            {items.map((item) => (
              <Link
                key={item.key}
                className={linkClass(item.key)}
                href={localizedPath(locale, item.path)}
                aria-current={ariaCurrent(item.key, item.path)}
              >
                {messages.nav[item.labelKey]}
              </Link>
            ))}
            <ResumeDownloadMenu locale={locale} resumeLabel={messages.nav.resume} />
          </nav>
        </div>
      </div>
    </header>
  );
}
