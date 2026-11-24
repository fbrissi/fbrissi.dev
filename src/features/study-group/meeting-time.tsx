import { meetingWeekdays, type GroupSchedule } from '@/workers/study-group/contract';
import { meetingsBetween } from '@/workers/study-group/meeting-schedule';

import { formatTime } from './helpers';
import { hintClass } from './ui';

const DAY_MS = 86_400_000;
const TIME = /^(\d{2}):(\d{2})$/;

/** The meeting in the viewer's zone: weekday names and "HH:MM" times; `end` is null when it equals the start. */
interface LocalTimes {
  day: string;
  start: string;
  end: string | null;
  /** The weekday the meeting ends on, set only when it ends on another day. */
  endDay: string | null;
}

export interface MeetingTimeView {
  /** Set when the meeting could be converted to the viewer's zone. */
  local: LocalTimes | null;
  /** The main line, without "your time": in the viewer's zone, or the stored values with the group's zone. */
  text: string;
  /** "Group time: …" in the group's zone, only when it reads differently from the main line. */
  groupTime: string | null;
}

function minutes(time: string): number | null {
  const match = TIME.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function line(day: string, start: string, end: string | null, endDay: string | null): string {
  return `${day}, ${start}${end ? ` – ${endDay ? `${endDay} ` : ''}${end}` : ''}`;
}

/** The stored schedule as written by the owner, in the group's zone. */
function storedLine(schedule: GroupSchedule): string {
  const weekday = meetingWeekdays.indexOf(schedule.meetingDay as (typeof meetingWeekdays)[number]);
  const start = minutes(schedule.meetingStart);
  const end = minutes(schedule.meetingEnd);
  const show = (time: string) => (TIME.test(time) ? formatTime(time) : time);
  const crosses = weekday >= 0 && start !== null && end !== null && end < start;
  return line(
    weekday >= 0 ? `${schedule.meetingDay}s` : schedule.meetingDay,
    show(schedule.meetingStart),
    schedule.meetingEnd === schedule.meetingStart ? null : show(schedule.meetingEnd),
    crosses ? meetingWeekdays[(weekday + 1) % 7] : null,
  );
}

function zoneLabel(timezone: string): string {
  return timezone.replace(/_/g, ' ');
}

function wallClock(instant: Date, zone: string): { day: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'long', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(instant)
      .map(({ type, value }) => [type, value]),
  );
  return { day: parts.weekday, time: `${parts.hour.padStart(2, '0')}:${parts.minute}` };
}

function viewerTimes(schedule: GroupSchedule, now: Date, viewerZone: string): LocalTimes | null {
  // Empty for an unknown weekday or zone or a malformed start, so the start below is always a valid time.
  const [next] = meetingsBetween(schedule, now, new Date(now.getTime() + 8 * DAY_MS));
  const end = minutes(schedule.meetingEnd);
  if (!next || end === null) return null;
  const duration = (((end - minutes(schedule.meetingStart)!) % 1440) + 1440) % 1440;
  try {
    const from = wallClock(next, viewerZone);
    const to = wallClock(new Date(next.getTime() + duration * 60_000), viewerZone);
    return { day: from.day, start: from.time, end: duration ? to.time : null, endDay: duration && to.day !== from.day ? to.day : null };
  } catch {
    return null;
  }
}

/**
 * The weekly meeting in the viewer's time zone, with the group's own time when it reads differently. Falls back to the
 * stored values with the group's zone when either zone is unknown or the schedule can't be converted. Null when the
 * schedule is missing.
 */
export function localMeeting(schedule: Partial<GroupSchedule>, now: Date, viewerZone: string | undefined): MeetingTimeView | null {
  const { meetingDay, meetingStart, meetingEnd, timezone } = schedule;
  if (!meetingDay || !meetingStart || !meetingEnd || !timezone) return null;
  const stored = { meetingDay, meetingStart, meetingEnd, timezone };
  const local = viewerZone ? viewerTimes(stored, now, viewerZone) : null;
  if (!local) return { local: null, text: `${storedLine(stored)} (${zoneLabel(timezone)})`, groupTime: null };
  const text = line(`${local.day}s`, formatTime(local.start), local.end && formatTime(local.end), local.endDay);
  const group = storedLine(stored);
  return { local, text, groupTime: group === text ? null : `Group time: ${group} (${zoneLabel(timezone.split('/').pop()!)})` };
}

function viewerZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

const clockIcon = (
  <svg className="mt-0.5 h-4 w-4 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

/** The group's weekly meeting in the viewer's time zone (read at render time), never the meeting link. */
export function MeetingTime({ schedule }: { schedule: Partial<GroupSchedule> }) {
  const view = localMeeting(schedule, new Date(), viewerZone());
  if (!view) return null;
  const { local } = view;
  return (
    <div className="flex flex-col gap-1">
      <p className="flex items-start gap-2 text-sm text-text">
        {clockIcon}
        {local ? (
          <span>
            <span className="sr-only">Meets </span>{local.day}s, <time dateTime={local.start}>{formatTime(local.start)}</time>
            {local.end ? (
              <>
                <span aria-hidden="true"> – </span><span className="sr-only"> to </span>
                {local.endDay ? `${local.endDay} ` : null}<time dateTime={local.end}>{formatTime(local.end)}</time>
              </>
            ) : null}{' '}
            <span className="text-text-muted">your time</span>
          </span>
        ) : (
          <span><span className="sr-only">Meets </span>{view.text}</span>
        )}
      </p>
      {view.groupTime ? <p className={`${hintClass} pl-6`}>{view.groupTime}</p> : null}
    </div>
  );
}
