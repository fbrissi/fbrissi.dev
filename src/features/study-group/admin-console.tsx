'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { BAN_RETENTION_YEARS, type AdminGroup, type AdminUser, type ModerationAction } from '@/workers/study-group/contract';

import { errorMessage, groupPath, type StudyGroupApi } from './api';
import { formatDate, formatYearDate, pluralize } from './helpers';
import { useReasonDialog, type ReasonRequest } from './reason-dialog';
import { RequireUser, useSession } from './session';
import { Banner, buttonClass, cardClass, eyebrowClass, hintClass, inputClass } from './ui';

const sectionClass = `${cardClass} p-6 sm:p-8`;
const rowClass = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-line py-3.5';

function usePaged<T>(fetchPage: (cursor: string | null) => Promise<{ items: T[]; nextCursor: string | null }>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async (from: string | null) => {
    try {
      const page = await fetchPage(from);
      setItems((list) => (from ? [...(list as T[]), ...page.items] : page.items));
      setCursor(page.nextCursor);
    } catch {
      setError(true);
    }
  }, [fetchPage]);

  useEffect(() => {
    void load(null);
  }, [load]);

  return { items, cursor, error, more: () => void load(cursor), replace: (change: (list: T[]) => T[]) => setItems((list) => change(list as T[])) };
}

function GroupsSection({ api }: { api: StudyGroupApi }) {
  const fetchPage = useCallback((cursor: string | null) => api.adminGroups(cursor).then((page) => ({ items: page.groups, nextCursor: page.nextCursor })), [api]);
  const { items, cursor, error, more } = usePaged<AdminGroup>(fetchPage);

  return (
    <section aria-labelledby="admin-groups-title" className={sectionClass}>
      <h2 id="admin-groups-title" className="mb-1 text-2xl font-normal tracking-tight">All groups</h2>
      <p className="mb-4 text-sm text-text-secondary">Open a group&apos;s board or settings to moderate it. Deleting needs a reason that the owner sees.</p>
      {error ? <Banner tone="error" title="Couldn't load the groups." /> : null}
      {items === null && !error ? <p role="status" className={hintClass}>Loading…</p> : null}
      {items?.length === 0 ? <p className={hintClass}>No groups yet.</p> : null}
      {items?.length ? (
        <ul className="m-0 list-none p-0">
          {items.map((group) => (
            <li key={group.id} className={rowClass}>
              <span className="wrap-anywhere">{group.name}</span>
              <span className="col-start-1 text-xs text-text-muted">
                Owner: {group.ownerName ?? 'unclaimed'} · {group.memberCount} members · {group.listed ? 'listed' : 'unlisted'} · created {formatDate(group.createdAt)}
              </span>
              <span className="col-start-2 row-span-2 row-start-1 flex gap-2">
                <a className={buttonClass.ghost} href={groupPath(group.id)}>Board</a>
                <a className={buttonClass.secondarySmall} href={groupPath(group.id, '/settings')}>Settings</a>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {cursor ? <button type="button" className={`${buttonClass.secondarySmall} mt-4`} onClick={more}>Load more</button> : null}
    </section>
  );
}

type BanAction = 'ban' | 'renew' | 'unban';

function ownedGroupsText(count: number): string {
  if (count === 0) return 'They own no groups.';
  return `The ${pluralize(count, 'group')} they own ${count === 1 ? 'is' : 'are'} deleted permanently and can’t be restored.`;
}

function banDialog(user: AdminUser, action: BanAction): ReasonRequest {
  if (action === 'ban') {
    return {
      title: `Ban ${user.displayName}?`,
      text: `They can’t sign in or sign up again while banned, and their content is hidden. ${ownedGroupsText(user.ownedGroups)} They get an email with the reason. The ban lasts ${BAN_RETENTION_YEARS} years unless you renew or lift it.`,
      confirmLabel: 'Ban user',
      destructive: true,
    };
  }
  if (action === 'renew') {
    return {
      title: `Renew the ban on ${user.displayName}?`,
      text: `The ban is kept for another ${BAN_RETENTION_YEARS} years from today. The reason is recorded in the moderation log.`,
      confirmLabel: 'Renew ban',
    };
  }
  return {
    title: `Lift the ban on ${user.displayName}?`,
    text: 'They can sign in again and get an email saying their account was restored. Groups deleted by the ban stay deleted. The reason is recorded in the moderation log.',
    confirmLabel: 'Unban',
  };
}

function banExpiry(from: string): string {
  const date = new Date(from);
  date.setUTCFullYear(date.getUTCFullYear() + BAN_RETENTION_YEARS);
  return date.toISOString();
}

/** `onModerated` runs after each ban, renewal or unban, so the moderation log shows it right away. */
function UsersSection({ api, onModerated }: { api: StudyGroupApi; onModerated: () => void }) {
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const fetchPage = useCallback((cursor: string | null) => api.adminUsers(submitted, cursor).then((page) => ({ items: page.users, nextCursor: page.nextCursor })), [api, submitted]);
  const { items, cursor, error, more, replace } = usePaged<AdminUser>(fetchPage);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const { dialog, ask } = useReasonDialog();
  const sectionRef = useRef<HTMLElement>(null);
  // The button that replaces the one the admin used (Ban ↔ Unban) gets the focus back after the list re-renders.
  const [focusLabel, setFocusLabel] = useState<string | null>(null);

  useEffect(() => {
    if (focusLabel === null) return;
    const section = sectionRef.current!;
    // The search field is the fallback when the row is gone.
    const targets: HTMLElement[] = Array.from(section.querySelectorAll('button')).filter((button) => button.getAttribute('aria-label') === focusLabel);
    [...targets, section.querySelector<HTMLElement>('#user-search')!][0].focus();
    setFocusLabel(null);
  }, [focusLabel, items]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(search.trim());
  };

  const act = async (listed: AdminUser, action: BanAction) => {
    // The ban warning counts the groups the user owns now, not when the list was loaded.
    const user = action === 'ban'
      ? await api.adminUsers(listed.id).then((page) => page.users.find((item) => item.id === listed.id) ?? listed, () => listed)
      : listed;
    const reason = await ask(banDialog(user, action));
    if (reason === null) return;
    setNotice(null);
    try {
      if (action === 'ban') await api.banUser(user.id, reason);
      else if (action === 'renew') await api.renewBan(user.id, reason);
      else await api.unbanUser(user.id, reason);
      const at = new Date().toISOString();
      replace((list) => list.map((item) => {
        if (item.id !== user.id) return item;
        if (action === 'ban') return { ...item, ownedGroups: 0, ban: { reason, createdAt: at, expiresAt: banExpiry(at) } };
        if (action === 'renew') return { ...item, ban: { ...item.ban!, reason, expiresAt: banExpiry(at) } };
        return { ...item, ban: null };
      }));
      const done = { ban: `${user.displayName} is banned.`, renew: `The ban on ${user.displayName} was renewed.`, unban: `${user.displayName} is no longer banned.` };
      setNotice({ tone: 'success', text: done[action] });
      setFocusLabel({ ban: `Unban ${user.displayName}`, renew: `Renew the ban on ${user.displayName}`, unban: `Ban ${user.displayName}` }[action]);
      onModerated();
    } catch (actionError) {
      setNotice({ tone: 'error', text: errorMessage(actionError) });
    }
  };

  return (
    <section ref={sectionRef} aria-labelledby="admin-users-title" className={sectionClass}>
      {dialog}
      <h2 id="admin-users-title" className="mb-1 text-2xl font-normal tracking-tight">Users</h2>
      <p className="mb-4 text-sm text-text-secondary">Search by display name, exact email or user ID. Emails are matched but never shown.</p>
      <form role="search" onSubmit={submit} className="mb-4 flex flex-wrap gap-2">
        <label htmlFor="user-search" className="sr-only">Search users</label>
        <input id="user-search" className={`${inputClass} max-w-sm`} value={search} onChange={(event) => setSearch(event.target.value)} />
        <button type="submit" className={buttonClass.secondarySmall}>Search</button>
      </form>
      {notice ? <div className="mb-4"><Banner tone={notice.tone} title={notice.text} /></div> : null}
      {error ? <Banner tone="error" title="Couldn't load the users." /> : null}
      {items === null && !error ? <p role="status" className={hintClass}>Loading…</p> : null}
      {items?.length === 0 ? <p className={hintClass}>No users found.</p> : null}
      {items?.length ? (
        <ul className="m-0 list-none p-0">
          {items.map((user) => (
            <li key={user.id} className={rowClass}>
              <span className="wrap-anywhere">{user.displayName} <span className={hintClass}>· {user.id}</span></span>
              <span className="col-start-1 text-xs text-text-muted wrap-anywhere">
                Joined {formatDate(user.createdAt)} · {pluralize(user.ownedGroups, 'owned group')}{user.isPlatformAdmin ? ' · Platform admin' : ''}
                {user.ban ? ` · Banned ${formatDate(user.ban.createdAt)}, until ${formatYearDate(user.ban.expiresAt)}: ${user.ban.reason}` : ''}
              </span>
              <span className="col-start-2 row-span-2 row-start-1 flex flex-wrap justify-end gap-2">
                {user.isPlatformAdmin ? null : user.ban ? (
                  <>
                    <button type="button" className={buttonClass.ghost} aria-label={`Renew the ban on ${user.displayName}`} onClick={() => void act(user, 'renew')}>Renew ban</button>
                    <button type="button" className={buttonClass.secondarySmall} aria-label={`Unban ${user.displayName}`} onClick={() => void act(user, 'unban')}>Unban</button>
                  </>
                ) : (
                  <button type="button" className={buttonClass.dangerGhost} aria-label={`Ban ${user.displayName}`} onClick={() => void act(user, 'ban')}>Ban</button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {cursor ? <button type="button" className={`${buttonClass.secondarySmall} mt-4`} onClick={more}>Load more</button> : null}
    </section>
  );
}

function LogSection({ api }: { api: StudyGroupApi }) {
  const fetchPage = useCallback((cursor: string | null) => api.moderationLog(cursor).then((page) => ({ items: page.actions, nextCursor: page.nextCursor })), [api]);
  const { items, cursor, error, more } = usePaged<ModerationAction>(fetchPage);

  return (
    <section aria-labelledby="log-title" className={sectionClass}>
      <h2 id="log-title" className="mb-1 text-2xl font-normal tracking-tight">Moderation log</h2>
      <p className="mb-4 text-sm text-text-secondary">Newest first. Entries are kept for 12 months, with the label and the reason only.</p>
      {error ? <Banner tone="error" title="Couldn't load the moderation log." /> : null}
      {items === null && !error ? <p role="status" className={hintClass}>Loading…</p> : null}
      {items?.length === 0 ? <p className={hintClass}>No moderation actions yet.</p> : null}
      {items?.length ? (
        <ol className="m-0 list-none p-0">
          {items.map((action) => (
            <li key={action.id} className="border-t border-line py-3 text-sm">
              <p className="wrap-anywhere">{action.action} · {action.targetType} {action.targetId}{action.groupId ? ` in ${action.groupId}` : ''} · “{action.label}”</p>
              <p className="text-text-secondary wrap-anywhere">{action.actorName ?? (action.reason === 'Ban expired' ? 'Automatic' : 'Former admin')} · {formatDate(action.createdAt)} · Reason: {action.reason}</p>
            </li>
          ))}
        </ol>
      ) : null}
      {cursor ? <button type="button" className={`${buttonClass.secondarySmall} mt-4`} onClick={more}>Load more</button> : null}
    </section>
  );
}

export function AdminConsoleView() {
  const { api } = useSession();
  const [logVersion, setLogVersion] = useState(0);
  return (
    <RequireUser>
      {(user) => user.isPlatformAdmin ? (
        <div className="flex flex-col gap-8">
          <div>
            <p className={eyebrowClass}>Platform admin</p>
            <h1 className="mt-2 text-3xl font-normal tracking-tight sm:text-5xl">Moderation</h1>
          </div>
          <GroupsSection api={api} />
          <UsersSection api={api} onModerated={() => setLogVersion((version) => version + 1)} />
          <LogSection key={logVersion} api={api} />
        </div>
      ) : <Banner tone="error" title="Only the platform admin can open this page." />}
    </RequireUser>
  );
}
