'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { adminLoginSchema, updateGroupSettingsSchema, type DeletedMaterial, type GroupSettings, type UpdateGroupSettingsInput } from '@/workers/study-group/contract';

import { createStudyGroupAdminApi, errorMessage, isUnauthorized } from './api';
import { adminTokenStorageKey, formatDate, generateAccessCode, readStorage, typeLabel, writeStorage } from './helpers';
import { Banner, buttonClass, cardClass, eyebrowClass, hintClass, inputClass } from './ui';

type Phase = 'login' | 'loading' | 'ready' | 'error';
type SettingsField = 'name' | 'description' | 'rules' | 'meetingDay' | 'meetingStart' | 'meetingEnd' | 'timezone' | 'meetingUrl' | 'accessCode';
type SettingsValues = Record<SettingsField, string>;
type Notice = { tone: 'success' | 'error'; text: string } | null;

const settingsMessages: Record<SettingsField, string> = {
  name: 'Enter a group name (up to 80 characters).',
  description: 'Use 2000 characters or fewer.',
  rules: 'Use up to 30 rules, each up to 300 characters.',
  meetingDay: 'Enter a day (up to 20 characters).',
  meetingStart: 'Use the HH:MM format.',
  meetingEnd: 'Use the HH:MM format.',
  timezone: 'Enter a time zone, e.g. America/Sao_Paulo.',
  meetingUrl: 'Enter a full link starting with https://, or leave it empty.',
  accessCode: 'Use 6 to 100 characters.'
};

const labelClass = 'text-sm tracking-wide text-text-secondary';
const sectionTitleClass = 'mb-1 text-2xl font-normal tracking-tight';

function toValues(settings: GroupSettings): SettingsValues {
  return {
    name: settings.name,
    description: settings.description,
    rules: settings.rules.join('\n'),
    meetingDay: settings.meetingDay,
    meetingStart: settings.meetingStart,
    meetingEnd: settings.meetingEnd,
    timezone: settings.timezone,
    meetingUrl: settings.meetingUrl ?? '',
    accessCode: settings.accessCode ?? ''
  };
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className={labelClass}>{label}</label>
      {children}
      {hint}
      {error ? <p id={`${id}-error`} className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
}

export function AdminSettings({ apiUrl }: { apiUrl: string }) {
  const tokenRef = useRef('');
  const api = useMemo(() => createStudyGroupAdminApi(apiUrl, () => tokenRef.current), [apiUrl]);
  const [phase, setPhase] = useState<Phase>('login');
  const [loginNotice, setLoginNotice] = useState('');
  const [values, setValues] = useState<SettingsValues | null>(null);
  const [deleted, setDeleted] = useState<DeletedMaterial[]>([]);

  const logout = useCallback((message = '') => {
    tokenRef.current = '';
    writeStorage('sessionStorage', adminTokenStorageKey, null);
    setLoginNotice(message);
    setPhase('login');
  }, []);

  const handleError = useCallback((error: unknown): string => {
    if (isUnauthorized(error)) logout('Your session expired. Please log in again.');
    return errorMessage(error);
  }, [logout]);

  const load = useCallback(async () => {
    setPhase('loading');
    try {
      const [{ settings }, { materials }] = await Promise.all([api.getSettings(), api.listDeletedMaterials()]);
      setValues(toValues(settings));
      setDeleted(materials);
      setPhase('ready');
    } catch (error) {
      handleError(error);
      if (!isUnauthorized(error)) setPhase('error');
    }
  }, [api, handleError]);

  useEffect(() => {
    tokenRef.current = readStorage('sessionStorage', adminTokenStorageKey);
    if (tokenRef.current) void load();
  }, [load]);

  const loggedIn = (token: string) => {
    tokenRef.current = token;
    writeStorage('sessionStorage', adminTokenStorageKey, token);
    setLoginNotice('');
    void load();
  };

  if (phase === 'login') return <LoginForm notice={loginNotice} onLogin={async (input) => loggedIn((await api.login(input)).token)} />;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={eyebrowClass}>Study group</p>
          <h1 className="mt-2 text-3xl font-normal tracking-tight sm:text-5xl">Settings</h1>
        </div>
        <button type="button" className={buttonClass.secondarySmall} onClick={() => logout()}>Log out</button>
      </div>
      {phase === 'loading' ? <p role="status" className="text-text-secondary">Loading settings…</p> : null}
      {phase === 'error' ? (
        <div className="flex flex-col items-start gap-3">
          <Banner tone="error" title="Couldn't load the settings." />
          <button type="button" className={buttonClass.secondarySmall} onClick={() => void load()}>Try again</button>
        </div>
      ) : null}
      {phase === 'ready' ? (
        <>
          <SettingsForm
            initial={values as SettingsValues}
            onSave={async (input) => {
              const { settings } = await api.updateSettings(input);
              return toValues(settings);
            }}
            onError={handleError}
          />
          <DeletedMaterials
            materials={deleted}
            onRestore={async (material) => {
              await api.restoreMaterial(material.id);
              setDeleted((list) => list.filter((item) => item.id !== material.id));
            }}
            onError={handleError}
          />
        </>
      ) : null}
    </div>
  );
}

function LoginForm({ notice, onLogin }: { notice: string; onLogin: (input: { email: string; password: string }) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = adminLoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError('Enter a valid email and your password.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onLogin(parsed.data);
    } catch (loginError) {
      setError(isUnauthorized(loginError) ? 'Email or password is incorrect.' : errorMessage(loginError));
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-md py-10">
      <p className={eyebrowClass}>Study group</p>
      <h1 className="mb-6 mt-2 text-3xl font-normal tracking-tight sm:text-4xl">Settings login</h1>
      <form noValidate onSubmit={handleSubmit} className={`${cardClass} flex flex-col gap-5 p-6`}>
        {notice ? <Banner tone="error" title={notice} /> : null}
        <Field id="admin-email" label="Email">
          <input id="admin-email" type="email" className={inputClass} value={email} autoComplete="username" onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field id="admin-password" label="Password">
          <input id="admin-password" type="password" className={inputClass} value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} />
        </Field>
        {error ? <p role="alert" className="text-sm text-red-500">{error}</p> : null}
        <button type="submit" className={buttonClass.primary} disabled={submitting}>{submitting ? 'Logging in…' : 'Log in'}</button>
      </form>
    </section>
  );
}

function SettingsForm({ initial, onSave, onError }: { initial: SettingsValues; onSave: (input: UpdateGroupSettingsInput) => Promise<SettingsValues>; onError: (error: unknown) => string }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<SettingsField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [copyStatus, setCopyStatus] = useState('');

  const update = (field: SettingsField, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setNotice(null);
  };

  const inputProps = (field: SettingsField) => ({
    id: `settings-${field}`,
    className: inputClass,
    value: values[field],
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? `settings-${field}-error` : undefined,
    onChange: (event: { target: { value: string } }) => update(field, event.target.value)
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = updateGroupSettingsSchema.safeParse({
      ...values,
      rules: values.rules.split('\n').map((rule) => rule.trim()).filter(Boolean),
      meetingUrl: values.meetingUrl.trim() || null
    });
    if (!parsed.success) {
      const next: Partial<Record<SettingsField, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as SettingsField;
        next[field] = settingsMessages[field];
      }
      setErrors(next);
      setNotice({ tone: 'error', text: 'Please fix the highlighted fields.' });
      return;
    }
    setSaving(true);
    try {
      setValues(await onSave(parsed.data));
      setNotice({ tone: 'success', text: 'Settings saved.' });
    } catch (error) {
      setNotice({ tone: 'error', text: onError(error) });
    } finally {
      setSaving(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(values.accessCode);
      setCopyStatus('Copied to the clipboard.');
    } catch {
      setCopyStatus("Couldn't copy. Select the code and copy it manually.");
    }
  };

  return (
    <section aria-labelledby="settings-title" className={`${cardClass} p-6 sm:p-8`}>
      <h2 id="settings-title" className={sectionTitleClass}>Group info</h2>
      <p className="mb-6 text-sm text-text-secondary">Shown at the top of the board. The access code is required to open it.</p>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field id="settings-name" label="Group name" error={errors.name}>
          <input {...inputProps('name')} maxLength={80} />
        </Field>
        <Field id="settings-description" label="Description" error={errors.description}>
          <textarea {...inputProps('description')} className={`${inputClass} min-h-24 resize-y`} rows={3} />
        </Field>
        <Field id="settings-rules" label="Rules" error={errors.rules} hint={<span className={hintClass}>One rule per line.</span>}>
          <textarea {...inputProps('rules')} className={`${inputClass} min-h-32 resize-y`} rows={5} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="settings-meetingDay" label="Meeting day" error={errors.meetingDay}>
            <input {...inputProps('meetingDay')} maxLength={20} />
          </Field>
          <Field id="settings-meetingStart" label="Starts at" error={errors.meetingStart}>
            <input {...inputProps('meetingStart')} type="time" />
          </Field>
          <Field id="settings-meetingEnd" label="Ends at" error={errors.meetingEnd}>
            <input {...inputProps('meetingEnd')} type="time" />
          </Field>
          <Field id="settings-timezone" label="Time zone" error={errors.timezone}>
            <input {...inputProps('timezone')} maxLength={64} />
          </Field>
        </div>
        <Field id="settings-meetingUrl" label="Meeting link (optional)" error={errors.meetingUrl}>
          <input {...inputProps('meetingUrl')} type="url" inputMode="url" placeholder="https://" />
        </Field>
        <Field id="settings-accessCode" label="Access code" error={errors.accessCode} hint={copyStatus ? <span role="status" className={hintClass}>{copyStatus}</span> : <span className={hintClass}>Share it with the group. Changing it locks out everyone until they enter the new code.</span>}>
          <div className="flex flex-wrap gap-3">
            <input {...inputProps('accessCode')} className={`${inputClass} min-w-0 flex-[1_1_220px] font-mono`} autoComplete="off" spellCheck={false} />
            <button type="button" className={buttonClass.secondarySmall} onClick={() => { update('accessCode', generateAccessCode()); setCopyStatus(''); }}>Generate</button>
            <button type="button" className={buttonClass.secondarySmall} disabled={!values.accessCode} onClick={() => void copyCode()}>Copy</button>
          </div>
        </Field>
        {notice ? <Banner tone={notice.tone} title={notice.text} /> : null}
        <button type="submit" className={`${buttonClass.primary} self-start`} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
      </form>
    </section>
  );
}

function DeletedMaterials({ materials, onRestore, onError }: { materials: DeletedMaterial[]; onRestore: (material: DeletedMaterial) => Promise<void>; onError: (error: unknown) => string }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const restore = async (material: DeletedMaterial) => {
    setBusyId(material.id);
    setNotice(null);
    try {
      await onRestore(material);
      setNotice({ tone: 'success', text: `Restored “${material.title}”.` });
    } catch (error) {
      setNotice({ tone: 'error', text: onError(error) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-labelledby="deleted-title" className={`${cardClass} p-6 sm:p-8`}>
      <h2 id="deleted-title" className={sectionTitleClass}>Deleted materials</h2>
      <p className="mb-5 text-sm text-text-secondary">Deleted items are hidden from the board. Restore one to bring it back.</p>
      {notice ? <div className="mb-4"><Banner tone={notice.tone} title={notice.text} /></div> : null}
      {materials.length ? (
        <ul className="m-0 list-none p-0">
          {materials.map((material) => (
            <li key={material.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-line py-3.5">
              <span className="text-[15px] text-text-secondary wrap-anywhere">{material.title}</span>
              <span className="col-start-1 text-xs text-text-muted">{typeLabel(material.type)} · by {material.suggestedBy} · deleted {formatDate(material.deletedAt)}</span>
              <span className="col-start-2 row-span-2 row-start-1">
                <button type="button" className={buttonClass.secondarySmall} disabled={busyId !== null} aria-label={`Restore “${material.title}”`} onClick={() => void restore(material)}>Restore</button>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className={hintClass}>No deleted materials.</p>}
    </section>
  );
}
