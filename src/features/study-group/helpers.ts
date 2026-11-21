import type { GroupInfo, Material, MaterialType, Round, TallyEntry } from '@/workers/study-group/contract';

const nameStorageKey = 'study-group:name';
export const accessCodeStorageKey = 'study-group:code';
export const adminTokenStorageKey = 'study-group:admin-token';
const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

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

export function readStoredName(): string {
  return readStorage('localStorage', nameStorageKey);
}

export function storeName(name: string): void {
  writeStorage('localStorage', nameStorageKey, name);
}

const accessCodeAlphabet = 'abcdefghjkmnpqrstuvwxyz23456789';

export function generateAccessCode(length = 10): string {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (value) => accessCodeAlphabet[value % accessCodeAlphabet.length]).join('');
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function formatDate(iso: string | null): string {
  return iso ? dateFormat.format(new Date(iso)) : '';
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

export function findVote(tally: TallyEntry[], voterName: string): number | undefined {
  const key = normalizeName(voterName);
  if (!key) return undefined;
  return tally.find((entry) => entry.voters.some((voter) => normalizeName(voter) === key))?.materialId;
}

export function applyVote(tally: TallyEntry[], materialId: number, voterName: string): TallyEntry[] {
  const key = normalizeName(voterName);
  const next = tally.map((entry) => {
    const voters = entry.voters.filter((voter) => normalizeName(voter) !== key);
    return { ...entry, voters, votes: voters.length };
  });
  const target = next.find((entry) => entry.materialId === materialId);

  if (!target) return [...next, { materialId, votes: 1, voters: [voterName] }];

  target.voters = [...target.voters, voterName];
  target.votes = target.voters.length;
  return next;
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
