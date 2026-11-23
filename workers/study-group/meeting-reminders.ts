import { MEETING_REMINDER_LEADS, type MeetingReminderLead } from './contract';
import { meetingsBetween } from './meeting-schedule';
import type { createRepository, DueReminder, QueuedNotification } from './repository';

const HOUR_MS = 60 * 60 * 1000;
/** A queued reminder is delivered within seconds of its send time; one still pending this long after it was lost. */
const LOST_AFTER_MS = 5 * 60 * 1000;
/** Groups read per query, so a scan never loads every group at once. */
export const REMINDER_PAGE_SIZE = 50;

type Repository = Pick<ReturnType<typeof createRepository>, 'listPendingReminders' | 'listReminderGroups' | 'queueMeetingReminders'>;

/**
 * Hourly scan. A reminder is written when its send time falls within an hour of now, either way: the next run covers
 * the hour ahead, and a reminder up to an hour late (a missed run) still goes out. Overlapping runs write nothing new
 * (dedupe key), and the mailer drops a reminder whose meeting already started or no longer matches the schedule.
 * Groups are read in id order, a page at a time; each page is written and queued before the next is read. A failed
 * queue send doesn't stop the scan: its rows stay pending, and the next run queues them again (the dedupe key would
 * otherwise keep them from being written, and so queued, a second time).
 */
export async function scheduleMeetingReminders(
  repository: Repository,
  notify: (notifications: QueuedNotification[]) => Promise<void>,
  now: Date,
): Promise<number> {
  const nowIso = now.toISOString();
  const send = async (notifications: QueuedNotification[]): Promise<number> => {
    if (!notifications.length) return 0;
    try {
      await notify(notifications);
      return notifications.length;
    } catch (error) {
      console.error('Unable to queue meeting reminders', notifications.length, error instanceof Error ? error.message : error);
      return 0;
    }
  };
  // Reminders an earlier run wrote but couldn't queue: up to two hours old, so the previous run's whole window is
  // covered. A same-day reminder found this late is dropped by the mailer once the meeting has started.
  let queued = await send(await repository.listPendingReminders(
    new Date(now.getTime() - 2 * HOUR_MS).toISOString(), new Date(now.getTime() - LOST_AFTER_MS).toISOString()
  ));
  let afterId = '';
  for (;;) {
    const groups = await repository.listReminderGroups(afterId, REMINDER_PAGE_SIZE);
    if (!groups.length) break;
    const due: DueReminder[] = groups.flatMap((group) => (Object.keys(MEETING_REMINDER_LEADS) as MeetingReminderLead[]).flatMap((lead) => {
      const leadMs = MEETING_REMINDER_LEADS[lead] * HOUR_MS;
      return meetingsBetween(group, new Date(now.getTime() - HOUR_MS + leadMs), new Date(now.getTime() + HOUR_MS + leadMs)).map((meeting) => ({
        groupId: group.id,
        lead,
        meetingAt: meeting.toISOString(),
        sendAfter: new Date(meeting.getTime() - leadMs).toISOString(),
      }));
    }));
    queued += await send(await repository.queueMeetingReminders(due, nowIso));
    if (groups.length < REMINDER_PAGE_SIZE) break;
    afterId = groups[groups.length - 1].id;
  }
  return queued;
}
