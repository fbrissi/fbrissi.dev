'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { CurrentUser } from '@/workers/study-group/contract';

import { createStudyGroupApi, signInHref, type StudyGroupApi } from './api';
import { writeStorage } from './helpers';
import { currentPath } from './navigation';
import { buttonClass, cardClass, eyebrowClass } from './ui';

export type SessionStatus = 'loading' | 'ready' | 'error';

export interface SessionValue {
  api: StudyGroupApi;
  status: SessionStatus;
  user: CurrentUser | null;
  setUser: (user: CurrentUser | null) => void;
  reload: () => Promise<void>;
}

export const legacyStorageKeys = ['study-group:code', 'study-group:name'] as const;

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ apiUrl, children }: { apiUrl?: string; children: ReactNode }) {
  const api = useMemo(() => createStudyGroupApi(apiUrl), [apiUrl]);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<CurrentUser | null>(null);

  const reload = useCallback(async () => {
    try {
      setUser((await api.getMe()).user);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    // v0.3 kept the shared access code and a typed name in the browser; neither is used any more.
    for (const key of legacyStorageKeys) writeStorage('localStorage', key, null);
  }, []);

  const value = useMemo(() => ({ api, status, user, setUser, reload }), [api, status, user, reload]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

export function SignInPrompt({ title = 'Sign in to continue', text = 'Study groups use Google sign-in. We only keep your name and email to run your account.', returnTo }: { title?: string; text?: string; returnTo: string }) {
  return (
    <section className={`${cardClass} mx-auto flex max-w-lg flex-col items-start gap-4 p-6 sm:p-8`}>
      <p className={eyebrowClass}>English study groups</p>
      <h1 className="text-3xl font-normal tracking-tight">{title}</h1>
      <p className="text-text-secondary">{text}</p>
      <a className={buttonClass.primary} href={signInHref(returnTo)}>Sign in with Google</a>
    </section>
  );
}

/** Renders its children only for a signed-in user; otherwise a loading state, an error, or a sign-in prompt. */
export function RequireUser({ children }: { children: (user: CurrentUser) => ReactNode }) {
  const { status, user, reload } = useSession();
  if (status === 'loading') return <p role="status" className="text-text-secondary">Loading…</p>;
  if (status === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>Couldn&apos;t reach the study groups service.</p>
        <button type="button" className={buttonClass.secondarySmall} onClick={() => void reload()}>Try again</button>
      </div>
    );
  }
  if (!user) return <SignInPrompt returnTo={currentPath()} />;
  return <>{children(user)}</>;
}
