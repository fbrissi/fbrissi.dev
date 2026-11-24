// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { canonicalTimeZone, groupProfileSchema } from '@/workers/study-group/contract';
import { isMeetingAt, meetingsBetween } from '@/workers/study-group/meeting-schedule';

const at = (iso: string) => new Date(iso);
const between = (schedule: Parameters<typeof meetingsBetween>[0], from: string, to: string) =>
  meetingsBetween(schedule, at(from), at(to)).map((date) => date.toISOString());

describe('meeting schedule', () => {
  const saoPaulo = { meetingDay: 'Monday', meetingStart: '20:00', timezone: 'America/Sao_Paulo' };

  it('finds the weekly meetings in a range, in the group time zone', () => {
    // Monday 20:00 in São Paulo (UTC-3) is Monday 23:00 UTC.
    expect(between(saoPaulo, '2026-11-30T00:00:00.000Z', '2026-12-14T23:00:00.000Z')).toEqual([
      '2026-11-30T23:00:00.000Z', '2026-12-07T23:00:00.000Z', '2026-12-14T23:00:00.000Z',
    ]);
    // The range is open at the start and closed at the end.
    expect(between(saoPaulo, '2026-11-30T23:00:00.000Z', '2026-12-01T00:00:00.000Z')).toEqual([]);
    // A zone ahead of UTC: Tuesday 08:30 in Tokyo is Monday 23:30 UTC.
    expect(between({ meetingDay: 'Tuesday', meetingStart: '08:30', timezone: 'Asia/Tokyo' }, '2026-11-30T00:00:00.000Z', '2026-12-01T00:00:00.000Z'))
      .toEqual(['2026-11-30T23:30:00.000Z']);
    expect(between({ meetingDay: 'Sunday', meetingStart: '00:00', timezone: 'UTC' }, '2026-11-28T00:00:00.000Z', '2026-11-30T00:00:00.000Z'))
      .toEqual(['2026-11-29T00:00:00.000Z']);
  });

  it('follows daylight saving time changes', () => {
    const newYork = { meetingDay: 'Monday', meetingStart: '09:00', timezone: 'America/New_York' };
    // EDT (UTC-4) before 2026-11-01, EST (UTC-5) after.
    expect(between(newYork, '2026-10-25T00:00:00.000Z', '2026-11-03T00:00:00.000Z')).toEqual(['2026-10-26T13:00:00.000Z', '2026-11-02T14:00:00.000Z']);
    // 02:30 doesn't exist on 2026-03-08 in New York; the meeting lands an hour later.
    expect(between({ meetingDay: 'Sunday', meetingStart: '02:30', timezone: 'America/New_York' }, '2026-03-08T00:00:00.000Z', '2026-03-09T00:00:00.000Z'))
      .toEqual(['2026-03-08T07:30:00.000Z']);
  });

  it('finds nothing for a schedule it cannot read', () => {
    const range = ['2026-11-30T00:00:00.000Z', '2026-12-14T00:00:00.000Z'] as const;
    expect(between({ ...saoPaulo, meetingDay: 'Mondays' }, ...range)).toEqual([]);
    expect(between({ ...saoPaulo, meetingStart: '8pm' }, ...range)).toEqual([]);
    expect(between({ ...saoPaulo, timezone: 'BRT' }, ...range)).toEqual([]);
  });

  it('tells whether a meeting starts at an instant', () => {
    expect(isMeetingAt(saoPaulo, at('2026-11-30T23:00:00.000Z'))).toBe(true);
    expect(isMeetingAt(saoPaulo, at('2026-11-30T22:00:00.000Z'))).toBe(false);
    expect(isMeetingAt({ ...saoPaulo, meetingStart: '21:00' }, at('2026-11-30T23:00:00.000Z'))).toBe(false);
  });

  it('validates the meeting day and stores the canonical time zone name', () => {
    expect(canonicalTimeZone('america/sao_paulo')).toBe('America/Sao_Paulo');
    expect(canonicalTimeZone('Not/AZone')).toBeNull();
    const profile = { name: 'Go Talk', summary: 'Weekly English practice.', rules: [], meetingDay: 'Monday', meetingStart: '20:00', meetingEnd: '21:00', timezone: ' america/sao_paulo ', meetingUrl: null, moderationMode: 'free', listed: true };
    expect(groupProfileSchema.parse(profile)).toMatchObject({ timezone: 'America/Sao_Paulo' });
    expect(groupProfileSchema.safeParse({ ...profile, meetingDay: 'Mon' }).success).toBe(false);
    expect(groupProfileSchema.safeParse({ ...profile, timezone: 'BRT' }).error?.issues[0]).toMatchObject({ path: ['timezone'], message: 'Unknown time zone' });
  });
});
