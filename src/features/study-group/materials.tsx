import type { Material, MaterialStatus } from '@/workers/study-group/contract';

import { formatDate, linkDomain, pluralize, typeLabel } from './helpers';
import { buttonClass, cardClass, ExternalLink, hintClass, TypeBadge } from './ui';

export type VoteInfo = {
  eligible: boolean;
  voters: string[];
  mine: boolean;
  onVote: () => void;
};

type MaterialCardProps = {
  material: Material;
  highlighted: boolean;
  busy: boolean;
  vote?: VoteInfo;
  onSetStatus: (material: Material, status: MaterialStatus) => void;
  onDelete: (material: Material) => void;
};

const titleLinkClass = 'text-text transition-colors duration-250 hover:text-accent';

export function MaterialCard({ material, highlighted, busy, vote, onSetStatus, onDelete }: MaterialCardProps) {
  const ringClass = highlighted ? 'border-green-500 animate-slideInFromTop motion-reduce:animate-none' : vote?.mine ? 'border-accent ring-1 ring-accent' : 'hover:border-line-bright';

  return (
    <article className={`${cardClass} flex min-w-0 flex-col gap-3 p-5 transition-all duration-250 sm:p-6 ${ringClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TypeBadge type={material.type} />
        <div className="flex items-center gap-1">
          <button type="button" className={buttonClass.ghost} disabled={busy} onClick={() => onSetStatus(material, 'discussed')}>
            Mark discussed
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-text-muted transition-colors duration-250 hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Delete “${material.title}”`}
            disabled={busy}
            onClick={() => onDelete(material)}
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>
      <h3 className="text-[19px] font-normal leading-snug tracking-tight wrap-anywhere">
        {material.url ? <ExternalLink href={material.url} className={titleLinkClass}>{material.title}</ExternalLink> : material.title}
      </h3>
      {material.url ? <span className="font-mono text-xs text-accent wrap-anywhere">{linkDomain(material.url)}</span> : null}
      <p className="flex flex-wrap gap-x-2 gap-y-1 text-[13px] text-text-muted">
        <span>Suggested by <b className="font-normal text-text-secondary">{material.suggestedBy}</b></span>
        <span aria-hidden="true">·</span>
        <time dateTime={material.createdAt}>{formatDate(material.createdAt)}</time>
      </p>
      {material.notes ? <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary wrap-anywhere">{material.notes}</p> : null}
      {vote ? <VoteFooter title={material.title} vote={vote} /> : null}
    </article>
  );
}

function VoteFooter({ title, vote }: { title: string; vote: VoteInfo }) {
  const count = vote.voters.length;

  return (
    <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3.5">
      <span className="min-w-0 text-[13px] text-text-muted">
        {count ? <>Voted: <b className="font-normal text-text-secondary">{vote.voters.join(', ')}</b></> : 'No votes yet'}
      </span>
      {vote.eligible ? (
        <button
          type="button"
          aria-pressed={vote.mine}
          aria-label={`${vote.mine ? 'Your vote' : 'Vote for'}: ${title}, ${pluralize(count, 'vote')}`}
          onClick={vote.onVote}
          className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-all duration-250 ${vote.mine ? 'border-accent bg-accent text-bg' : 'border-line bg-bg hover:border-accent hover:text-accent'}`}
        >
          {vote.mine ? (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
              Your vote
            </>
          ) : 'Vote'}
          <span className="border-l border-current pl-2 tabular-nums opacity-80" aria-hidden="true">{count}</span>
        </button>
      ) : (
        <span className={hintClass}>Joins the next round</span>
      )}
    </div>
  );
}

export function MaterialListSkeleton() {
  return (
    <div className="grid gap-4 md:max-lg:grid-cols-2" aria-busy="true" aria-label="Loading materials">
      {[85, 65, 75].map((width) => (
        <div key={width} className={`${cardClass} flex flex-col gap-3 p-5 sm:p-6`}>
          <div className="h-[22px] w-20 animate-pulse rounded-md bg-bg-card motion-reduce:animate-none" />
          <div className="h-[22px] animate-pulse rounded-md bg-bg-card motion-reduce:animate-none" style={{ width: `${width}%` }} />
          <div className="h-3.5 w-2/5 animate-pulse rounded-md bg-bg-card motion-reduce:animate-none" />
        </div>
      ))}
      <span className="sr-only" role="status">Loading materials…</span>
    </div>
  );
}

export function DiscussedList({ materials, busy, onSetStatus }: { materials: Material[]; busy: boolean; onSetStatus: (material: Material, status: MaterialStatus) => void }) {
  return (
    <section className="mb-12" aria-label="Already discussed">
      <details className={`${cardClass} group`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-[18px] [&::-webkit-details-marker]:hidden">
          <h2 className="text-lg font-normal">Already discussed <span className="text-sm text-text-muted">({materials.length})</span></h2>
          <svg className="h-5 w-5 text-text-muted transition-transform duration-250 group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <ul className="m-0 list-none px-6 pb-3">
          {materials.map((material) => (
            <li key={material.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-line py-3.5">
              <span className="text-[15px] text-text-secondary wrap-anywhere">
                {material.url ? <ExternalLink href={material.url} className="hover:text-accent">{material.title}</ExternalLink> : material.title}
              </span>
              <span className="col-start-1 text-xs text-text-muted">{typeLabel(material.type)} · by {material.suggestedBy} · discussed {formatDate(material.discussedAt)}</span>
              <span className="col-start-2 row-span-2 row-start-1">
                <button type="button" className={buttonClass.ghost} disabled={busy} aria-label={`Revert “${material.title}” to open`} onClick={() => onSetStatus(material, 'open')}>
                  Revert
                </button>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
