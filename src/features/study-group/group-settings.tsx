'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';

import type { DeletedMaterial, GroupRole, GroupSettings, JoinRequest, Member, ModerationNotice } from '@/workers/study-group/contract';

import { errorMessage, groupPath, hasStatus, type StudyGroupApi } from './api';
import { navigate } from './navigation';
import { Field, GroupProfileFields, parseProfile, toProfileValues, type ProfileErrors, type ProfileValues } from './group-form';
import { NotFoundGroup } from './group-page';
import { formatDate, groupIdFromPath, typeLabel } from './helpers';
import { RequireUser, useSession } from './session';
import { askReason } from './study-group-board';
import { Banner, buttonClass, cardClass, eyebrowClass, hintClass, inputClass } from './ui';

type Notice = { tone: 'success' | 'error'; text: string } | null;
type Phase = 'loading' | 'ready' | 'forbidden' | 'missing' | 'error';

interface SettingsData {
  settings: GroupSettings;
  notices: ModerationNotice[];
  role: GroupRole;
  requests: JoinRequest[];
  members: Member[];
  deleted: DeletedMaterial[];
}

const sectionClass = `${cardClass} p-6 sm:p-8`;
const sectionTitleClass = 'mb-1 text-2xl font-normal tracking-tight';
const rowClass = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-line py-3.5';

/** Static shell for /study-groups/g/<id>/settings: owner and platform admin only (4.1). */
export function GroupSettingsView() {
  const { api } = useSession();
  const [groupId, setGroupId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setGroupId(groupIdFromPath(window.location.pathname));
  }, []);

  if (groupId === undefined) return null;
  if (groupId === null) return <NotFoundGroup />;
  return <RequireUser>{(user) => <SettingsLoader api={api} groupId={groupId} isPlatformAdmin={user.isPlatformAdmin} />}</RequireUser>;
}

function SettingsLoader({ api, groupId, isPlatformAdmin }: { api: StudyGroupApi; groupId: string; isPlatformAdmin: boolean }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<SettingsData | null>(null);

  const load = useCallback(async () => {
    try {
      const [settings, requests, members, deleted] = await Promise.all([
        api.getSettings(groupId),
        api.listRequests(groupId),
        api.listMembers(groupId),
        api.listDeletedMaterials(groupId)
      ]);
      setData({ ...settings, requests: requests.requests, members: members.members, deleted: deleted.materials });
      setPhase('ready');
    } catch (error) {
      setPhase(hasStatus(error, 403) ? 'forbidden' : hasStatus(error, 404) ? 'missing' : 'error');
    }
  }, [api, groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (phase === 'loading') return <p role="status" className="text-text-secondary">Loading settings…</p>;
  if (phase === 'missing') return <NotFoundGroup />;
  if (phase === 'forbidden' || phase === 'error') {
    return (
      <div className="flex flex-col items-start gap-3">
        <Banner tone="error" title={phase === 'forbidden' ? 'Only the group owner can open the settings.' : "Couldn't load the settings."} />
        <a className={buttonClass.secondarySmall} href={groupPath(groupId)}>Back to the board</a>
      </div>
    );
  }

  const ready = data as SettingsData;
  const isAdminActor = ready.role === 'platform_admin';
  const update = (next: Partial<SettingsData>) => setData({ ...ready, ...next });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={eyebrowClass}>{ready.settings.name}</p>
          <h1 className="mt-2 text-3xl font-normal tracking-tight sm:text-5xl">Group settings</h1>
        </div>
        <a className={buttonClass.secondarySmall} href={groupPath(groupId)}>Back to the board</a>
      </div>
      {isAdminActor ? <Banner tone="error" title="You are moderating this group as the platform admin. Deletions need a reason and are logged." /> : null}
      <Notices notices={ready.notices} />
      <ProfileForm api={api} settings={ready.settings} onSaved={(settings) => update({ settings })} />
      <AccessCode api={api} settings={ready.settings} onRotated={(settings) => update({ settings })} />
      <Requests api={api} groupId={groupId} requests={ready.requests} canDeleteMessages={isPlatformAdmin} onChange={(requests, members) => update(members ? { requests, members } : { requests })} />
      <Members api={api} groupId={groupId} members={ready.members} onRemoved={(userId) => update({ members: ready.members.filter((member) => member.userId !== userId) })} />
      <DeletedMaterials api={api} groupId={groupId} materials={ready.deleted} isPlatformAdmin={isPlatformAdmin} onRestored={(id) => update({ deleted: ready.deleted.filter((item) => item.id !== id) })} />
      <DeleteGroup api={api} settings={ready.settings} needsReason={isAdminActor} />
    </div>
  );
}

function Notices({ notices }: { notices: ModerationNotice[] }) {
  if (!notices.length) return null;
  return (
    <section aria-labelledby="notices-title" className={sectionClass}>
      <h2 id="notices-title" className={sectionTitleClass}>Moderation notices</h2>
      <p className="mb-4 text-sm text-text-secondary">The platform admin removed content from this group in the last 30 days.</p>
      <ul className="m-0 list-none p-0">
        {notices.map((notice) => (
          <li key={notice.id} className="border-t border-line py-3 text-sm">
            <p className="wrap-anywhere">“{notice.label}” · {formatDate(notice.createdAt)}</p>
            <p className="text-text-secondary wrap-anywhere">Reason: {notice.reason}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProfileForm({ api, settings, onSaved }: { api: StudyGroupApi; settings: GroupSettings; onSaved: (settings: GroupSettings) => void }) {
  const [values, setValues] = useState<ProfileValues>(() => toProfileValues(settings));
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = parseProfile(values);
    if ('errors' in result) {
      setErrors(result.errors);
      setNotice({ tone: 'error', text: 'Please fix the highlighted fields.' });
      return;
    }
    setSaving(true);
    try {
      const saved = await api.updateSettings(settings.id, result.data);
      onSaved(saved.settings);
      setValues(toProfileValues(saved.settings));
      setNotice({ tone: 'success', text: 'Settings saved.' });
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="profile-title" className={sectionClass}>
      <h2 id="profile-title" className={sectionTitleClass}>Group profile</h2>
      <p className="mb-6 text-sm text-text-secondary">Shown at the top of the board.</p>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <GroupProfileFields values={values} errors={errors} onChange={(next) => { setValues((previous) => ({ ...previous, ...next })); setErrors({}); setNotice(null); }} />
        {notice ? <Banner tone={notice.tone} title={notice.text} /> : null}
        <button type="submit" className={`${buttonClass.primary} self-start`} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
      </form>
    </section>
  );
}

function AccessCode({ api, settings, onRotated }: { api: StudyGroupApi; settings: GroupSettings; onRotated: (settings: GroupSettings) => void }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(settings.accessCode);
      setStatus('Copied to the clipboard.');
    } catch {
      setStatus("Couldn't copy. Select the code and copy it manually.");
    }
  };

  const rotate = async () => {
    if (!window.confirm('Create a new access code? The current code stops working for new requests. Members and pending requests stay.')) return;
    setBusy(true);
    try {
      onRotated((await api.rotateAccessCode(settings.id)).settings);
      setStatus('New code created.');
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="code-title" className={sectionClass}>
      <h2 id="code-title" className={sectionTitleClass}>Access code</h2>
      <p className="mb-4 text-sm text-text-secondary">Share it with people you invite. They need it to ask to join, and you approve each request.</p>
      <div className="flex flex-wrap items-center gap-3">
        <code className="rounded-lg border border-line bg-bg px-4 py-2.5 font-mono text-lg" aria-label="Access code">{settings.accessCode}</code>
        <button type="button" className={buttonClass.secondarySmall} onClick={() => void copy()}>Copy</button>
        <button type="button" className={buttonClass.secondarySmall} disabled={busy} onClick={() => void rotate()}>Create a new code</button>
      </div>
      {status ? <p role="status" className={`${hintClass} mt-3`}>{status}</p> : null}
    </section>
  );
}

function Requests({ api, groupId, requests, canDeleteMessages, onChange }: { api: StudyGroupApi; groupId: string; requests: JoinRequest[]; canDeleteMessages: boolean; onChange: (requests: JoinRequest[], members?: Member[]) => void }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const act = async (request: JoinRequest, action: 'approve' | 'reject' | 'message') => {
    let reason = '';
    if (action === 'message') {
      const answer = askReason(`the message from ${request.displayName}`);
      if (answer === null) return;
      reason = answer;
    }
    setBusyId(request.id);
    setNotice(null);
    try {
      if (action === 'approve') {
        await api.approveRequest(groupId, request.id);
        onChange(requests.filter((item) => item.id !== request.id), (await api.listMembers(groupId)).members);
        setNotice({ tone: 'success', text: `${request.displayName} is now a member.` });
      } else if (action === 'reject') {
        await api.rejectRequest(groupId, request.id);
        onChange(requests.filter((item) => item.id !== request.id));
        setNotice({ tone: 'success', text: `Rejected the request from ${request.displayName}.` });
      } else {
        await api.deleteRequestMessage(groupId, request.id, reason);
        onChange(requests.map((item) => (item.id === request.id ? { ...item, message: null } : item)));
        setNotice({ tone: 'success', text: 'Message deleted.' });
      }
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-labelledby="requests-title" className={sectionClass}>
      <h2 id="requests-title" className={sectionTitleClass}>Join requests</h2>
      <p className="mb-4 text-sm text-text-secondary">People who entered the access code. Approve the ones you know.</p>
      {notice ? <div className="mb-4"><Banner tone={notice.tone} title={notice.text} /></div> : null}
      {requests.length ? (
        <ul className="m-0 list-none p-0">
          {requests.map((request) => (
            <li key={request.id} className={rowClass}>
              <span className="wrap-anywhere">{request.displayName} <span className={hintClass}>· {formatDate(request.createdAt)}</span></span>
              <span className="col-start-2 row-span-2 row-start-1 flex flex-wrap gap-2">
                <button type="button" className={buttonClass.primarySmall} disabled={busyId !== null} aria-label={`Approve ${request.displayName}`} onClick={() => void act(request, 'approve')}>Approve</button>
                <button type="button" className={buttonClass.secondarySmall} disabled={busyId !== null} aria-label={`Reject ${request.displayName}`} onClick={() => void act(request, 'reject')}>Reject</button>
                {canDeleteMessages && request.message ? <button type="button" className={buttonClass.dangerGhost} disabled={busyId !== null} aria-label={`Delete the message from ${request.displayName}`} onClick={() => void act(request, 'message')}>Delete message</button> : null}
              </span>
              {request.message ? <span className="col-start-1 text-sm text-text-secondary whitespace-pre-line wrap-anywhere">{request.message}</span> : null}
            </li>
          ))}
        </ul>
      ) : <p className={hintClass}>No pending requests.</p>}
    </section>
  );
}

function Members({ api, groupId, members, onRemoved }: { api: StudyGroupApi; groupId: string; members: Member[]; onRemoved: (userId: string) => void }) {
  const [error, setError] = useState('');

  const remove = async (member: Member) => {
    if (!window.confirm(`Remove ${member.displayName} from the group? Their access ends now; their suggestions stay.`)) return;
    try {
      await api.removeMember(groupId, member.userId);
      onRemoved(member.userId);
    } catch (removeError) {
      setError(errorMessage(removeError));
    }
  };

  return (
    <section aria-labelledby="members-settings-title" className={sectionClass}>
      <h2 id="members-settings-title" className={sectionTitleClass}>Members</h2>
      {error ? <div className="my-3"><Banner tone="error" title={error} /></div> : null}
      <ul className="m-0 list-none p-0">
        {members.map((member) => (
          <li key={member.userId} className={rowClass}>
            <span className="wrap-anywhere">{member.displayName} {member.role === 'owner' ? <span className={hintClass}>· Owner</span> : <span className={hintClass}>· joined {formatDate(member.joinedAt)}</span>}</span>
            {member.role === 'member' ? <button type="button" className={buttonClass.dangerGhost} aria-label={`Remove ${member.displayName}`} onClick={() => void remove(member)}>Remove</button> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DeletedMaterials({ api, groupId, materials, isPlatformAdmin, onRestored }: { api: StudyGroupApi; groupId: string; materials: DeletedMaterial[]; isPlatformAdmin: boolean; onRestored: (id: number) => void }) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const restore = async (material: DeletedMaterial) => {
    setBusyId(material.id);
    setNotice(null);
    try {
      await api.restoreMaterial(groupId, material.id);
      onRestored(material.id);
      setNotice({ tone: 'success', text: `Restored “${material.title}”.` });
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-labelledby="deleted-title" className={sectionClass}>
      <h2 id="deleted-title" className={sectionTitleClass}>Deleted materials</h2>
      <p className="mb-5 text-sm text-text-secondary">Deleted items are hidden from the board and purged after 30 days. Only the platform admin can restore what the admin deleted.</p>
      {notice ? <div className="mb-4"><Banner tone={notice.tone} title={notice.text} /></div> : null}
      {materials.length ? (
        <ul className="m-0 list-none p-0">
          {materials.map((material) => (
            <li key={material.id} className={rowClass}>
              <span className="text-[15px] text-text-secondary wrap-anywhere">{material.title}</span>
              <span className="col-start-1 text-xs text-text-muted">{typeLabel(material.type)} · by {material.suggestedBy} · deleted {formatDate(material.deletedAt)}{material.deletedByAdmin ? ' by the platform admin' : ''}</span>
              <span className="col-start-2 row-span-2 row-start-1">
                <button type="button" className={buttonClass.secondarySmall} disabled={busyId !== null || (material.deletedByAdmin && !isPlatformAdmin)} aria-label={`Restore “${material.title}”`} onClick={() => void restore(material)}>Restore</button>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className={hintClass}>No deleted materials.</p>}
    </section>
  );
}

function DeleteGroup({ api, settings, needsReason }: { api: StudyGroupApi; settings: GroupSettings; needsReason: boolean }) {
  const [confirmName, setConfirmName] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.deleteGroup(settings.id, { confirmName, reason: needsReason ? reason : undefined });
      navigate(needsReason ? '/study-groups/admin' : '/study-groups/my');
    } catch (deleteError) {
      setError(errorMessage(deleteError));
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="delete-title" className={`${sectionClass} border-red-500/40`}>
      <h2 id="delete-title" className={sectionTitleClass}>Delete the group</h2>
      <p className="mb-5 text-sm text-text-secondary">The group disappears from the public page and every member loses access. Its data is purged after 30 days.</p>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Field id="delete-confirm" label={`Type “${settings.name}” to confirm`}>
          <input id="delete-confirm" className={inputClass} value={confirmName} autoComplete="off" onChange={(event) => setConfirmName(event.target.value)} />
        </Field>
        {needsReason ? (
          <Field id="delete-reason" label="Reason (10 to 500 characters, shown to the owner)">
            <textarea id="delete-reason" className={`${inputClass} min-h-20`} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
          </Field>
        ) : null}
        {error ? <Banner tone="error" title={error} /> : null}
        <button type="submit" className={`${buttonClass.primary} self-start bg-red-600 hover:bg-red-500`} disabled={busy || confirmName.trim().toLowerCase() !== settings.name.trim().toLowerCase()}>Delete group</button>
      </form>
    </section>
  );
}
