'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { CreateMaterialInput, CurrentUser, GroupInfo, GroupRole, Material, Member, Round, RoundMode, TallyEntry } from '@/workers/study-group/contract';

import { errorMessage, type StudyGroupApi } from './api';
import { navigate } from './navigation';
import { GroupHeader } from './group-header';
import { applyVote, isEligible, pluralize } from './helpers';
import { DiscussedList, MaterialCard, MaterialListSkeleton } from './materials';
import { RoundPanel } from './round-panel';
import { useReasonDialog, type ReasonRequest } from './reason-dialog';
import { SuggestForm } from './suggest-form';
import { Banner, buttonClass, cardClass, hintClass, StateCard } from './ui';

type LoadState = 'loading' | 'ready' | 'error';

export const pollIntervalMs = 8000;
export const highlightMs = 3000;

type BoardProps = {
  api: StudyGroupApi;
  group: GroupInfo;
  role: GroupRole;
  user: CurrentUser;
  /** False for a platform admin outside the group: they manage it but don't suggest or vote (D7). */
  canParticipate: boolean;
};

export function StudyGroupBoard({ api, group, role, user, canParticipate }: BoardProps) {
  const groupId = group.id;
  const canModerate = role !== 'member';
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [tally, setTally] = useState<TallyEntry[]>([]);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const { dialog, ask, confirm } = useReasonDialog();
  const [actionNotice, setActionNotice] = useState('');
  const openTitle = useRef<HTMLHeadingElement>(null);

  const applyRound = ({ round: nextRound, tally: nextTally, myVote: nextVote }: { round: Round | null; tally: TallyEntry[]; myVote: number | null }) => {
    setRound(nextRound);
    setTally(nextTally);
    setMyVote(nextVote);
  };

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const [list, current] = await Promise.all([api.listMaterials(groupId), api.getCurrentRound(groupId)]);
      setMaterials(list.materials);
      applyRound(current);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [api, groupId]);

  const refreshRound = useCallback(async () => {
    try {
      applyRound(await api.getCurrentRound(groupId));
    } catch {
      // Keep the last known round; the next poll or focus retries.
    }
  }, [api, groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const voting = round?.status === 'open';
  useEffect(() => {
    if (!voting) return;
    const id = window.setInterval(() => void refreshRound(), pollIntervalMs);
    return () => window.clearInterval(id);
  }, [voting, refreshRound]);

  useEffect(() => {
    const onFocus = () => void refreshRound();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshRound]);

  useEffect(() => {
    if (highlightId === null) return;
    const id = window.setTimeout(() => setHighlightId(null), highlightMs);
    return () => window.clearTimeout(id);
  }, [highlightId]);

  const run = async (action: () => Promise<void>, confirmation?: ReasonRequest) => {
    // A new action clears the last message, so an old status never sits next to it.
    setActionError('');
    setActionNotice('');
    if (confirmation && !(await confirm(confirmation))) return;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const startRound = (mode: RoundMode) => run(async () => applyRound(await api.createRound(groupId, { mode })));
  const closeRound = (id: number) => run(async () => applyRound(await api.closeRound(groupId, id)), {
    title: 'Close the vote and pick the winner?',
    text: 'Voting ends now and the material with the most votes becomes this week’s topic.',
    confirmLabel: 'Close vote',
  });
  const cancelRound = (id: number) => run(async () => applyRound(await api.cancelRound(groupId, id)), {
    title: 'Cancel this round?',
    text: 'All votes in this round are discarded. This can’t be undone.',
    confirmLabel: 'Cancel round',
    destructive: true,
  });

  const replaceMaterial = (updated: Material) => setMaterials((list) => list.map((item) => (item.id === updated.id ? updated : item)));
  const setStatus = (material: Material, status: 'open' | 'discussed') => run(async () => replaceMaterial((await api.updateMaterial(groupId, material.id, { status })).material));
  const approve = (material: Material) => run(async () => replaceMaterial((await api.approveMaterial(groupId, material.id)).material));
  const deleteMaterial = async (material: Material) => {
    setActionError('');
    setActionNotice('');
    let reason: string | undefined;
    if (role === 'platform_admin') {
      const answer = await ask({
        title: `Delete “${material.title}” permanently?`,
        text: 'The suggestion and its votes are deleted. This can’t be undone. The reason is recorded in the moderation log and shown to the owner.',
        confirmLabel: 'Delete permanently',
        destructive: true,
      });
      if (answer === null) return;
      reason = answer;
    }
    void run(async () => {
      await api.deleteMaterial(groupId, material.id, reason);
      setMaterials((list) => list.filter((item) => item.id !== material.id));
      setTally((entries) => entries.filter((entry) => entry.materialId !== material.id));
      setActionNotice(`“${material.title}” was deleted permanently.`);
      // The deleted card took its button with it: move the focus to the list heading.
      openTitle.current!.focus();
    }, reason === undefined ? {
      title: `Delete “${material.title}” permanently?`,
      text: 'The suggestion and its votes are deleted. This can’t be undone.',
      confirmLabel: 'Delete permanently',
      destructive: true,
    } : undefined);
  };

  const vote = async (roundId: number, material: Material) => {
    const previous = { tally, myVote };
    setTally(applyVote(tally, myVote, material.id, user.displayName));
    setMyVote(material.id);
    setActionError('');
    try {
      applyRound(await api.castVote(groupId, roundId, { materialId: material.id }));
    } catch (error) {
      setTally(previous.tally);
      setMyVote(previous.myVote);
      setActionError(errorMessage(error));
    }
  };

  const createMaterial = async (input: CreateMaterialInput) => {
    const { material } = await api.createMaterial(groupId, input);
    setMaterials((list) => [material, ...list]);
    setHighlightId(material.id);
    return material;
  };

  const openMaterials = materials.filter((material) => material.status !== 'discussed');
  const discussed = materials.filter((material) => material.status === 'discussed').sort((a, b) => String(b.discussedAt).localeCompare(String(a.discussedAt)));

  return (
    <>
      <GroupHeader group={group} role={role} />
      {dialog}
      {actionError ? <div className="mb-6"><Banner tone="error" title={actionError} /></div> : null}
      {actionNotice ? <div className="mb-6"><Banner tone="success" title={actionNotice} /></div> : null}
      {loadState === 'ready' ? (
        <RoundPanel
          round={round}
          tally={tally}
          materials={materials}
          busy={busy}
          canModerate={canModerate}
          onStart={(mode) => void startRound(mode)}
          onClose={() => void closeRound((round as Round).id)}
          onCancel={() => void cancelRound((round as Round).id)}
          onSetStatus={(material, status) => void setStatus(material, status)}
        />
      ) : null}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
        <div className="min-w-0">
          <section className="mb-12" aria-labelledby="open-title">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="open-title" ref={openTitle} tabIndex={-1} className="text-2xl font-normal tracking-tight focus:outline-none">Open materials</h2>
              {loadState === 'ready' && openMaterials.length ? <span className="text-sm text-text-muted">{pluralize(openMaterials.length, 'item')} · newest first</span> : null}
            </div>
            {loadState === 'loading' ? <MaterialListSkeleton /> : null}
            {loadState === 'error' ? (
              <StateCard
                role="alert"
                tone="error"
                icon={<><path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="10" /></>}
                title="Couldn't load the board"
                text="Check your connection and try again. Your suggestions are safe."
                action={<button type="button" className={buttonClass.secondarySmall} onClick={() => void load()}>Try again</button>}
              />
            ) : null}
            {loadState === 'ready' && !openMaterials.length ? (
              <StateCard
                dashed
                icon={<><path d="M4 19.5V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14.5" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20" /><path d="M12 7v6M9 10h6" /></>}
                title="Nothing to discuss yet"
                text="Be the first to suggest a video, article, podcast or book for the group."
                action={<a className={buttonClass.primarySmall} href="#suggest">Suggest material</a>}
              />
            ) : null}
            {loadState === 'ready' && openMaterials.length ? (
              <div className="grid gap-4 md:max-lg:grid-cols-2">
                {openMaterials.map((material) => {
                  const voters = tally.find((entry) => entry.materialId === material.id)?.voters ?? [];
                  return (
                    <MaterialCard
                      key={material.id}
                      material={material}
                      highlighted={highlightId === material.id}
                      busy={busy}
                      canModerate={canModerate}
                      vote={round?.status === 'open' && material.status === 'open' ? { eligible: isEligible(material, round), voters, mine: myVote === material.id, onVote: canParticipate ? () => void vote(round.id, material) : undefined } : undefined}
                      onSetStatus={(item, status) => void setStatus(item, status)}
                      onApprove={(item) => void approve(item)}
                      onDelete={(material) => void deleteMaterial(material)}
                    />
                  );
                })}
              </div>
            ) : null}
          </section>
          {loadState === 'ready' && discussed.length ? <DiscussedList materials={discussed} busy={busy} canModerate={canModerate} onSetStatus={(item, status) => void setStatus(item, status)} /> : null}
        </div>
        <aside id="suggest" className="order-first flex flex-col gap-8 lg:sticky lg:top-16 lg:order-none">
          {canParticipate ? <SuggestForm authorName={user.displayName} onCreate={createMaterial} /> : (
            <p className={`${cardClass} p-6 text-sm text-text-secondary`}>You manage this group as the platform admin. Only members suggest materials and vote.</p>
          )}
          <MembersPanel api={api} groupId={groupId} role={role} requiresAccessCode={group.requiresAccessCode !== false} />
        </aside>
      </div>
    </>
  );
}

function MembersPanel({ api, groupId, role, requiresAccessCode }: { api: StudyGroupApi; groupId: string; role: GroupRole; requiresAccessCode: boolean }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState('');
  const { dialog, confirm } = useReasonDialog();

  useEffect(() => {
    api.listMembers(groupId).then(({ members: list }) => setMembers(list), () => setError("Couldn't load the members."));
  }, [api, groupId]);

  const leave = async () => {
    setError('');
    const confirmed = await confirm({
      title: 'Leave this group?',
      text: requiresAccessCode ? 'You will need the access code and the owner’s approval to come back.' : 'You will need the owner’s approval to come back.',
      confirmLabel: 'Leave group',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await api.leaveGroup(groupId);
      navigate('/study-groups/my');
    } catch (leaveError) {
      setError(errorMessage(leaveError));
    }
  };

  return (
    <section aria-labelledby="members-title" className={`${cardClass} p-6`}>
      {dialog}
      <h2 id="members-title" className="mb-3 text-lg font-normal">Members</h2>
      {error ? <p role="alert" className="mb-3 text-sm text-red-500">{error}</p> : null}
      {members ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm text-text-secondary">
          {members.map((member) => (
            <li key={member.userId} className="wrap-anywhere">
              {member.displayName}{member.role === 'owner' ? <span className={`${hintClass} ml-2`}>Owner</span> : null}
            </li>
          ))}
        </ul>
      ) : error ? null : <p role="status" className={hintClass}>Loading members…</p>}
      {role === 'member' ? <button type="button" className={`${buttonClass.dangerGhost} mt-3 px-0!`} onClick={() => void leave()}>Leave group</button> : null}
    </section>
  );
}
