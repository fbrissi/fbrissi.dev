import type { GroupInfo, GroupRole } from '@/workers/study-group/contract';

import { groupPath } from './api';
import { GroupIcon } from './group-icon';
import { formatMeeting } from './helpers';
import { buttonClass, eyebrowClass } from './ui';

const pillClass = 'rounded-full border border-line px-3 py-1 text-xs text-text-muted';
const roleLabels: Record<GroupRole, string> = { member: 'Member', owner: 'Owner', platform_admin: 'Platform admin' };

export function GroupHeader({ group, role }: { group: GroupInfo; role: GroupRole }) {
  return (
    <section className="mb-10">
      <p className={eyebrowClass}>Weekly English study group</p>
      <div className="mb-4 mt-2 flex items-center gap-4">
        <GroupIcon url={group.iconUrl} size={64} />
        <h1 className="text-3xl font-normal leading-tight tracking-tight wrap-anywhere sm:text-5xl">{group.name}</h1>
      </div>
      <p className="max-w-3xl text-lg leading-relaxed text-text-secondary wrap-anywhere">{group.summary}</p>
      {group.rules.length ? (
        <div className="mt-6">
          <h2 className={eyebrowClass}>Group rules</h2>
          <ol className="mt-2 grid list-decimal gap-1 pl-5 text-text-secondary marker:text-accent">
            {group.rules.map((rule) => <li key={rule}>{rule}</li>)}
          </ol>
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className={pillClass}>Meeting: {formatMeeting(group)}</span>
        <span className={pillClass}>{roleLabels[role]}</span>
        {group.moderationMode === 'review' ? <span className={pillClass}>Suggestions are reviewed</span> : null}
        {group.meetingUrl ? (
          <a href={group.meetingUrl} target="_blank" rel="noopener noreferrer" className={`${buttonClass.primarySmall} ml-1`}>
            Join meeting<span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : null}
        {role !== 'member' ? <a href={groupPath(group.id, '/settings')} className={buttonClass.secondarySmall}>Group settings</a> : null}
      </div>
    </section>
  );
}
