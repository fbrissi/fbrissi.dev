'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { LIMITS, REASON_REQUIRED_MESSAGE } from '@/workers/study-group/contract';

import { buttonClass, cardClass, inputClass } from './ui';

export const reasonRequired = REASON_REQUIRED_MESSAGE;

export interface ReasonRequest {
  /** The question, e.g. “Delete “X” permanently?”. */
  title: string;
  /** What happens, and who sees the reason. */
  text: string;
  confirmLabel: string;
  /** Red confirm button, for bans and permanent deletions. */
  destructive?: boolean;
}

type OpenRequest = ReasonRequest & { resolve: (reason: string | null) => void };

/**
 * The in-page dialog of the platform admin's moderation actions (ban, unban, renewal, permanent deletions): the
 * consequences, the mandatory reason checked inline, and confirm or cancel. `ask` resolves to the trimmed reason, or
 * null when cancelled. Render `dialog` once in the component that calls `ask`.
 */
export function useReasonDialog(): { dialog: ReactNode; ask: (request: ReasonRequest) => Promise<string | null> } {
  const [open, setOpen] = useState<OpenRequest | null>(null);
  const ask = useCallback((request: ReasonRequest) => new Promise<string | null>((resolve) => setOpen({ ...request, resolve })), []);
  const close = useCallback((reason: string | null) => {
    setOpen((current) => {
      current?.resolve(reason);
      return null;
    });
  }, []);
  return { dialog: open ? <ReasonDialog request={open} onClose={close} /> : null, ask };
}

function ReasonDialog({ request, onClose }: { request: ReasonRequest; onClose: (reason: string | null) => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const id = useId();
  const field = useRef<HTMLTextAreaElement>(null);

  // The dialog renders at the end of <body>; everything else is made inert while it is open, which keeps the focus
  // (and the cookie notice) behind it. The focus goes back to the button that opened it when that still exists.
  const [layer] = useState(() => document.createElement('div'));
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    document.body.appendChild(layer);
    const background = Array.from(document.body.children).filter((element) => element !== layer && !element.hasAttribute('inert'));
    for (const element of background) element.setAttribute('inert', '');
    field.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose(null);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      for (const element of background) element.removeAttribute('inert');
      layer.remove();
      if (opener?.isConnected) opener.focus();
    };
  }, [layer, onClose]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < LIMITS.reason.min || trimmed.length > LIMITS.reason.max) {
      setError(reasonRequired);
      field.current?.focus();
      return;
    }
    onClose(trimmed);
  };

  return createPortal(
    <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/60 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-text`} className={`${cardClass} w-full max-w-lg p-6 sm:p-8`}>
        <h2 id={`${id}-title`} className="mb-2 text-xl font-normal tracking-tight wrap-anywhere">{request.title}</h2>
        <p id={`${id}-text`} className="mb-5 text-sm text-text-secondary">{request.text}</p>
        <form noValidate onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor={`${id}-reason`} className="text-sm">Reason ({LIMITS.reason.min} to {LIMITS.reason.max} characters)</label>
          <textarea
            ref={field}
            id={`${id}-reason`}
            className={`${inputClass} min-h-24`}
            maxLength={LIMITS.reason.max}
            value={reason}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => {
              setReason(event.target.value);
              setError('');
            }}
          />
          {error ? <p id={`${id}-error`} role="alert" className="text-sm text-red-500">{error}</p> : null}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" className={buttonClass.secondarySmall} onClick={() => onClose(null)}>Cancel</button>
            <button type="submit" className={request.destructive ? `${buttonClass.primarySmall} bg-red-600 hover:bg-red-500` : buttonClass.primarySmall}>{request.confirmLabel}</button>
          </div>
        </form>
      </div>
    </div>,
    layer
  );
}
