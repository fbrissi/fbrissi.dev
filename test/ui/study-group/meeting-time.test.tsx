import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { localMeeting, MeetingTime } from '@/features/study-group/meeting-time';

vi.stubGlobal('React', React);

const monday = new Date('2026-11-23T12:00:00Z');
const schedule = { meetingDay: 'Tuesday', meetingStart: '19:00', meetingEnd: '20:00', timezone: 'America/Sao_Paulo' };

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('localMeeting', () => {
  it('shows only the local line when the viewer is in the group zone', () => {
    expect(localMeeting(schedule, monday, 'America/Sao_Paulo')).toEqual({
      local: { day: 'Tuesday', start: '19:00', end: '20:00', endDay: null },
      text: 'Tuesdays, 7 PM – 8 PM',
      groupTime: null,
    });
  });

  it('moves the weekday forward for a viewer ahead of the group, and the group line crosses midnight', () => {
    expect(localMeeting({ ...schedule, meetingStart: '23:00', meetingEnd: '00:30' }, monday, 'Asia/Tokyo')).toEqual({
      local: { day: 'Wednesday', start: '11:00', end: '12:30', endDay: null },
      text: 'Wednesdays, 11 AM – 12:30 PM',
      groupTime: 'Group time: Tuesdays, 11 PM – Wednesday 12:30 AM (Sao Paulo)',
    });
  });

  it('moves the weekday backward for a viewer behind the group', () => {
    const view = localMeeting({ ...schedule, meetingDay: 'Monday', meetingStart: '01:00', meetingEnd: '02:00' }, monday, 'America/Los_Angeles');
    expect(view?.text).toBe('Sundays, 8 PM – 9 PM');
    expect(view?.groupTime).toBe('Group time: Mondays, 1 AM – 2 AM (Sao Paulo)');
  });

  it('names the end weekday when the meeting crosses midnight in the viewer zone', () => {
    const view = localMeeting({ ...schedule, meetingEnd: '21:00' }, monday, 'Europe/London');
    expect(view?.local).toEqual({ day: 'Tuesday', start: '22:00', end: '00:00', endDay: 'Wednesday' });
    expect(view?.text).toBe('Tuesdays, 10 PM – Wednesday 12 AM');
    expect(view?.groupTime).toBe('Group time: Tuesdays, 7 PM – 9 PM (Sao Paulo)');
  });

  it('shows only the start when the end equals the start', () => {
    expect(localMeeting({ ...schedule, meetingDay: 'Wednesday', meetingStart: '08:00', meetingEnd: '08:00' }, monday, 'America/Sao_Paulo')).toEqual({
      local: { day: 'Wednesday', start: '08:00', end: null, endDay: null },
      text: 'Wednesdays, 8 AM',
      groupTime: null,
    });
  });

  it('follows the group zone across a daylight saving time change', () => {
    const newYork = { meetingDay: 'Monday', meetingStart: '20:00', meetingEnd: '21:00', timezone: 'America/New_York' };
    expect(localMeeting(newYork, new Date('2026-02-25T12:00:00Z'), 'America/Sao_Paulo')?.text).toBe('Mondays, 10 PM – 11 PM');
    const afterChange = localMeeting(newYork, new Date('2026-03-03T12:00:00Z'), 'America/Sao_Paulo');
    expect(afterChange?.text).toBe('Mondays, 9 PM – 10 PM');
    expect(afterChange?.groupTime).toBe('Group time: Mondays, 8 PM – 9 PM (New York)');
  });

  it('falls back to the stored values with the group zone when it cannot convert', () => {
    const stored = { local: null, text: 'Tuesdays, 7 PM – 8 PM (America/Sao Paulo)', groupTime: null };
    expect(localMeeting(schedule, monday, 'Not/AZone')).toEqual(stored);
    expect(localMeeting(schedule, monday, undefined)).toEqual(stored);
    expect(localMeeting({ ...schedule, timezone: 'Mars/Base' }, monday, 'America/Sao_Paulo')?.text).toBe('Tuesdays, 7 PM – 8 PM (Mars/Base)');
    expect(localMeeting({ ...schedule, meetingStart: '23:00', meetingEnd: '00:30' }, monday, 'Not/AZone')?.text).toBe('Tuesdays, 11 PM – Wednesday 12:30 AM (America/Sao Paulo)');
    expect(localMeeting({ ...schedule, meetingDay: 'Sunday', meetingStart: '23:00', meetingEnd: '00:30' }, monday, 'Not/AZone')?.text).toBe('Sundays, 11 PM – Monday 12:30 AM (America/Sao Paulo)');
    expect(localMeeting({ ...schedule, meetingEnd: '19:00' }, monday, 'Not/AZone')?.text).toBe('Tuesdays, 7 PM (America/Sao Paulo)');
    // Values saved before the day and times were validated are shown as written.
    expect(localMeeting({ ...schedule, meetingDay: 'Mondays and Thursdays', meetingStart: '23:00', meetingEnd: '00:30' }, monday, 'America/Sao_Paulo')?.text)
      .toBe('Mondays and Thursdays, 11 PM – 12:30 AM (America/Sao Paulo)');
    expect(localMeeting({ ...schedule, meetingStart: '7pm' }, monday, 'America/Sao_Paulo')?.text).toBe('Tuesdays, 7pm – 8 PM (America/Sao Paulo)');
    expect(localMeeting({ ...schedule, meetingEnd: '8pm' }, monday, 'America/Sao_Paulo')?.text).toBe('Tuesdays, 7 PM – 8pm (America/Sao Paulo)');
  });

  it('returns nothing when the schedule is missing', () => {
    expect(localMeeting({}, monday, 'America/Sao_Paulo')).toBeNull();
    expect(localMeeting({ ...schedule, timezone: '' }, monday, 'America/Sao_Paulo')).toBeNull();
  });
});

function viewIn(timeZone: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(monday);
  const resolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
    return { ...resolvedOptions.call(this), timeZone };
  });
}

describe('MeetingTime', () => {
  it('shows the meeting in the viewer zone with the group time below', () => {
    viewIn('Asia/Tokyo');
    const { container } = render(<MeetingTime schedule={{ ...schedule, meetingStart: '23:00', meetingEnd: '00:30' }} />);
    const [main, group] = container.querySelectorAll('p');
    expect(main.textContent).toBe('Meets Wednesdays, 11 AM –  to 12:30 PM your time');
    expect([...main.querySelectorAll('time')].map((time) => time.getAttribute('dateTime'))).toEqual(['11:00', '12:30']);
    expect(group.textContent).toBe('Group time: Tuesdays, 11 PM – Wednesday 12:30 AM (Sao Paulo)');
  });

  it('names the end weekday, or shows only the start, and hides an identical group time', () => {
    viewIn('Europe/London');
    const { container, rerender } = render(<MeetingTime schedule={{ ...schedule, meetingEnd: '21:00' }} />);
    expect(container.querySelector('p')?.textContent).toBe('Meets Tuesdays, 10 PM –  to Wednesday 12 AM your time');
    rerender(<MeetingTime schedule={{ ...schedule, timezone: 'Europe/London', meetingEnd: '19:00' }} />);
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.querySelector('p')?.textContent).toBe('Meets Tuesdays, 7 PM your time');
  });

  it('shows the stored values when the viewer zone is unknown, and nothing without a schedule', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(() => {
      throw new RangeError('no zone');
    });
    const { container, rerender } = render(<MeetingTime schedule={schedule} />);
    expect(screen.getByText(/Tuesdays, 7 PM – 8 PM \(America\/Sao Paulo\)/)).toBeTruthy();
    expect(container.textContent).not.toContain('your time');
    rerender(<MeetingTime schedule={{}} />);
    expect(container.innerHTML).toBe('');
  });
});
