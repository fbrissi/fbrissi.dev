'use client';

import { useEffect, useState, type FormEvent } from 'react';

import { friendlyValidationMessages, LIMITS, STUDY_GROUPS_EMAIL, updateProfileSchema, type CurrentUser, type MyGroup } from '@/workers/study-group/contract';

import { errorMessage } from './api';
import { navigate } from './navigation';
import { Field } from './group-form';
import { RequireUser, useSession } from './session';
import { Banner, buttonClass, cardClass, eyebrowClass, hintClass, inputClass } from './ui';

type Notice = { tone: 'success' | 'error'; text: string } | null;
const sectionClass = `${cardClass} p-6 sm:p-8`;
const sectionTitleClass = 'mb-1 text-2xl font-normal tracking-tight';

function ProfileSection({ user }: { user: CurrentUser }) {
  const { api, setUser } = useSession();
  const [name, setName] = useState(user.displayName);
  const [notice, setNotice] = useState<Notice>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = updateProfileSchema.safeParse({ displayName: name });
    if (!parsed.success) {
      const friendly = parsed.error.issues.find((issue) => friendlyValidationMessages.includes(issue.message));
      setNotice({ tone: 'error', text: friendly?.message ?? `Use ${LIMITS.displayName.min} to ${LIMITS.displayName.max} characters.` });
      return;
    }
    try {
      setUser((await api.updateMe(parsed.data)).user);
      setNotice({ tone: 'success', text: 'Name saved.' });
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    }
  };

  return (
    <section aria-labelledby="profile-title" className={sectionClass}>
      <h2 id="profile-title" className={sectionTitleClass}>Profile</h2>
      <p className="mb-5 text-sm text-text-secondary">Your display name is shown to the groups you join and on your suggestions and votes. Your email is never shown to other people.</p>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Field id="display-name" label="Display name">
          <input id="display-name" className={inputClass} value={name} maxLength={LIMITS.displayName.max} autoComplete="nickname" onChange={(event) => { setName(event.target.value); setNotice(null); }} />
        </Field>
        {notice ? <Banner tone={notice.tone} title={notice.text} /> : null}
        <button type="submit" className={`${buttonClass.primarySmall} self-start`}>Save name</button>
      </form>
    </section>
  );
}

function EmailSection() {
  const { api } = useSession();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    api.getEmailPreferences().then(({ emailEnabled }) => setEnabled(emailEnabled), (error) => setNotice({ tone: 'error', text: errorMessage(error) }));
  }, [api]);

  const change = async (emailEnabled: boolean) => {
    setNotice(null);
    setEnabled(emailEnabled);
    try {
      setEnabled((await api.updateEmailPreferences({ emailEnabled })).emailEnabled);
      setNotice({ tone: 'success', text: emailEnabled ? 'Emails turned on.' : 'Emails turned off.' });
    } catch (error) {
      setEnabled(!emailEnabled);
      setNotice({ tone: 'error', text: errorMessage(error) });
    }
  };

  return (
    <section aria-labelledby="email-title" className={sectionClass}>
      <h2 id="email-title" className={sectionTitleClass}>Emails</h2>
      <p className="mb-5 text-sm text-text-secondary">We email you about join requests to your groups, decisions on your requests, and groups of yours that the platform admin deletes. No marketing, ever. You&apos;ll still see everything in the app if you turn them off.</p>
      <label className="mb-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" className="h-5 w-5 shrink-0 accent-accent" checked={enabled ?? false} disabled={enabled === null} onChange={(event) => void change(event.target.checked)} />
        <span>Email me about my groups and requests</span>
      </label>
      {notice ? <Banner tone={notice.tone} title={notice.text} /> : null}
    </section>
  );
}

function DataSection() {
  const { api } = useSession();
  return (
    <section aria-labelledby="data-title" className={sectionClass}>
      <h2 id="data-title" className={sectionTitleClass}>Your data</h2>
      <p className="mb-5 text-sm text-text-secondary">Download a JSON file with your profile, consent records, memberships, join requests, suggestions, votes, email setting and the emails we sent you.</p>
      <a className={buttonClass.secondarySmall} href={api.exportUrl()} download="study-groups-data.json">Download my data</a>
    </section>
  );
}

function DeleteSection() {
  const { api } = useSession();
  const [owned, setOwned] = useState<MyGroup[] | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.myGroups().then(({ groups }) => setOwned(groups.filter((group) => group.role === 'owner')), () => setOwned([]));
  }, [api]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.deleteMe();
      navigate('/study-groups');
    } catch (deleteError) {
      setError(errorMessage(deleteError));
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="delete-account-title" className={`${sectionClass} border-red-500/40`}>
      <h2 id="delete-account-title" className={sectionTitleClass}>Delete my account</h2>
      <p className="mb-3 text-sm text-text-secondary">Your account is deleted permanently, with your sessions, memberships, join requests and email records. Suggestions and votes you left in other groups stay, shown as “Former member”. This can’t be undone.</p>
      {owned?.length ? (
        <div className="mb-4">
          <Banner tone="error" title="These groups you own will be deleted permanently too, with their members’ access, suggestions, votes, rounds and icons:">
            <ul className="m-0 list-disc pl-5">{owned.map((group) => <li key={group.id} className="wrap-anywhere">{group.name}</li>)}</ul>
          </Banner>
        </div>
      ) : null}
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
          <span>I understand that this can&apos;t be undone.</span>
        </label>
        {error ? <Banner tone="error" title={error} /> : null}
        <button type="submit" className={`${buttonClass.primary} self-start bg-red-600 hover:bg-red-500`} disabled={!confirmed || busy}>Delete my account permanently</button>
      </form>
    </section>
  );
}

export function AccountView() {
  return (
    <RequireUser>
      {(user) => (
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          <div>
            <p className={eyebrowClass}>English study groups</p>
            <h1 className="mt-2 text-3xl font-normal tracking-tight sm:text-5xl">Account</h1>
            <p className={`${hintClass} mt-2`}>Questions about your data? Write to <a className="text-accent" href={`mailto:${STUDY_GROUPS_EMAIL}`}>{STUDY_GROUPS_EMAIL}</a>.</p>
          </div>
          <ProfileSection user={user} />
          <EmailSection />
          <DataSection />
          <DeleteSection />
        </div>
      )}
    </RequireUser>
  );
}
