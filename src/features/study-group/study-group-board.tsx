'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { CreateMaterialInput, GroupInfo, Material, MaterialStatus, Round, RoundMode, RoundResponse, TallyEntry } from '@/workers/study-group/contract';

import { AccessGate } from './access-gate';
import { createStudyGroupApi, errorMessage, isUnauthorized } from './api';
import { GroupHeader } from './group-header';
import { accessCodeStorageKey, applyVote, findVote, isEligible, pluralize, readStorage, readStoredName, storeName, writeStorage } from './helpers';
import { DiscussedList, MaterialCard, MaterialListSkeleton } from './materials';
import { RoundPanel } from './round-panel';
import { SuggestForm } from './suggest-form';
import { Banner, buttonClass, StateCard } from './ui';

type LoadState = 'locked' | 'loading' | 'ready' | 'error';

export const pollIntervalMs = 8000;
export const highlightMs = 3000;

export function StudyGroupBoard({ apiUrl }: { apiUrl: string }) {
  const codeRef = useRef('');
  const api = useMemo(() => createStudyGroupApi(apiUrl, () => codeRef.current), [apiUrl]);
  const [codeRejected, setCodeRejected] = useState(false);
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [round, setRound] = useState<Round | null>(null);
  const [tally, setTally] = useState<TallyEntry[]>([]);
  const [name, setName] = useState('');
  const [voterError, setVoterError] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [highlightId, setHighlightId] = useState<number | null>(null);

  const applyRound = ({ round: nextRound, tally: nextTally }: { round: Round | null; tally: TallyEntry[] }) => {
    setRound(nextRound);
    setTally(nextTally);
  };

  const lock = useCallback(() => {
    setCodeRejected(Boolean(codeRef.current));
    codeRef.current = '';
    writeStorage('localStorage', accessCodeStorageKey, null);
    setGroup(null);
    setLoadState('locked');
  }, []);

  const load = useCallback(async () => {
    if (!codeRef.current) {
      lock();
      return;
    }
    setLoadState('loading');
    try {
      const [list, current] = await Promise.all([api.listMaterials(), api.getCurrentRound()]);
      setMaterials(list.materials);
      applyRound(current);
      setLoadState('ready');
      api.getGroup().then(({ group: info }) => setGroup(info), () => setGroup(null));
    } catch (error) {
      if (isUnauthorized(error)) lock();
      else setLoadState('error');
    }
  }, [api, lock]);

  const refreshRound = useCallback(async () => {
    if (!codeRef.current) return;
    try {
      applyRound(await api.getCurrentRound());
    } catch (error) {
      // Keep the last known round unless the code was revoked; the next poll or focus retries.
      if (isUnauthorized(error)) lock();
    }
  }, [api, lock]);

  useEffect(() => {
    codeRef.current = readStorage('localStorage', accessCodeStorageKey);
    setName(readStoredName());
    void load();
  }, [load]);

  const submitCode = (code: string) => {
    codeRef.current = code;
    writeStorage('localStorage', accessCodeStorageKey, code);
    setCodeRejected(false);
    void load();
  };

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

  const changeName = (value: string) => {
    setName(value);
    setVoterError('');
    storeName(value);
  };

  const run = async (action: () => Promise<void>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setActionError('');
    try {
      await action();
    } catch (error) {
      if (isUnauthorized(error)) lock();
      else setActionError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const startRound = (mode: RoundMode) => run(async () => applyRound(await api.createRound({ mode })));
  const closeRound = (id: number) => run(async () => applyRound(await api.closeRound(id)), 'Close the vote and pick the winner?');
  const cancelRound = (id: number) => run(async () => applyRound(await api.cancelRound(id)), 'Cancel this round? All votes will be discarded.');

  const replaceMaterial = (updated: Material) => setMaterials((list) => list.map((item) => (item.id === updated.id ? updated : item)));
  const setStatus = (material: Material, status: MaterialStatus) => run(async () => replaceMaterial((await api.updateMaterial(material.id, { status })).material));
  const deleteMaterial = (material: Material) => run(async () => {
    await api.deleteMaterial(material.id);
    setMaterials((list) => list.filter((item) => item.id !== material.id));
    setTally((entries) => entries.filter((entry) => entry.materialId !== material.id));
  }, `Delete “${material.title}”? It will be removed from the board.`);

  const vote = async (roundId: number, material: Material) => {
    const voterName = name.trim();
    if (!voterName) {
      setVoterError('Enter your name to vote.');
      document.getElementById('voter-name')?.focus();
      return;
    }
    const previous = tally;
    setTally(applyVote(previous, material.id, voterName));
    setActionError('');
    try {
      const result: RoundResponse = await api.castVote(roundId, { materialId: material.id, voterName });
      applyRound(result);
    } catch (error) {
      setTally(previous);
      if (isUnauthorized(error)) lock();
      else setActionError(errorMessage(error));
    }
  };

  const createMaterial = async (input: CreateMaterialInput) => {
    let material: Material;
    try {
      ({ material } = await api.createMaterial(input));
    } catch (error) {
      if (isUnauthorized(error)) lock();
      throw error;
    }
    setMaterials((list) => [material, ...list]);
    setHighlightId(material.id);
  };

  const openMaterials = materials.filter((material) => material.status === 'open');
  const discussed = materials.filter((material) => material.status === 'discussed').sort((a, b) => String(b.discussedAt).localeCompare(String(a.discussedAt)));
  const myVote = findVote(tally, name);

  if (loadState === 'locked') return <AccessGate rejected={codeRejected} onSubmit={submitCode} />;

  return (
    <>
      <GroupHeader group={group} />
      {actionError ? <div className="mb-6"><Banner tone="error" title={actionError} /></div> : null}
      {loadState === 'ready' ? (
        <RoundPanel
          round={round}
          tally={tally}
          materials={materials}
          name={name}
          voterError={voterError}
          busy={busy}
          onNameChange={changeName}
          onStart={startRound}
          onClose={() => closeRound((round as Round).id)}
          onCancel={() => cancelRound((round as Round).id)}
          onSetStatus={setStatus}
        />
      ) : null}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
        <div className="min-w-0">
          <section className="mb-12" aria-labelledby="open-title">
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="open-title" className="text-2xl font-normal tracking-tight">Open materials</h2>
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
                      vote={round?.status === 'open' ? { eligible: isEligible(material, round), voters, mine: myVote === material.id, onVote: () => void vote(round.id, material) } : undefined}
                      onSetStatus={setStatus}
                      onDelete={deleteMaterial}
                    />
                  );
                })}
              </div>
            ) : null}
          </section>
          {loadState === 'ready' && discussed.length ? <DiscussedList materials={discussed} busy={busy} onSetStatus={setStatus} /> : null}
        </div>
        <aside id="suggest" className="order-first lg:sticky lg:top-16 lg:order-none">
          <SuggestForm name={name} onNameChange={changeName} onCreate={createMaterial} />
        </aside>
      </div>
    </>
  );
}
