import type { GroupInfo } from '@/workers/study-group/contract';

import { formatMeeting } from './helpers';
import { buttonClass, eyebrowClass } from './ui';

const pillClass = 'rounded-full border border-line px-3 py-1 text-xs text-text-muted';

export function GroupHeader({ group }: { group: GroupInfo | null }) {
  return (
    <section className="mb-10">
      <p className={eyebrowClass}>Weekly English study group</p>
      <h1 className="mb-4 mt-2 text-3xl font-normal leading-tight tracking-tight sm:text-5xl">{group?.name ?? 'Study group'}</h1>
      <p className="max-w-3xl text-lg leading-relaxed text-text-secondary">
        {group?.description ?? 'Suggest videos, articles, podcasts or anything worth talking about. Each week we pick one, by a random draw or by vote, and discuss it on our call.'}
      </p>
      {group?.rules.length ? (
        <div className="mt-6">
          <h2 className={eyebrowClass}>Group rules</h2>
          <ol className="mt-2 grid list-decimal gap-1 pl-5 text-text-secondary marker:text-accent">
            {group.rules.map((rule) => <li key={rule}>{rule}</li>)}
          </ol>
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {group ? <span className={pillClass}>Meeting: {formatMeeting(group)}</span> : null}
        <span className={pillClass}>No login needed</span>
        {group?.meetingUrl ? (
          <a href={group.meetingUrl} target="_blank" rel="noopener noreferrer" className={`${buttonClass.primarySmall} ml-1`}>
            Join meeting<span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
      </div>
    </section>
  );
}
