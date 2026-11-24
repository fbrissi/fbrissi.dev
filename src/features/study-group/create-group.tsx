'use client';

import { useState, type FormEvent } from 'react';

import { LIMITS } from '@/workers/study-group/contract';

import { errorMessage, groupPath } from './api';
import { navigate } from './navigation';
import { emptyProfile, GroupProfileFields, parseProfile, type ProfileErrors, type ProfileValues } from './group-form';
import { RequireUser, useSession } from './session';
import { Banner, buttonClass, cardClass, eyebrowClass } from './ui';

function CreateGroupForm() {
  const { api } = useSession();
  const [values, setValues] = useState<ProfileValues>(emptyProfile);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [policy, setPolicy] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = parseProfile(values);
    if ('errors' in result) {
      setErrors(result.errors);
      setError('Please fix the highlighted fields.');
      return;
    }
    if (!policy) {
      setError('Confirm that the group follows the content policy.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { group } = await api.createGroup({ ...result.data, acceptContentPolicy: true });
      navigate(groupPath(group.id, '/settings'));
    } catch (createError) {
      setError(errorMessage(createError));
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl">
      <p className={eyebrowClass}>English study groups</p>
      <h1 className="mb-3 mt-2 text-3xl font-normal tracking-tight sm:text-5xl">Create a group</h1>
      <p className="mb-8 text-text-secondary">You become the owner: you approve who joins, share the access code if you require one, and moderate the board. You can own up to {LIMITS.ownedGroupsPerUser} groups with up to {LIMITS.membersPerGroup} members each.</p>
      <form noValidate onSubmit={submit} className={`${cardClass} flex flex-col gap-5 p-6 sm:p-8`}>
        <GroupProfileFields values={values} errors={errors} onChange={(next) => { setValues((previous) => ({ ...previous, ...next })); setErrors({}); setError(''); }} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={policy} onChange={(event) => { setPolicy(event.target.checked); setError(''); }} />
          <span>I confirm this group follows the <a className="text-accent" href="/study-groups/terms#content-policy" target="_blank" rel="noopener">content policy</a> and that I am responsible for moderating it.</span>
        </label>
        {error ? <Banner tone="error" title={error} /> : null}
        <button type="submit" className={`${buttonClass.primary} self-start`} disabled={saving}>{saving ? 'Creating…' : 'Create group'}</button>
      </form>
    </section>
  );
}

export function CreateGroupView() {
  return <RequireUser>{() => <CreateGroupForm />}</RequireUser>;
}
