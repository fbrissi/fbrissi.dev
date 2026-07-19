import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';

import profileImage from '@/assets/images/profile.png';
import { getAlternateLocale, localizedPath, normalizeRoute, type Locale } from '@/lib/i18n';
import { getMessages, getProfile } from '@/lib/site';
import { LanguageSwitcher } from './language-switcher';
import { ResumeDownloadMenu } from './resume-download-menu';

type SiteHeaderProps = {
  locale: Locale;
  activePage: 'home' | 'about' | 'projects' | 'openSource' | 'works' | 'articles' | 'contact';
};

const navItems = [
  { key: 'home', labelKey: 'home', path: '/' },
  { key: 'projects', labelKey: 'projects', path: '/projects' },
  { key: 'openSource', labelKey: 'openSource', path: '/open-source' },
  { key: 'works', labelKey: 'works', path: '/works' },
  { key: 'articles', labelKey: 'articles', path: '/articles' },
  { key: 'contact', labelKey: 'contact', path: '/contact' }
] as const;

export function SiteHeader({ locale, activePage }: SiteHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(() => window.scrollY > 24);
  const location = useLocation();
  const messages = getMessages(locale);
  const profile = getProfile(locale);
  const alternateLocale = getAlternateLocale(locale);

  const currentPath = normalizeRoute(location.pathname);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 24);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`site-header-shell sticky top-0 z-50 mb-16 sm:border-b sm:border-line ${isScrolled ? 'site-header-shell-fixed' : ''}`}>
      {/* Mobile: always compact horizontal layout */}
      <div className="mb-8 flex items-center justify-between gap-4 border-b border-line px-4 py-4 sm:hidden">
        <Link className="flex-shrink-0 transition-transform duration-300 hover:scale-105" to={localizedPath(locale, '/')}>
          <img
            className="h-[50px] w-[50px] rounded-full border-2 border-line shadow-lg"
            src={profileImage}
            alt={profile.name} 
            width={50} 
            height={50} 
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
              to={localizedPath(locale, item.path)}
            >
              {messages.nav[item.labelKey]}
            </Link>
          ))}
          <ResumeDownloadMenu locale={locale} compact />
        </nav>

        <div className="flex-shrink-0">
          <LanguageSwitcher locale={locale} alternatePath={localizedPath(alternateLocale, currentPath)} compact />
        </div>
      </div>

      {/* Desktop: layout with smooth scroll-driven transition */}
      <div className="site-header-desktop-shell relative hidden sm:block">
        <div className="absolute right-0 top-0 z-10">
          <LanguageSwitcher locale={locale} alternatePath={localizedPath(alternateLocale, currentPath)} />
        </div>

        {/* Always-centered container */}
        <div className="site-header-desktop-stack flex flex-col items-center">
          {/* Avatar with size transition */}
          <Link className="site-header-desktop-avatar border-2 border-line shadow-lg transition-transform duration-300 hover:scale-105" to={localizedPath(locale, '/')}>
            <img
              className="h-full w-full object-cover"
              src={profileImage}
              alt={profile.name}
            />
          </Link>

          {/* Name fades out when scrolled */}
          <Link
            className="site-header-desktop-name group inline-block overflow-hidden"
            to={localizedPath(locale, '/')}
          >
            <h1 className="whitespace-nowrap text-center text-3xl font-normal tracking-tight transition-colors duration-300 group-hover:text-accent">
              {profile.name}
            </h1>
          </Link>

          {/* Navigation */}
          <nav className="site-header-desktop-nav flex flex-wrap justify-center text-base" aria-label={messages.nav.primary}>
            {navItems.map((item) => (
              <Link
                key={item.key}
                className={`relative font-light tracking-wide transition-colors duration-300 hover:text-accent ${
                  activePage === item.key 
                    ? 'text-accent after:absolute after:bottom-[-4px] after:left-0 after:h-[1px] after:w-full after:bg-accent' 
                    : 'text-text-secondary'
                }`}
                to={localizedPath(locale, item.path)}
              >
                {messages.nav[item.labelKey]}
              </Link>
            ))}
            <ResumeDownloadMenu locale={locale} />
          </nav>
        </div>
      </div>
    </header>
  );
}
