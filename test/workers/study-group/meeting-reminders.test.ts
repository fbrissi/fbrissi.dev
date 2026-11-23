// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { openD1Sqlite } from '@/workers/local/d1-sqlite';
import { REMINDER_PAGE_SIZE, scheduleMeetingReminders } from '@/workers/study-group/meeting-reminders';
import { createRepository, type D1Like, type QueuedNotification } from '@/workers/study-group/repository';

import { migrationsDir } from './harness';

let db: D1Like;
let notify: ReturnType<typeof vi.fn<(notifications: QueuedNotification[]) => Promise<void>>>;

const user = (id: string) => db.prepare("INSERT INTO users (id, google_sub, email, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, 'x', 'x')").bind(id, id, `${id}@example.test`, id);
const group = (id: string, extra: { day?: string; start?: string; timezone?: string; reminders?: number } = {}) => db.prepare(
  "INSERT INTO groups (id, owner_id, name, summary, meeting_day, meeting_start, meeting_end, timezone, access_code, meeting_reminders, created_at, updated_at) VALUES (?, 'owner001', ?, 'A summary text', ?, ?, '21:00', ?, 'c', ?, 'x', 'x')"
).bind(id, id, extra.day ?? 'Monday', extra.start ?? '20:00', extra.timezone ?? 'UTC', extra.reminders ?? 1);
const member = (groupId: string, userId: string) => db.prepare("INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, 'x')").bind(groupId, userId);

const run = (now: string) => scheduleMeetingReminders(createRepository(db), notify, new Date(now));
const rows = async () => (await db.prepare("SELECT user_id, group_id, payload, send_after FROM notifications WHERE kind = 'meeting_reminder' ORDER BY id").all()).results;

beforeEach(async () => {
  db = openD1Sqlite(':memory:', migrationsDir);
  notify = vi.fn(async () => undefined);
  await db.batch([
    ...['owner001', 'member01', 'optout01', 'banned01', 'outsider'].map(user),
    db.prepare("INSERT INTO notification_preferences (user_id, email_enabled, updated_at) VALUES ('optout01', 0, 'x')"),
    db.prepare("INSERT INTO bans (user_id, google_sub, email, reason, created_at, expires_at) VALUES ('banned01', 'banned01', 'banned01@example.test', 'Reason text', 'x', '2999-01-01T00:00:00.000Z')"),
    group('gotalk'),
    member('gotalk', 'member01'),
    member('gotalk', 'optout01'),
    member('gotalk', 'banned01'),
    group('quiet', { reminders: 0 }),
    member('quiet', 'member01'),
    group('legacy', { day: 'Mon' }),
    group('badzone', { timezone: 'BRT' }),
  ]);
  // DevTalk (from the migrations) meets on Mondays at 20:00 in São Paulo; it has no owner or members here.
});

describe('meeting reminder scan', () => {
  it('writes the day-before reminder for the owner and members who get service emails, once', async () => {
    // Monday 2026-11-30 20:00 UTC; the day-before reminder is due at Sunday 20:00, within an hour of 20:07.
    expect(await run('2026-11-29T20:07:00.000Z')).toBe(2);
    expect(await rows()).toEqual(['owner001', 'member01'].map((userId) => ({
      user_id: userId, group_id: 'gotalk', send_after: '2026-11-29T20:00:00.000Z',
      payload: JSON.stringify({ lead: 'day_before', meetingAt: '2026-11-30T20:00:00.000Z' }),
    })));
    expect(notify).toHaveBeenCalledWith([{ id: 1, sendAfter: '2026-11-29T20:00:00.000Z' }, { id: 2, sendAfter: '2026-11-29T20:00:00.000Z' }]);

    // The mailer sent them; the next hourly run sees the same reminder and writes nothing new.
    await db.prepare("UPDATE notifications SET status = 'sent'").run();
    expect(await run('2026-11-29T21:07:00.000Z')).toBe(0);
    expect(notify).toHaveBeenCalledTimes(1);
    // Two hours later it is out of the window.
    expect(await run('2026-11-29T22:07:00.000Z')).toBe(0);
  });

  it('writes the same-day reminder 2 hours before, ahead of time when due within the hour', async () => {
    expect(await run('2026-11-30T17:07:00.000Z')).toBe(2);
    expect((await rows()).map((row) => [row.send_after, JSON.parse(String(row.payload)).lead])).toEqual([
      ['2026-11-30T18:00:00.000Z', 'same_day'], ['2026-11-30T18:00:00.000Z', 'same_day'],
    ]);
    // Nothing is due in the middle of the week.
    expect(await run('2026-12-02T12:07:00.000Z')).toBe(0);
  });

  it('reads the groups a page at a time, in id order', async () => {
    await db.batch(Array.from({ length: REMINDER_PAGE_SIZE + 5 }, (_, index) => group(`page${String(index).padStart(3, '0')}`)));
    const repository = createRepository(db);
    const list = vi.spyOn(repository, 'listReminderGroups');
    expect(await scheduleMeetingReminders(repository, notify, new Date('2026-11-29T20:07:00.000Z'))).toBe(2 + REMINDER_PAGE_SIZE + 5);
    expect(list.mock.calls.map(([afterId]) => afterId)).toEqual(['', `page${String(REMINDER_PAGE_SIZE - 5).padStart(3, '0')}`]);
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('queues again the reminders a lost queue send left pending, and keeps scanning after a failed send', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    notify.mockRejectedValueOnce(new Error('Queue send failed')).mockRejectedValueOnce('offline');
    expect(await run('2026-11-29T20:07:00.000Z')).toBe(0);
    expect(error).toHaveBeenCalledWith('Unable to queue meeting reminders', 2, 'Queue send failed');
    expect(await rows()).toHaveLength(2);

    // The rows exist, so the dedupe key writes nothing new; the run queues the pending ones again instead.
    expect(await run('2026-11-29T20:30:00.000Z')).toBe(0);
    expect(error).toHaveBeenLastCalledWith('Unable to queue meeting reminders', 2, 'offline');
    expect(await run('2026-11-29T21:07:00.000Z')).toBe(2);
    expect(notify).toHaveBeenLastCalledWith([{ id: 1, sendAfter: '2026-11-29T20:00:00.000Z' }, { id: 2, sendAfter: '2026-11-29T20:00:00.000Z' }]);

    // Not before its send time is 5 minutes past, nor once it is more than two hours late, nor after it was sent.
    expect(await run('2026-11-29T20:04:00.000Z')).toBe(0);
    expect(await run('2026-11-29T22:01:00.000Z')).toBe(0);
    await db.prepare("UPDATE notifications SET status = 'sent'").run();
    expect(await run('2026-11-29T20:30:00.000Z')).toBe(0);
    error.mockRestore();
  });

  it('writes nothing when no group has a meeting due', async () => {
    await db.batch([db.prepare("UPDATE groups SET meeting_reminders = 0 WHERE id = 'devtalk'"), db.prepare('DELETE FROM groups WHERE id <> ?').bind('devtalk')]);
    expect(await run('2026-11-29T20:07:00.000Z')).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });
});
