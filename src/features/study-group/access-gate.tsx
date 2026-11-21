import { useState, type FormEvent } from 'react';

import { buttonClass, cardClass, eyebrowClass, inputClass } from './ui';

export function AccessGate({ rejected, onSubmit }: { rejected: boolean; onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const message = error || (rejected ? "That code didn't work. Check the latest code with the group." : '');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = code.trim();
    if (!value) {
      setError('Please enter the group code.');
      return;
    }
    onSubmit(value);
  };

  return (
    <section className="mx-auto max-w-md py-10">
      <p className={eyebrowClass}>Weekly English study group</p>
      <h1 className="mb-4 mt-2 text-3xl font-normal tracking-tight sm:text-4xl">Enter the group code</h1>
      <p className="mb-6 text-text-secondary">Ask the group for the code. It is remembered on this device.</p>
      <form noValidate onSubmit={handleSubmit} className={`${cardClass} flex flex-col gap-4 p-6`}>
        <label htmlFor="access-code" className="text-sm tracking-wide text-text-secondary">Group code</label>
        <input
          id="access-code"
          className={inputClass}
          value={code}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={Boolean(message)}
          aria-describedby={message ? 'access-code-error' : undefined}
          onChange={(event) => { setCode(event.target.value); setError(''); }}
        />
        {message ? <p id="access-code-error" role="alert" className="text-sm text-red-500">{message}</p> : null}
        <button type="submit" className={buttonClass.primary}>Open the board</button>
      </form>
    </section>
  );
}
