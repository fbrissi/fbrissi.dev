'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { LIMITS, type GroupPreviewResponse } from '@/workers/study-group/contract';

import { errorMessage, hasStatus, type StudyGroupApi } from './api';
import { Banner, buttonClass, cardClass, eyebrowClass, hintClass, inputClass } from './ui';

/** Shown to signed-in users who aren't members: request to join with the access code; the owner approves (D5). */
export function JoinScreen({ api, groupId }: { api: StudyGroupApi; groupId: string }) {
  const [preview, setPreview] = useState<GroupPreviewResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    api.previewGroup(groupId).then(setPreview, () => setLoadError(true));
  }, [api, groupId]);

  if (loadError) return <Banner tone="error" title="Couldn't load this group. Check the link and try again." />;
  if (!preview) return <p role="status" className="text-text-secondary">Loading…</p>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) {
      setError('Please enter the group code.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.joinGroup(groupId, { code: code.trim(), message: message.trim() || undefined });
      setSent(true);
    } catch (joinError) {
      setError(hasStatus(joinError, 403) ? "That code didn't work. Check the latest code with the group." : errorMessage(joinError));
    } finally {
      setSubmitting(false);
    }
  };

  const waiting = sent || preview.membership === 'pending';

  return (
    <section className="mx-auto max-w-lg py-6">
      <p className={eyebrowClass}>Weekly English study group</p>
      <h1 className="mb-3 mt-2 text-3xl font-normal tracking-tight wrap-anywhere sm:text-4xl">{preview.group.name}</h1>
      <p className="mb-6 text-text-secondary wrap-anywhere">{preview.group.summary}</p>
      {waiting ? (
        <Banner tone="success" title="Your request was sent.">
          <p className="text-text-secondary">The owner reviews each request. Once approved, this page opens the board; you won&apos;t need the code again.</p>
        </Banner>
      ) : (
        <form noValidate onSubmit={submit} className={`${cardClass} flex flex-col gap-4 p-6`}>
          <h2 className="text-xl font-normal">Ask to join</h2>
          <label htmlFor="join-code" className="text-sm tracking-wide text-text-secondary">Group code</label>
          <input
            id="join-code"
            className={inputClass}
            value={code}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'join-error' : undefined}
            onChange={(event) => { setCode(event.target.value); setError(''); }}
          />
          <label htmlFor="join-message" className="flex justify-between text-sm tracking-wide text-text-secondary">Message to the owner <span className="text-xs text-text-muted">Optional</span></label>
          <textarea id="join-message" className={`${inputClass} min-h-20 resize-y`} rows={2} maxLength={LIMITS.joinMessage} value={message} onChange={(event) => setMessage(event.target.value)} />
          <span className={hintClass}>The owner sees your display name and this message, never your email.</span>
          {error ? <p id="join-error" role="alert" className="text-sm text-red-500">{error}</p> : null}
          <button type="submit" className={buttonClass.primary} disabled={submitting}>{submitting ? 'Sending…' : 'Send request'}</button>
        </form>
      )}
    </section>
  );
}
