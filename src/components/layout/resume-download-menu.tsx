 'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Locale } from '@/lib/i18n';

const resumeFiles = [
  { label: 'English', href: '/resume/filipe-bojikian-rissi-resume-en.pdf', language: 'EN' },
  { label: 'Português', href: '/resume/filipe-bojikian-rissi-curriculo-pt-br.pdf', language: 'PT' }
];

export function ResumeDownloadMenu({ locale, resumeLabel = 'Baixar currículo', compact = false }: { locale: Locale; resumeLabel?: string; compact?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ right: 0, top: 0 });

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !dropdownRef.current?.contains(target)) setIsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) return;

    function updatePosition() {
      const bounds = buttonRef.current?.getBoundingClientRect();
      if (bounds) setPosition({ right: window.innerWidth - bounds.right, top: bounds.bottom + 12 });
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={menuRef} data-locale={locale}>
      <button
        ref={buttonRef}
        className="flex items-center gap-1.5 font-light tracking-wide text-text-secondary transition-colors duration-300 hover:text-accent"
        type="button"
         aria-label={resumeLabel}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{compact ? 'CV' : resumeLabel}</span>
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[100] min-w-48 overflow-hidden rounded-lg border border-line bg-bg-card shadow-xl"
          style={position}
          role="menu"
        >
          {resumeFiles.map((resume) => (
            <a
              key={resume.language}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-text-secondary transition-colors duration-200 hover:bg-bg-soft hover:text-accent"
              href={resume.href}
              download
              role="menuitem"
              onClick={() => setIsOpen(false)}
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
