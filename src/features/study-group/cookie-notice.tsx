'use client';

import { useEffect, useState } from 'react';

import enMessages from '@/i18n/messages/en.json';
import ptMessages from '@/i18n/messages/pt-BR.json';
import { localizedPath, type Locale } from '@/lib/i18n';

import { readStorage, writeStorage } from './helpers';
import { buttonClass } from './ui';

export const cookieNoticeStorageKey = 'study-groups:cookie-notice-dismissed';

/**
 * Informational notice, not a consent wall: the program only uses strictly necessary cookies and storage (Q17).
 * Switch to opt-in consent if analytics or any other non-essential cookie is ever added.
 */
export function CookieNotice({ locale }: { locale: Locale }) {
  const [visible, setVisible] = useState(false);
  const messages = (locale === 'pt-BR' ? ptMessages : enMessages).studyGroups;

  useEffect(() => {
    setVisible(readStorage('localStorage', cookieNoticeStorageKey) !== '1');
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    writeStorage('localStorage', cookieNoticeStorageKey, '1');
    setVisible(false);
  };

  return (
    <aside aria-label={messages.privacy} className="fixed inset-x-3 bottom-3 z-60 mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-line bg-bg-card px-5 py-4 text-sm shadow-lg">
      <p className="min-w-0 flex-[1_1_320px] text-text-secondary">
        {messages.cookieNotice}{' '}
        <a className="text-accent hover:text-accent-hover" href={`${localizedPath(locale, '/privacy')}#cookies`}>{messages.cookieNoticeLink}</a>
      </p>
      <button type="button" className={buttonClass.primarySmall} onClick={dismiss}>{messages.cookieNoticeDismiss}</button>
    </aside>
  );
}
