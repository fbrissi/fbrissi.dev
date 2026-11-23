'use client';

import { useEffect, useState } from 'react';

import { formatAskAgainAt, type MyGroupsResponse } from '@/workers/study-group/contract';

import { groupPath } from './api';
import { GroupIcon } from './group-icon';
import { formatDate, moderationActionLabel, takeFlash } from './helpers';
import { RequireUser, useSession } from './session';
import { Banner, buttonClass, cardClass, eyebrowClass, hintClass } from './ui';

function MyGroupsList() {
  const { api } = useSession();
  const [data, setData] = useState<MyGroupsResponse | null>(null);
  const [error, setError] = useState(false);
  const [flash, setFlashText] = useState('');

  useEffect(() => {
    setFlashText((current) => current || takeFlash());
    api.myGroups().then(setData, () => setError(true));
  }, [api]);

  if (error) return <Banner tone="error" title="Couldn't load your groups. Please try again." />;
  if (!data) return <p role="status" className="text-text-secondary">Loading your groups…</p>;

  return (
    <div className="flex flex-col gap-10">
      {flash ? <Banner tone="success" title={flash} /> : null}
      {data.notices.length ? (
        <section aria-labelledby="notices-title" className={`${cardClass} border-red-500/40 p-6`}>
          <h2 id="notices-title" className="mb-2 text-xl font-normal">Moderation notices</h2>
          <p className="mb-3 text-sm text-text-secondary">The platform admin removed content from groups you own in the last 30 days.</p>
          <ul className="m-0 list-none p-0">
            {data.notices.map((notice) => (
              <li key={notice.id} className="border-t border-line py-3 text-sm">
                <p className="wrap-anywhere">{moderationActionLabel(notice.action)}: “{notice.label}” · {formatDate(notice.createdAt)}</p>
                <p className="text-text-secondary wrap-anywhere">Reason: {notice.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="groups-title">
        <h2 id="groups-title" className="mb-4 text-2xl font-normal tracking-tight">Your groups</h2>
        {data.groups.length ? (
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
            {data.groups.map((group) => (
              <li key={group.id} className={`${cardClass} flex flex-col gap-2 p-5`}>
                <span className={hintClass}>{group.role === 'owner' ? 'Owner' : 'Member'}</span>
                <span className="flex items-center gap-3">
                  <GroupIcon url={group.iconUrl} size={40} />
                  <a className="text-xl font-normal tracking-tight text-text hover:text-accent wrap-anywhere" href={groupPath(group.id)}>{group.name}</a>
                </span>
                <p className="text-sm text-text-secondary wrap-anywhere">{group.summary}</p>
                {group.role === 'owner' ? <a className={`${buttonClass.ghost} self-start px-0!`} href={groupPath(group.id, '/settings')}>Settings</a> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-secondary">You don&apos;t belong to any group yet. <a className="text-accent" href="/study-groups">Find a group</a> or <a className="text-accent" href="/study-groups/new">create one</a>.</p>
        )}
      </section>
      {data.pending.length ? (
        <section aria-labelledby="pending-title">
          <h2 id="pending-title" className="mb-4 text-2xl font-normal tracking-tight">Waiting for approval</h2>
          <ul className="m-0 list-none p-0">
            {data.pending.map((group) => (
              <li key={group.id} className="border-t border-line py-3 text-sm">
                <span className="wrap-anywhere">{group.name}</span> <span className={hintClass}>· requested {formatDate(group.requestedAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data.rejected.length ? (
        <section aria-labelledby="rejected-title">
          <h2 id="rejected-title" className="mb-4 text-2xl font-normal tracking-tight">Not approved</h2>
          <ul className="m-0 list-none p-0">
            {data.rejected.map((group) => (
              <li key={group.id} className="border-t border-line py-3 text-sm">
                <span className="wrap-anywhere">{group.name}</span>{' '}
                <span className={hintClass}>· the owner didn’t approve your request. You can ask again after {formatAskAgainAt(group.canAskAgainAt)}.</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function MyGroupsView() {
  return (
    <RequireUser>
      {(user) => (
        <section>
          <p className={eyebrowClass}>Signed in as {user.displayName}</p>
          <h1 className="mb-8 mt-2 text-3xl font-normal tracking-tight sm:text-5xl">My groups</h1>
          <MyGroupsList />
        </section>
      )}
    </RequireUser>
  );
}
