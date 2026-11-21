'use client';

import { useState, type FormEvent } from 'react';

import { POLICY_VERSIONS } from '@/workers/study-group/contract';

import { errorMessage, signInHref } from './api';
import { currentPath, navigate } from './navigation';
import { useSession } from './session';
import { Banner, buttonClass, cardClass } from './ui';

const navLinkClass = 'text-sm text-text-secondary transition-colors duration-250 hover:text-accent';

export function AccountNav() {
  const { api, status, user } = useSession();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await api.logout();
    } finally {
      navigate('/study-groups');
    }
  };

  return (
    <nav aria-label="Study groups" className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <a className={navLinkClass} href="/study-groups">Study groups</a>
      {user ? (
        <>
          <a className={navLinkClass} href="/study-groups/my">My groups</a>
          <a className={navLinkClass} href="/study-groups/new">Create a group</a>
          <a className={navLinkClass} href="/study-groups/account">Account</a>
          {user.isPlatformAdmin ? <a className={navLinkClass} href="/study-groups/admin">Admin</a> : null}
          <button type="button" className={buttonClass.secondarySmall} disabled={busy} onClick={() => void signOut()}>Sign out</button>
        </>
      ) : status === 'ready' ? (
        <a className={buttonClass.primarySmall} href={signInHref(currentPath())}>Sign in with Google</a>
      ) : null}
    </nav>
  );
}

/** Asks for the current policy versions again; writes stay blocked until the user accepts, reading does not (Q18). */
export function ConsentBanner() {
  const { api, user, setUser } = useSession();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user?.needsConsent) return null;

  const accept = async (event: FormEvent) => {
    event.preventDefault();
    if (!terms || !privacy) {
      setError('Check both boxes to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setUser((await api.acceptPolicies({ acceptTerms: true, acceptPrivacy: true })).user);
    } catch (acceptError) {
      setError(errorMessage(acceptError));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={accept} noValidate className={`${cardClass} mb-8 flex flex-col gap-3 border-accent p-5`} aria-labelledby="consent-title">
      <h2 id="consent-title" className="text-lg font-normal">We updated our Terms and Privacy Policy</h2>
      <p className="text-sm text-text-secondary">You can keep reading, but you need to accept the new versions before you make changes.</p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} />
        <span>I accept the <a className="text-accent" href="/study-groups/terms" target="_blank" rel="noopener">Terms of Use</a> (version {POLICY_VERSIONS.terms}).</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} />
        <span>I accept the <a className="text-accent" href="/privacy" target="_blank" rel="noopener">Privacy Policy</a> (version {POLICY_VERSIONS.privacy}).</span>
      </label>
      {error ? <Banner tone="error" title={error} /> : null}
      <button type="submit" className={`${buttonClass.primarySmall} self-start`} disabled={busy}>Accept and continue</button>
    </form>
  );
}
