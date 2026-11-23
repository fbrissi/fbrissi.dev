import { MEETING_REMINDER_LEADS, type MeetingReminderLead } from './contract';
import { meetingsBetween } from './meeting-schedule';
import type { createRepository, DueReminder, QueuedNotification } from './repository';

const HOUR_MS = 60 * 60 * 1000;
/** Groups read per query, so a scan never loads every group at once. */
export const REMINDER_PAGE_SIZE = 50;

type Repository = Pick<ReturnType<typeof createRepository>, 'listReminderGroups' | 'queueMeetingReminders'>;

/**
 * Hourly scan. A reminder is written when its send time falls within an hour of now, either way: the next run covers
 * the hour ahead, and a reminder up to an hour late (a missed run) still goes out. Overlapping runs write nothing new
 * (dedupe key), and the mailer drops a reminder whose meeting already started or no longer matches the schedule.
 * Groups are read in id order, a page at a time; each page is written and queued before the next is read.
 */
export async function scheduleMeetingReminders(
  repository: Repository,
  notify: (notifications: QueuedNotification[]) => Promise<void>,
  now: Date,
): Promise<number> {
  const nowIso = now.toISOString();
  let queued = 0;
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
    const notifications = await repository.queueMeetingReminders(due, nowIso);
    if (notifications.length) await notify(notifications);
    queued += notifications.length;
    if (groups.length < REMINDER_PAGE_SIZE) break;
    afterId = groups[groups.length - 1].id;
  }
  return queued;
}
