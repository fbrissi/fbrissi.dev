import { meetingWeekdays } from './contract';

/** A weekly meeting: the weekday and start time are wall-clock values in the group's IANA time zone. */
export interface MeetingSchedule {
  meetingDay: string;
  meetingStart: string;
  timezone: string;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const formatters = new Map<string, Intl.DateTimeFormat>();

/** Throws a RangeError for a time zone the runtime doesn't know. */
function formatter(timezone: string): Intl.DateTimeFormat {
  let format = formatters.get(timezone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    });
    formatters.set(timezone, format);
  }
  return format;
}

function zonedParts(instant: number, timezone: string): ZonedParts {
  const parts = Object.fromEntries(formatter(timezone).formatToParts(instant).map(({ type, value }) => [type, Number(value)]));
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute };
}

/** Minutes the zone is ahead of UTC at this instant. */
function offsetMinutes(instant: number, timezone: string): number {
  const p = zonedParts(instant, timezone);
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(instant / MINUTE_MS) * MINUTE_MS) / MINUTE_MS;
}

/** The instant of a wall-clock time in the zone; a time skipped by a DST change lands an hour later. */
function zonedTimeToInstant(year: number, month: number, day: number, hour: number, minute: number, timezone: string): number {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const first = wall - offsetMinutes(wall, timezone) * MINUTE_MS;
  const second = wall - offsetMinutes(first, timezone) * MINUTE_MS;
  const parts = zonedParts(second, timezone);
  return parts.hour === hour && parts.minute === minute ? second : first;
}

function weekdayIndex(day: string): number {
  return meetingWeekdays.indexOf(day as (typeof meetingWeekdays)[number]);
}

/**
 * Meetings that start in (from, to]. Empty for a schedule the reminders can't use: an unknown weekday or time zone
 * (groups saved before both were validated) or a malformed start time.
 */
export function meetingsBetween(schedule: MeetingSchedule, from: Date, to: Date): Date[] {
  const weekday = weekdayIndex(schedule.meetingDay);
  const start = /^(\d{2}):(\d{2})$/.exec(schedule.meetingStart);
  if (weekday < 0 || !start) return [];
  let first: ZonedParts;
  try {
    first = zonedParts(from.getTime() - DAY_MS, schedule.timezone);
  } catch {
    return [];
  }
  const meetings: Date[] = [];
  // Local calendar days from the day before `from` to the day after `to`, so every zone offset is covered.
  for (let date = Date.UTC(first.year, first.month - 1, first.day); date <= to.getTime() + 2 * DAY_MS; date += DAY_MS) {
    const local = new Date(date);
    // getUTCDay counts from Sunday; meetingWeekdays starts on Monday.
    if ((local.getUTCDay() + 6) % 7 !== weekday) continue;
    const at = zonedTimeToInstant(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate(), Number(start[1]), Number(start[2]), schedule.timezone);
    if (at > from.getTime() && at <= to.getTime()) meetings.push(new Date(at));
  }
  return meetings;
}

/** Whether a meeting of this schedule starts at this instant (a reminder still matches the group's current schedule). */
export function isMeetingAt(schedule: MeetingSchedule, instant: Date): boolean {
  return meetingsBetween(schedule, new Date(instant.getTime() - 1), instant).length === 1;
}
