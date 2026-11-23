'use client';

import { useEffect, useState } from 'react';

import { errorMessage, hasStatus } from './api';
import { useSession } from './session';
import { Banner, buttonClass, cardClass, eyebrowClass } from './ui';

type State = 'idle' | 'busy' | 'done' | 'invalid' | 'error';

/** Confirmation page of the email unsubscribe link: opening it changes nothing until the button is pressed. */
export function UnsubscribeView() {
  const { api } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('t') ?? '');
  }, []);

  const confirm = async () => {
    setState('busy');
    try {
      await api.unsubscribe(String(token));
      setState('done');
    } catch (unsubscribeError) {
      if (hasStatus(unsubscribeError, 400)) {
        setState('invalid');
        return;
      }
      setError(errorMessage(unsubscribeError));
      setState('error');
    }
  };

  return (
    <section className={`${cardClass} mx-auto flex max-w-lg flex-col items-start gap-4 p-6 sm:p-8`}>
      <p className={eyebrowClass}>English study groups</p>
      <h1 className="text-3xl font-normal tracking-tight">Unsubscribe from emails</h1>
      {state === 'done' ? (
        <Banner tone="success" title="You won't get study group emails anymore.">
          <p>You&apos;ll still see requests and decisions in the app. To turn emails back on, open your <a className="text-accent" href="/study-groups/account">account</a>.</p>
        </Banner>
      ) : (
        <>
          <p className="text-text-secondary">Stop all emails about join requests, decisions and moderation of your groups. You&apos;ll still see everything in the app.</p>
          {state === 'invalid' || token === '' ? <Banner tone="error" title="This unsubscribe link is invalid or expired. Turn emails off in your account instead." /> : null}
          {state === 'error' ? <Banner tone="error" title={error} /> : null}
          <div className="flex flex-wrap gap-3">
            <button type="button" className={buttonClass.primary} disabled={!token || state === 'busy'} onClick={() => void confirm()}>Unsubscribe</button>
            <a className={buttonClass.secondarySmall} href="/study-groups/account">Account settings</a>
          </div>
        </>
      )}
    </section>
  );
}
