import Link from 'next/link';
import type { ReactNode } from 'react';

import profileImage from '@/assets/images/profile.webp';
import { GridBackground } from '@/components/layout/grid-background';
import { SiteEffects } from '@/components/layout/site-effects';
import { AccountNav, ConsentBanner } from '@/features/study-group/app-chrome';
import { CookieNotice } from '@/features/study-group/cookie-notice';
import { SessionProvider } from '@/features/study-group/session';
import { STUDY_GROUPS_EMAIL } from '@/workers/study-group/contract';

/* c8 ignore next: Vite and Next expose imported assets with different shapes. */
const profileImageUrl = typeof profileImage === 'string' ? profileImage : profileImage.src;

/** English-only chrome of the signed-in study group pages (board, settings, account, admin). */
export function StudyGroupShell({ apiUrl, children }: { apiUrl?: string; children: ReactNode }) {
  return (
    <SessionProvider apiUrl={apiUrl}>
      <div className="relative min-h-screen px-4 pb-10 pt-8 sm:px-8 sm:pt-10" lang="en">
        <GridBackground />
        <SiteEffects />
        <div className="relative z-10 mx-auto max-w-(--breakpoint-xl)">
          <header className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
            <Link className="flex items-center gap-3 text-sm text-text-secondary transition-colors duration-300 hover:text-accent" href="/" aria-label="fbrissi.dev home">
              <img className="h-10 w-10 rounded-full border-2 border-line" src={profileImageUrl} alt="" width={40} height={40} />
              <span>fbrissi.dev</span>
            </Link>
            <AccountNav />
          </header>
          <main>
            <ConsentBanner />
            {children}
          </main>
          <footer className="mt-16 flex flex-wrap justify-between gap-4 border-t-2 border-line pt-8 text-sm text-text-secondary">
            <p>English study groups · Free program by Filipe Bojikian Rissi</p>
            <nav aria-label="Policies" className="flex flex-wrap gap-4">
              <a className="hover:text-accent" href="/study-groups/terms">Terms of Use</a>
              <a className="hover:text-accent" href="/privacy">Privacy Policy</a>
              <a className="hover:text-accent" href={`mailto:${STUDY_GROUPS_EMAIL}`}>{STUDY_GROUPS_EMAIL}</a>
            </nav>
          </footer>
        </div>
        <CookieNotice locale="en" />
      </div>
    </SessionProvider>
  );
}
