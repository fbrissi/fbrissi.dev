import Link from 'next/link';
import type { ReactNode } from 'react';

import profileImage from '@/assets/images/profile.png';
import { GridBackground } from '@/components/layout/grid-background';
import { SiteEffects } from '@/components/layout/site-effects';

/* c8 ignore next: Vite and Next expose imported assets with different shapes. */
const profileImageUrl = typeof profileImage === 'string' ? profileImage : profileImage.src;

export function StudyGroupShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen px-4 pb-10 pt-8 sm:px-8 sm:pt-10" lang="en">
      <GridBackground />
      <SiteEffects />
      <div className="relative z-10 mx-auto max-w-(--breakpoint-xl)">
        <header className="mb-10 flex items-center justify-between gap-4 border-b border-line pb-4">
          <Link className="flex items-center gap-3 text-sm text-text-secondary transition-colors duration-300 hover:text-accent" href="/" aria-label="fbrissi.dev home">
            <img className="h-10 w-10 rounded-full border-2 border-line" src={profileImageUrl} alt="" width={40} height={40} />
            <span>fbrissi.dev</span>
          </Link>
        </header>
        <main>{children}</main>
        <footer className="mt-16 flex flex-wrap justify-between gap-4 border-t-2 border-line pt-8 text-sm text-text-secondary">
          <p>Unlisted page · Shared with the group only</p>
        </footer>
      </div>
    </div>
  );
}
