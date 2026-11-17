'use client';

import { useCallback, useEffect, useState } from 'react';

import type { AdminGroup, ModerationAction } from '@/workers/study-group/contract';

import { groupPath, type StudyGroupApi } from './api';
import { formatDate } from './helpers';
import { RequireUser, useSession } from './session';
import { Banner, buttonClass, cardClass, eyebrowClass, hintClass } from './ui';

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

  return { items, cursor, error, more: () => void load(cursor) };
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
              <p className="text-text-secondary wrap-anywhere">{action.actorName ?? 'Former admin'} · {formatDate(action.createdAt)} · Reason: {action.reason}</p>
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
  return (
    <RequireUser>
      {(user) => user.isPlatformAdmin ? (
        <div className="flex flex-col gap-8">
          <div>
            <p className={eyebrowClass}>Platform admin</p>
            <h1 className="mt-2 text-3xl font-normal tracking-tight sm:text-5xl">Moderation</h1>
          </div>
          <GroupsSection api={api} />
          <LogSection api={api} />
        </div>
      ) : <Banner tone="error" title="Only the platform admin can open this page." />}
    </RequireUser>
  );
}
