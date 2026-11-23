'use client';

import { useCallback, useEffect, useState } from 'react';

import enMessages from '@/i18n/messages/en.json';
import ptMessages from '@/i18n/messages/pt-BR.json';
import type { Locale } from '@/lib/i18n';
import type { GroupCard } from '@/workers/study-group/contract';

import { groupPath, signInHref } from './api';
import { useSession } from './session';
import { Banner, buttonClass, cardClass } from './ui';

function messagesFor(locale: Locale) {
  return (locale === 'pt-BR' ? ptMessages : enMessages).studyGroups;
}

export function ProgramActions({ locale }: { locale: Locale }) {
  const { user } = useSession();
  const messages = messagesFor(locale);
  const [signIn, setSignIn] = useState<string | null>(null);

  useEffect(() => {
    setSignIn(new URLSearchParams(window.location.search).get('signin'));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {signIn === 'failed' ? <Banner tone="error" title={messages.signInFailed} /> : null}
      {signIn === 'banned' ? <Banner tone="error" title={messages.signInBanned} /> : null}
      <div className="flex flex-wrap gap-3">
        {user ? (
          <>
            <a className={buttonClass.primary} href="/study-groups/new">{messages.createGroup}</a>
            <a className={buttonClass.secondarySmall} href="/study-groups/my">{messages.myGroups}</a>
          </>
        ) : (
          <>
            <a className={buttonClass.primary} href={signInHref('/study-groups/my')}>{messages.joinCta}</a>
            <a className={buttonClass.secondarySmall} href={signInHref('/study-groups/new')}>{messages.createGroup}</a>
          </>
        )}
      </div>
      {user ? null : <p className="text-sm text-text-muted">{messages.signInNote}</p>}
    </div>
  );
}

type DirectoryState = 'loading' | 'ready' | 'error';

/** Cards show only the name and the creator's summary (D3); signed-out visitors are sent to sign in first. */
export function GroupDirectory({ locale }: { locale: Locale }) {
  const { api, user } = useSession();
  const messages = messagesFor(locale);
  const [groups, setGroups] = useState<GroupCard[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<DirectoryState>('loading');

  const load = useCallback(async (from: string | null) => {
    try {
      const page = await api.listGroups(from);
      setGroups((list) => (from ? [...list, ...page.groups] : page.groups));
      setCursor(page.nextCursor);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [api]);

  useEffect(() => {
    void load(null);
  }, [load]);

  if (state === 'loading') return <p role="status" className="text-text-secondary">{messages.loading}</p>;
  if (state === 'error') return <Banner tone="error" title={messages.groupsError} />;
  if (!groups.length) return <p className="text-text-secondary">{messages.groupsEmpty}</p>;

  return (
    <div className="flex flex-col gap-6">
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <li key={group.id} className={`${cardClass} flex flex-col gap-3 p-6`}>
            <h3 className="text-xl font-normal tracking-tight wrap-anywhere">{group.name}</h3>
            <p className="flex-1 text-sm leading-relaxed text-text-secondary wrap-anywhere">{group.summary}</p>
            <a className={`${buttonClass.secondarySmall} self-start`} href={user ? groupPath(group.id) : signInHref(groupPath(group.id))}>
              {user ? messages.openGroup : messages.signInToJoin}
              <span className="sr-only">: {group.name}</span>
            </a>
          </li>
        ))}
      </ul>
      {cursor ? <button type="button" className={`${buttonClass.secondarySmall} self-start`} onClick={() => void load(cursor)}>{messages.loadMore}</button> : null}
    </div>
  );
}
