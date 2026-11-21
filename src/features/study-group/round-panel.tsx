import type { Material, MaterialStatus, Round, RoundMode, TallyEntry } from '@/workers/study-group/contract';

import { formatDate, pluralize, totalVotes, winnerNote } from './helpers';
import { buttonClass, cardClass, ExternalLink, eyebrowClass, hintClass, inputClass, TypeBadge } from './ui';

type RoundPanelProps = {
  round: Round | null;
  tally: TallyEntry[];
  materials: Material[];
  name: string;
  voterError: string;
  busy: boolean;
  onNameChange: (name: string) => void;
  onStart: (mode: RoundMode) => void;
  onClose: () => void;
  onCancel: () => void;
  onSetStatus: (material: Material, status: MaterialStatus) => void;
};

const controlsClass = 'mt-6 flex flex-wrap items-center gap-3 border-t border-dashed border-line-bright pt-5';
const ledeClass = 'max-w-2xl text-[15px] text-text-secondary';
const titleClass = 'mb-1.5 mt-1 text-[22px] font-normal tracking-tight';

export function RoundPanel(props: RoundPanelProps) {
  const { round } = props;
  const winnerId = round?.status === 'closed' ? round.winnerMaterialId : null;

  return (
    <section className={`${cardClass} relative mb-10 overflow-hidden p-6 sm:p-8`} aria-labelledby="round-title" aria-live="polite">
      {round?.status === 'open' ? <VotingRound {...props} round={round} /> : winnerId ? <ClosedRound {...props} round={round as Round} winnerId={winnerId} /> : <NoRound {...props} />}
    </section>
  );
}

function StartControls({ materials, busy, onStart }: Pick<RoundPanelProps, 'materials' | 'busy' | 'onStart'>) {
  const openCount = materials.filter((material) => material.status === 'open').length;
  const hint = openCount === 0 ? 'Add a suggestion first: there are no open items to pick from.' : openCount === 1 ? '1 open item is eligible. A vote needs at least 2.' : `${openCount} open items are eligible.`;

  return (
    <div className={controlsClass}>
      <button type="button" className={buttonClass.primarySmall} disabled={busy || openCount === 0} onClick={() => onStart('draw')}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M3 7h3l9 10h6M3 17h3l3-3.3M15 7h6M18 4l3 3-3 3M18 14l3 3-3 3" /></svg>
        Draw at random
      </button>
      <button type="button" className={buttonClass.secondarySmall} disabled={busy || openCount < 2} onClick={() => onStart('vote')}>
        Start vote
      </button>
      <span className={hintClass}>{hint}</span>
    </div>
  );
}

function NoRound(props: RoundPanelProps) {
  return (
    <>
      <p className={eyebrowClass}><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-text-muted align-middle" aria-hidden="true" />No round in progress</p>
      <h2 id="round-title" className={titleClass}>This week&apos;s topic hasn&apos;t been picked yet</h2>
      <p className={ledeClass}>Start a random draw or a vote when the group meets. Meanwhile, add your suggestions below.</p>
      <StartControls {...props} />
    </>
  );
}

function VotingRound({ round, tally, materials, name, voterError, busy, onNameChange, onClose, onCancel }: RoundPanelProps & { round: Round }) {
  const total = totalVotes(tally);
  const rows = tally
    .flatMap((entry) => {
      const material = materials.find((item) => item.id === entry.materialId);
      return material && entry.votes > 0 ? [{ ...entry, title: material.title }] : [];
    })
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 5);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">
            <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-accent align-middle shadow-[0_0_0_4px_var(--color-accent-glow)] motion-reduce:animate-none" aria-hidden="true" />
            Vote open · started {formatDate(round.createdAt)}
          </p>
          <h2 id="round-title" className={titleClass}>Vote for this week&apos;s topic</h2>
          <p className={ledeClass}>Pick one item below. You can change your vote until the vote is closed. Votes and names are visible to everyone.</p>
        </div>
        <span className="whitespace-nowrap rounded-full border border-line px-3 py-1 text-xs text-text-muted">{pluralize(total, 'vote')} so far</span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor="voter-name" className="text-sm text-text-secondary">Voting as</label>
        <input
          id="voter-name"
          className={`${inputClass} max-w-[220px] flex-[1_1_160px]`}
          value={name}
          maxLength={60}
          autoComplete="name"
          placeholder="Your name"
          aria-invalid={Boolean(voterError)}
          aria-describedby={voterError ? 'voter-name-error' : 'voter-name-hint'}
          onChange={(event) => onNameChange(event.target.value)}
        />
        <span id="voter-name-hint" className={hintClass}>Remembered on this device.</span>
        {voterError ? <p id="voter-name-error" role="alert" className="w-full text-sm text-red-500">{voterError}</p> : null}
      </div>

      <div className="mt-5 grid gap-2.5" aria-label="Live results" role="group">
        {rows.length ? rows.map((row, index) => (
          <div key={row.materialId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
            <span className={`truncate ${index === 0 ? 'text-text' : 'text-text-secondary'}`}>{row.title}</span>
            <span className="tabular-nums text-text-muted">{pluralize(row.votes, 'vote')}</span>
            <span className="col-span-full h-1.5 overflow-hidden rounded-full bg-bg-card">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${(row.votes / total) * 100}%` }} />
            </span>
          </div>
        )) : <p className={hintClass}>No votes yet. Be the first!</p>}
      </div>

      <div className={controlsClass}>
        <button type="button" className={buttonClass.primarySmall} disabled={busy} onClick={onClose}>Close vote</button>
        <button type="button" className={buttonClass.dangerGhost} disabled={busy} onClick={onCancel}>Cancel round</button>
        <span className={hintClass}>Draw and Start vote are disabled while a vote is open. Ties are broken by draw.</span>
      </div>
    </>
  );
}

function ClosedRound(props: RoundPanelProps & { round: Round; winnerId: number }) {
  const { round, winnerId, tally, materials, busy, onSetStatus } = props;
  const winner = materials.find((material) => material.id === winnerId);
  const voters = tally.find((entry) => entry.materialId === winnerId)?.voters ?? [];

  return (
    <>
      <p className={eyebrowClass}>Round closed · {formatDate(round.closedAt)}</p>
      <h2 id="round-title" className={titleClass}>This week&apos;s topic</h2>
      {winner ? (
        <div className="mt-6 animate-slideInFromTop rounded-xl border border-accent bg-accent/5 p-5 shadow-[0_10px_30px_-10px_var(--color-accent-glow)] motion-reduce:animate-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TypeBadge type={winner.type} />
            <span className="inline-flex items-center rounded-full border border-accent px-2.5 py-0.5 text-xs text-accent">{winnerNote(round, tally)}</span>
          </div>
          <h3 className="my-2 text-[22px] font-normal tracking-tight wrap-anywhere">
            {winner.url ? <ExternalLink href={winner.url} className="text-text hover:text-accent">{winner.title}</ExternalLink> : winner.title}
          </h3>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-text-secondary">
            <span>Suggested by <b className="font-normal text-text">{winner.suggestedBy}</b></span>
            {voters.length ? <span>Voted by {voters.join(', ')}</span> : null}
            {winner.status === 'discussed' ? <span className="text-green-500">Discussed {formatDate(winner.discussedAt)}</span> : null}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {winner.status === 'open' ? (
              <>
                <button type="button" className={buttonClass.secondarySmall} disabled={busy} onClick={() => onSetStatus(winner, 'discussed')}>Mark discussed</button>
                <span className={hintClass}>Mark it once the group has talked about it.</span>
              </>
            ) : (
              <>
                <button type="button" className={buttonClass.secondarySmall} disabled={busy} onClick={() => onSetStatus(winner, 'open')}>Revert to open</button>
                <span className={hintClass}>Use if the session was skipped. Then you can draw or vote again.</span>
              </>
            )}
          </div>
        </div>
      ) : (
        <p className={`${ledeClass} mt-2`}>The picked item was deleted. Start a new round below.</p>
      )}
      <StartControls {...props} />
    </>
  );
}
