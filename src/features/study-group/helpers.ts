import type { GroupInfo, Material, MaterialType, Round, TallyEntry } from '@/workers/study-group/contract';

const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
const yearDateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

type StorageArea = 'localStorage' | 'sessionStorage';

// Storage can be unavailable (private mode, blocked site data); every value here is only a convenience.
export function readStorage(area: StorageArea, key: string): string {
  try {
    return window[area].getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function writeStorage(area: StorageArea, key: string, value: string | null): void {
  try {
    if (value === null) window[area].removeItem(key);
    else window[area].setItem(key, value);
  } catch {
    // Ignored on purpose, see above.
  }
}

export function formatDate(iso: string | null): string {
  return iso ? dateFormat.format(new Date(iso)) : '';
}

/** A date with its year, for dates that can be years away (a ban's expiry). */
export function formatYearDate(iso: string): string {
  return yearDateFormat.format(new Date(iso));
}

export function linkDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function typeLabel(type: MaterialType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function pluralize(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export function isEligible(material: Material, round: Round): boolean {
  return material.status === 'open' && Date.parse(material.createdAt) <= Date.parse(round.createdAt);
}

export function totalVotes(tally: TallyEntry[]): number {
  return tally.reduce((sum, entry) => sum + entry.votes, 0);
}

/** Optimistically moves the caller's vote, shown under their display name. */
export function applyVote(tally: TallyEntry[], previous: number | null, materialId: number, voterName: string): TallyEntry[] {
  const next = tally.map((entry) => {
    if (entry.materialId !== previous) return entry;
    const index = entry.voters.indexOf(voterName);
    const voters = index === -1 ? entry.voters : entry.voters.filter((_voter, position) => position !== index);
    return { ...entry, voters, votes: voters.length };
  });
  const target = next.find((entry) => entry.materialId === materialId);

  if (!target) return [...next, { materialId, votes: 1, voters: [voterName] }];

  target.voters = [...target.voters, voterName];
  target.votes = target.voters.length;
  return next;
}

/** Group pages share one static shell at /study-groups/g/<id>; the ID is read from the URL on the client. */
export function groupIdFromPath(pathname: string): string | null {
  return /^\/study-groups\/g\/([a-z0-9]{3,32})(?:\/|$)/.exec(pathname)?.[1] ?? null;
}

export function winnerNote(round: Round, tally: TallyEntry[]): string {
  if (round.mode === 'draw') return 'Picked by random draw';

  const total = totalVotes(tally);
  if (total === 0) return 'No votes, picked by random draw';

  const top = Math.max(...tally.map((entry) => entry.votes));
  const winnerVotes = tally.find((entry) => entry.materialId === round.winnerMaterialId)?.votes ?? 0;
  if (winnerVotes === top && tally.filter((entry) => entry.votes === top).length > 1) return 'Tie broken by draw';

  return `Chosen by vote · ${winnerVotes} of ${pluralize(total, 'vote')}`;
}

const timezoneLabels: Record<string, string> = { 'America/Sao_Paulo': 'BRT' };

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours < 12 ? 'AM' : 'PM';
  const hour = hours % 12 || 12;
  return `${hour}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''} ${suffix}`;
}

export function formatMeeting(group: GroupInfo): string {
  return `${group.meetingDay} ${formatTime(group.meetingStart)} - ${formatTime(group.meetingEnd)} (${timezoneLabels[group.timezone] ?? group.timezone})`;
}

/** Readable names of the moderation log actions; an unknown code is shown as is. */
const moderationActionLabels: Record<string, string> = {
  delete_group: 'Group deleted',
  delete_material: 'Material deleted',
  delete_join_message: 'Join request message deleted',
  delete_icon: 'Group icon removed',
  ban_user: 'Account banned',
  renew_ban: 'Ban renewed',
  unban_user: 'Ban lifted',
};

export function moderationActionLabel(action: string): string {
  return moderationActionLabels[action] ?? action;
}

const flashKey = 'study-groups:flash';

/** A one-time status message for the next page, after an action that navigates away (a group deletion). */
export function setFlash(text: string): void {
  writeStorage('sessionStorage', flashKey, text);
}

/** Reads and clears the one-time status message, or '' when there is none. */
export function takeFlash(): string {
  const text = readStorage('sessionStorage', flashKey);
  writeStorage('sessionStorage', flashKey, null);
  return text;
}
