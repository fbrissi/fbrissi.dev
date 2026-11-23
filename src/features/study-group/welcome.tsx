'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import { POLICY_VERSIONS } from '@/workers/study-group/contract';

import { errorMessage, signInHref } from './api';
import { navigate } from './navigation';
import { useSession } from './session';
import { Banner, buttonClass, cardClass, eyebrowClass } from './ui';

type Phase = 'loading' | 'ready' | 'expired';

/** New accounts exist only after an explicit acceptance; the boxes are never pre-checked (D9, Q4). */
export function WelcomeView() {
  const { api } = useSession();
  const [phase, setPhase] = useState<Phase>('loading');
  const [name, setName] = useState('');
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [adult, setAdult] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const termsBox = useRef<HTMLInputElement>(null);
  const privacyBox = useRef<HTMLInputElement>(null);
  const adultBox = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getSignup().then(({ displayName }) => { setName(displayName); setPhase('ready'); }, () => setPhase('expired'));
  }, [api]);

  if (phase === 'loading') return <p role="status" className="text-text-secondary">Loading…</p>;
  if (phase === 'expired') {
    return (
      <section className={`${cardClass} mx-auto flex max-w-lg flex-col items-start gap-4 p-6 sm:p-8`}>
        <h1 className="text-3xl font-normal tracking-tight">Your sign-in expired</h1>
        <p className="text-text-secondary">Sign in again to create your account.</p>
        <a className={buttonClass.primary} href={signInHref('/study-groups/my')}>Sign in with Google</a>
      </section>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!terms || !privacy || !adult) {
      setError('Check all three boxes to create your account.');
      // The message is announced (role="alert") and the focus moves to the first box left unchecked.
      [termsBox, privacyBox, adultBox].find((box) => !box.current!.checked)!.current!.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { returnTo } = await api.completeSignup({ acceptTerms: true, acceptPrivacy: true, confirmAge: true });
      navigate(returnTo);
    } catch (signupError) {
      setError(errorMessage(signupError));
      setBusy(false);
    }
  };

  const decline = async () => {
    setBusy(true);
    try {
      await api.cancelSignup();
    } finally {
      navigate('/study-groups');
    }
  };

  return (
    <section className="mx-auto max-w-xl">
      <p className={eyebrowClass}>English study groups</p>
      <h1 className="mb-3 mt-2 text-3xl font-normal tracking-tight sm:text-4xl">Welcome, {name}</h1>
      <p className="mb-6 text-text-secondary">Before we create your account, please read and accept the rules. If you decline, nothing about you is kept.</p>
      <form noValidate onSubmit={submit} className={`${cardClass} flex flex-col gap-4 p-6`}>
        <label className="flex items-start gap-2 text-sm">
          <input ref={termsBox} type="checkbox" checked={terms} aria-invalid={error && !terms ? true : undefined} aria-describedby={error ? 'welcome-error' : undefined} onChange={(event) => setTerms(event.target.checked)} />
          <span>I have read and accept the <a className="text-accent" href="/study-groups/terms" target="_blank" rel="noopener">Terms of Use and content policy</a> (version {POLICY_VERSIONS.terms}).</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input ref={privacyBox} type="checkbox" checked={privacy} aria-invalid={error && !privacy ? true : undefined} aria-describedby={error ? 'welcome-error' : undefined} onChange={(event) => setPrivacy(event.target.checked)} />
          <span>I have read and accept the <a className="text-accent" href="/privacy" target="_blank" rel="noopener">Privacy Policy</a> (version {POLICY_VERSIONS.privacy}).</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input ref={adultBox} type="checkbox" checked={adult} aria-invalid={error && !adult ? true : undefined} aria-describedby={error ? 'welcome-error' : undefined} onChange={(event) => setAdult(event.target.checked)} />
          <span>I am 18 years old or older.</span>
        </label>
        {error ? <div id="welcome-error"><Banner tone="error" title={error} /></div> : null}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={buttonClass.primary} disabled={busy}>Create my account</button>
          <button type="button" className={buttonClass.secondarySmall} disabled={busy} onClick={() => void decline()}>Decline</button>
        </div>
      </form>
    </section>
  );
}
