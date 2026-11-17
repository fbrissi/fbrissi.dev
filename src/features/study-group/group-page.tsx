'use client';

import { useEffect, useState } from 'react';

import type { CurrentUser, GroupResponse } from '@/workers/study-group/contract';

import { hasStatus, type StudyGroupApi } from './api';
import { groupIdFromPath } from './helpers';
import { JoinScreen } from './join-screen';
import { RequireUser, useSession } from './session';
import { StudyGroupBoard } from './study-group-board';
import { Banner, buttonClass } from './ui';

type GroupState = { kind: 'loading' } | { kind: 'ready'; data: GroupResponse } | { kind: 'join' } | { kind: 'missing' } | { kind: 'error' };

export function NotFoundGroup() {
  return (
    <div className="flex flex-col items-start gap-3">
      <Banner tone="error" title="This group doesn't exist or was deleted." />
      <a className={buttonClass.secondarySmall} href="/study-groups">See the study groups</a>
    </div>
  );
}

function GroupLoader({ api, groupId, user }: { api: StudyGroupApi; groupId: string; user: CurrentUser }) {
  const [state, setState] = useState<GroupState>({ kind: 'loading' });

  useEffect(() => {
    api.getGroup(groupId).then(
      (data) => setState({ kind: 'ready', data }),
      (error: unknown) => setState({ kind: hasStatus(error, 403) ? 'join' : hasStatus(error, 404) ? 'missing' : 'error' })
    );
  }, [api, groupId]);

  if (state.kind === 'loading') return <p role="status" className="text-text-secondary">Loading the group…</p>;
  if (state.kind === 'join') return <JoinScreen api={api} groupId={groupId} />;
  if (state.kind === 'missing') return <NotFoundGroup />;
  if (state.kind === 'error') return <Banner tone="error" title="Couldn't load the group. Please try again." />;
  return <StudyGroupBoard api={api} group={state.data.group} role={state.data.role} user={user} canParticipate={state.data.canParticipate} />;
}

/** Static shell for /study-groups/g/<id>: members see the board, everyone else signed in sees the join screen (3.4). */
export function GroupBoardView() {
  const { api } = useSession();
  const [groupId, setGroupId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setGroupId(groupIdFromPath(window.location.pathname));
  }, []);

  if (groupId === undefined) return null;
  if (groupId === null) return <NotFoundGroup />;
  return <RequireUser>{(user) => <GroupLoader api={api} groupId={groupId} user={user} />}</RequireUser>;
}
