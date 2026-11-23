import Link from 'next/link';
import type { ReactNode } from 'react';

import { GridBackground } from './grid-background';
import { activePagePaths, SiteHeader, type ActivePage } from './site-header';
import { SiteEffects } from './site-effects';
import { getArticles } from '@/lib/articles';
import { localizedPath } from '@/lib/i18n';
import { deploymentEnvironment, getMessages, getProfile } from '@/lib/site';

/** Articles appear in the header only once there are at least this many (D-4); the page stays indexed and linked from home. */
export const articlesNavThreshold = 3;

type SiteShellProps = {
  locale: 'en' | 'pt-BR';
  activePage: ActivePage;
  pathname?: string;
  /** Unlocalized path of this page in the other locale, when its slug differs. */
  alternatePathname?: string;
  children: ReactNode;
};

export function SiteShell({ locale, activePage, pathname, alternatePathname, children }: SiteShellProps) {
  const messages = getMessages(locale);
  const profile = getProfile(locale);
  const currentPath = pathname ?? activePagePaths[activePage];
  const showArticles = getArticles(locale).length >= articlesNavThreshold;

  return (
    <div className="relative min-h-screen px-4 pb-10 pt-0 sm:px-8 sm:pb-10" lang={locale}>
      <a href="#main" className="sr-only z-70 rounded-lg bg-accent px-4 py-2 text-bg focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        {messages.nav.skipToContent}
      </a>
      {deploymentEnvironment !== 'production' ? (
        <div className="pointer-events-none fixed left-1/2 top-1 z-60 -translate-x-1/2 rounded-full border border-orange-300/60 bg-orange-500 px-2 py-0.5 text-[10px] font-bold tracking-widest text-white shadow-lg sm:left-3 sm:top-3 sm:translate-x-0 sm:px-3 sm:py-1 sm:text-xs" role="status">
          {deploymentEnvironment.toUpperCase()}
        </div>
      ) : null}
      <GridBackground />
      <SiteEffects />
      <div className="relative z-10 mx-auto max-w-(--breakpoint-xl)">
        <SiteHeader locale={locale} activePage={activePage} currentPath={currentPath} alternatePath={alternatePathname} showArticles={showArticles} messages={messages} profile={profile} />
        <main id="main" tabIndex={-1} className="mb-12 p-0 focus:outline-none sm:mb-20">{children}</main>

        <footer className="mt-20 flex flex-wrap items-start justify-between gap-8 border-t-2 border-line pt-10">
          <div className="flex flex-col gap-2">
            <p className="text-base">© {new Date().getFullYear()} {profile.name}.</p>
            <p className="text-sm text-text-secondary">{messages.footer.copy}</p>
          </div>

          <nav className="flex flex-col gap-3 text-sm text-text-secondary" aria-label={messages.footer.links}>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              <Link className="transition-colors duration-300 hover:text-accent" href={localizedPath(locale, '/study-groups')}>{messages.nav.englishGroups}</Link>
              <Link className="transition-colors duration-300 hover:text-accent" href={localizedPath(locale, '/privacy')}>{messages.footer.privacy}</Link>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {profile.publicLinks.slice(0, 3).map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  className="transition-colors duration-300 hover:text-accent"
                  target="_blank"
                  rel="noreferrer"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </nav>
        </footer>
      </div>
    </div>
  );
}
