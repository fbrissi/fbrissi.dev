import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { GridBackground } from './grid-background';
import { SiteHeader } from './site-header';
import { getMessages, getProfile } from '@/lib/site';

type SiteShellProps = {
  locale: 'en' | 'pt-BR';
  activePage: 'home' | 'about' | 'projects' | 'openSource' | 'works' | 'articles' | 'contact';
  children: ReactNode;
};

export function SiteShell({ locale, activePage, children }: SiteShellProps) {
  const messages = getMessages(locale);
  const profile = getProfile(locale);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function activateAt(clientX: number, clientY: number) {
      const x = (clientX / window.innerWidth) * 100;
      const y = (clientY / window.innerHeight) * 100;
      
      document.body.style.setProperty('--mouse-x', `${x}%`);
      document.body.style.setProperty('--mouse-y', `${y}%`);
      
      document.body.classList.add('mouse-active');
      
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        document.body.classList.remove('mouse-active');
      }, 3000);
    }

    function handleMouseMove(event: MouseEvent) {
      activateAt(event.clientX, event.clientY);
    }

    function handleTouch(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch) activateAt(touch.clientX, touch.clientY);
    }

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleTouch, { passive: true });
    window.addEventListener('touchmove', handleTouch, { passive: true });
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('touchmove', handleTouch);
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div className="relative min-h-screen px-4 pb-10 pt-8 sm:px-8 sm:pb-10 sm:pt-0" lang={locale}>
      <GridBackground />
      <div className="relative z-10 mx-auto max-w-screen-xl">
        <SiteHeader locale={locale} activePage={activePage} />
        <main className="mb-12 p-0 sm:mb-20">{children}</main>

        <footer className="mt-20 flex flex-wrap items-start justify-between gap-8 border-t-2 border-line pt-10">
          <div className="flex flex-col gap-2">
            <p className="text-base font-normal">© {new Date().getFullYear()} {profile.name}.</p>
            <p className="text-sm text-text-secondary">{messages.footer.copy}</p>
          </div>

          <div className="flex gap-4 text-sm text-text-secondary">
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
        </footer>
      </div>
    </div>
  );
}
