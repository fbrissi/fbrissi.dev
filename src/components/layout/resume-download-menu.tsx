 'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

import type { Locale } from '@/lib/i18n';

const resumeFiles = [
  { label: 'English', href: '/resume/filipe-bojikian-rissi-resume-en.pdf', language: 'EN' },
  { label: 'Português', href: '/resume/filipe-bojikian-rissi-curriculo-pt-br.pdf', language: 'PT' }
];

/**
 * Menu button (WAI-ARIA APG): opening moves focus into the menu; arrows, Home and End move between items; Escape closes
 * it and returns focus to the button; Tab closes it and continues from the button. The menu is portaled because the
 * desktop header clips overflow, so focus is managed here instead of following the DOM order.
 */
export function ResumeDownloadMenu({ locale, resumeLabel = 'Baixar currículo', buttonClassName = '' }: { locale: Locale; resumeLabel?: string; buttonClassName?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  // The page's own language comes first.
  const files = locale === 'pt-BR' ? [...resumeFiles].reverse() : resumeFiles;
  const [initialFocus, setInitialFocus] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [position, setPosition] = useState({ right: 0, top: 0 });

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !dropdownRef.current?.contains(target)) setIsOpen(false);
    }

    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;

    function updatePosition() {
      const bounds = buttonRef.current?.getBoundingClientRect();
      /* v8 ignore else -- the button stays mounted while the menu is open. */
      if (bounds) setPosition({ right: window.innerWidth - bounds.right, top: bounds.bottom + 12 });
    }

    updatePosition();
    itemRefs.current[initialFocus]!.focus();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, initialFocus]);

  function open(focusIndex: number) {
    setInitialFocus(focusIndex);
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    buttonRef.current!.focus();
  }

  function onButtonKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open(event.key === 'ArrowDown' ? 0 : files.length - 1);
    }
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const current = itemRefs.current.indexOf(document.activeElement as HTMLAnchorElement);
    const last = files.length - 1;
    const targets: Record<string, number> = { ArrowDown: current === last ? 0 : current + 1, ArrowUp: current <= 0 ? last : current - 1, Home: 0, End: last };

    if (event.key in targets) {
      event.preventDefault();
      itemRefs.current[targets[event.key]]!.focus();
    } else if (event.key === 'Escape') {
      // Handled here so an enclosing disclosure (the mobile menu) stays open.
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      close();
    }
  }

  return (
    <div className="relative" ref={menuRef} data-locale={locale}>
      <button
        ref={buttonRef}
        className={`flex items-center gap-1.5 tracking-wide text-text-secondary transition-colors duration-300 hover:text-accent ${buttonClassName}`}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={isOpen ? 'resume-menu' : undefined}
        onClick={() => (isOpen ? setIsOpen(false) : open(0))}
        onKeyDown={onButtonKeyDown}
      >
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{resumeLabel}</span>
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          id="resume-menu"
          className="fixed z-100 min-w-48 overflow-hidden rounded-lg border border-line bg-bg-card shadow-xl"
          style={position}
          role="menu"
          aria-label={resumeLabel}
          onKeyDown={onMenuKeyDown}
        >
          {files.map((resume, index) => (
            <a
              key={resume.language}
              ref={(element) => { itemRefs.current[index] = element; }}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-text-secondary transition-colors duration-200 hover:bg-bg-soft hover:text-accent focus:bg-bg-soft focus:text-accent"
              href={resume.href}
              download
              role="menuitem"
              tabIndex={-1}
              onClick={close}
            >
              <span>{resume.label}</span>
              <span className="text-xs text-text-muted">{resume.language} PDF</span>
            </a>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
