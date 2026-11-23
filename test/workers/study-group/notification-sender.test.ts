// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { openD1Sqlite } from '@/workers/local/d1-sqlite';
import { createNotificationSender, type NotificationSenderDeps } from '@/workers/study-group/notification-sender';
import type { D1Like } from '@/workers/study-group/repository';
import { PermanentEmailError, type OutgoingEmail } from '@/workers/study-group/ses';
import { verifyUnsubscribeToken } from '@/workers/study-group/unsubscribe';

import { migrationsDir } from './harness';

const now = new Date('2026-11-22T12:00:00.000Z');
const iso = (offsetMs = 0) => new Date(now.getTime() + offsetMs).toISOString();
let db: D1Like;
let send: ReturnType<typeof vi.fn<(email: OutgoingEmail) => Promise<{ messageId: string }>>>;

beforeEach(async () => {
  db = openD1Sqlite(':memory:', migrationsDir);
  send = vi.fn(async () => ({ messageId: 'ses-1' }));
  await db.batch([
    db.prepare("INSERT INTO users (id, google_sub, email, display_name, created_at, updated_at) VALUES ('owner001', 'o', 'Owner@Example.test', 'Olivia', 'x', 'x')"),
    db.prepare("INSERT INTO users (id, google_sub, email, display_name, created_at, updated_at) VALUES ('member01', 'm', 'member@example.test', 'Max', 'x', 'x')"),
    db.prepare("INSERT INTO groups (id, owner_id, name, summary, meeting_day, meeting_start, meeting_end, timezone, access_code, created_at, updated_at) VALUES ('gotalk', 'owner001', 'Go Talk', 'A summary for Go', 'Mon', '20:00', '21:00', 'UTC', 'c', 'x', 'x')"),
    db.prepare("INSERT INTO join_requests (group_id, user_id, message, status, created_at) VALUES ('gotalk', 'member01', 'Secret hello from Max', 'pending', 'x')"),
  ]);
});

function sender(overrides: Partial<NotificationSenderDeps> = {}) {
  return createNotificationSender({
    db, send, environment: 'production', appOrigin: 'https://fbrissi.dev', unsubscribeSecret: 'unsub', allowlist: null, dailyCap: 500, now: () => now, ...overrides,
  });
}

async function insert(kind: string, userId: string, payload = '{}', extra = '', sendAfter = iso(-60_000)): Promise<number> {
  const row = await db.prepare(`INSERT INTO notifications (user_id, kind, group_id, payload, dedupe_key, created_at, send_after${extra ? ', status, sent_at' : ''}) VALUES (?, ?, 'gotalk', ?, ?, ?, ?${extra ? `, ${extra}` : ''}) RETURNING id`)
    .bind(userId, kind, payload, `${kind}:${crypto.randomUUID()}`, iso(-60_000), sendAfter).first<{ id: number }>();
  return row!.id;
}

const status = async (id: number) => db.prepare('SELECT status, attempts, sent_at, provider_message_id FROM notifications WHERE id = ?').bind(id).first();
const MINUTE = 60_000;

describe('notification sender', () => {
  it('sends the owner digest with the pending count, unsubscribe headers and no requester data (E1)', async () => {
    const id = await insert('join_request', 'owner001');
    expect(await sender()(id)).toBe('sent');

    const email = send.mock.calls[0][0];
    expect(email.to).toBe('Owner@Example.test');
    expect(email.subject).toBe('New requests to join Go Talk');
    expect(email.text).toContain('1 person is waiting to join Go Talk.');
    expect(`${email.text}${email.html}${email.subject}`).not.toMatch(/Max|Secret hello|member@example/);
    expect(email.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(email.headers['Auto-Submitted']).toBe('auto-generated');
    const oneClick = new URL(email.headers['List-Unsubscribe'].slice(1, -1));
    expect(`${oneClick.origin}${oneClick.pathname}`).toBe('https://fbrissi.dev/api/study-group/unsubscribe');
    expect(await verifyUnsubscribeToken(oneClick.searchParams.get('t')!, 'production', 'unsub', now)).toBe('owner001');
    expect(email.text).toContain(`https://fbrissi.dev/study-groups/unsubscribe?t=${encodeURIComponent(oneClick.searchParams.get('t')!)}`);
    expect(await status(id)).toEqual({ status: 'sent', attempts: 1, sent_at: now.toISOString(), provider_message_id: 'ses-1' });

    // Idempotent: a redelivered message, or a row that no longer exists, sends nothing.
    expect(await sender()(id)).toBe('done');
    expect(await sender()(9999)).toBe('done');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('leaves banned users’ requests out of the digest count, and drops a digest with only those', async () => {
    await db.batch([
      db.prepare("INSERT INTO users (id, google_sub, email, display_name, created_at, updated_at) VALUES ('banned01', 'b', 'banned@example.test', 'Bea', 'x', 'x')"),
      db.prepare("INSERT INTO join_requests (group_id, user_id, status, created_at) VALUES ('gotalk', 'banned01', 'pending', 'x')"),
      db.prepare("INSERT INTO bans (user_id, google_sub, email, reason, created_at, expires_at) VALUES ('banned01', 'b', 'banned@example.test', 'Spam', 'x', 'x')"),
    ]);
    expect(await sender()(await insert('join_request', 'owner001'))).toBe('sent');
    expect(send.mock.calls[0][0].text).toContain('1 person is waiting to join Go Talk.');
    await db.prepare("UPDATE join_requests SET status = 'approved' WHERE user_id = 'member01'").run();
    expect(await sender()(await insert('join_request', 'owner001'))).toBe('skipped');
  });

  it('drops the digest when no request is pending or the group is gone', async () => {
    await db.prepare("UPDATE join_requests SET status = 'approved'").run();
    const none = await insert('join_request', 'owner001');
    expect(await sender()(none)).toBe('skipped');
    await db.prepare("UPDATE groups SET deleted_at = 'x'").run();
    const gone = await insert('join_request', 'owner001');
    expect(await sender()(gone)).toBe('skipped');
    expect(send).not.toHaveBeenCalled();
    expect(await status(gone)).toEqual({ status: 'skipped', attempts: 1, sent_at: null, provider_message_id: null });
  });

  it('renders decisions and admin deletions from the stored payload (E2–E4)', async () => {
    const approved = await insert('join_approved', 'member01', '{"groupName":"Go Talk"}');
    expect(await sender()(approved)).toBe('sent');
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'member@example.test', subject: 'You joined Go Talk' });
    const deleted = await insert('group_deleted', 'owner001', '{"groupName":"Go Talk","reason":"Off-topic spam group"}');
    expect(await sender()(deleted)).toBe('sent');
    expect(send.mock.calls[1][0].text).toContain('Reason: Off-topic spam group');
    for (const payload of ['not json', 'null']) {
      const broken = await insert('join_rejected', 'member01', payload);
      expect(await sender()(broken)).toBe('sent');
    }
    expect(send.mock.calls[2][0].subject).toBe('Your request to join ');
  });

  it('skips users who turned email off, except for the ban and restore notices', async () => {
    await db.prepare("INSERT INTO notification_preferences (user_id, email_enabled, updated_at) VALUES ('member01', 0, 'x')").run();
    const id = await insert('join_approved', 'member01', '{"groupName":"Go Talk"}');
    expect(await sender()(id)).toBe('skipped');
    expect(send).not.toHaveBeenCalled();
    const banned = await insert('account_banned', 'member01', '{"reason":"Political propaganda"}');
    await db.prepare('UPDATE notifications SET group_id = NULL WHERE id = ?').bind(banned).run();
    expect(await sender()(banned)).toBe('sent');
    expect(send.mock.calls[0][0]).toMatchObject({ to: 'member@example.test', subject: 'Your English Study Groups account was banned' });
    expect(send.mock.calls[0][0].text).toContain('Reason: Political propaganda');
    const restored = await insert('account_restored', 'member01');
    expect(await sender()(restored)).toBe('sent');
    expect(send.mock.calls[1][0].subject).toBe('Your English Study Groups account was restored');
    // Account notices ignore the opt-out, so they carry no one-click unsubscribe headers.
    for (const call of send.mock.calls) expect(call[0].headers).toEqual({ 'Auto-Submitted': 'auto-generated' });
  });

  it('sends only to the allowlist outside production, with the sandbox prefix', async () => {
    const options = { environment: 'sandbox' as const, appOrigin: 'https://sandbox.fbrissi.dev', allowlist: ['owner@example.test'] };
    const blocked = await insert('join_approved', 'member01', '{"groupName":"Go Talk"}');
    expect(await sender(options)(blocked)).toBe('skipped');
    const allowed = await insert('group_deleted', 'owner001', '{"groupName":"Go Talk","reason":"Reason text"}');
    expect(await sender(options)(allowed)).toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].subject).toBe('[SANDBOX] Your group Go Talk was deleted');
    expect(send.mock.calls[0][0].headers['List-Unsubscribe']).toMatch(/^<https:\/\/sandbox\.fbrissi\.dev\/api\/study-group\/unsubscribe\?t=/);
  });

  it('caps emails per recipient and in total over 24 hours', async () => {
    for (let index = 0; index < 20; index += 1) await insert('join_approved', 'member01', '{}', `'sent', '${iso(-3_600_000)}'`);
    const capped = await insert('join_approved', 'member01', '{"groupName":"Go Talk"}');
    expect(await sender()(capped)).toBe('skipped');
    const other = await insert('group_deleted', 'owner001', '{"groupName":"Go Talk"}');
    expect(await sender({ dailyCap: 20 })(other)).toBe('skipped');
    const under = await insert('group_deleted', 'owner001', '{"groupName":"Go Talk"}');
    expect(await sender({ dailyCap: 21 })(under)).toBe('sent');
  });

  it('marks permanent failures and leaves temporary ones to the queue retry', async () => {
    const permanent = await insert('join_approved', 'member01', '{"groupName":"Go Talk"}');
    send.mockRejectedValueOnce(new PermanentEmailError('SES SendEmail failed with 400 MessageRejected'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await sender()(permanent)).toBe('failed');
    expect(await status(permanent)).toMatchObject({ status: 'failed', attempts: 1 });

    const temporary = await insert('join_approved', 'member01', '{"groupName":"Go Talk"}');
    send.mockRejectedValueOnce(new Error('SES SendEmail failed with 503 Unknown'));
    await expect(sender()(temporary)).rejects.toThrow('503');
    expect(await status(temporary)).toMatchObject({ status: 'pending', attempts: 1 });
    expect(await sender()(temporary)).toBe('sent');
  });

  it('refuses to send without the unsubscribe secret and uses the real clock by default', async () => {
    const id = await insert('join_approved', 'member01', '{"groupName":"Go Talk"}');
    await expect(sender({ unsubscribeSecret: '' })(id)).rejects.toThrow('STUDY_GROUP_UNSUBSCRIBE_SECRET');
    expect(await sender({ now: undefined })(id)).toBe('sent');
  });

  it('claims the row first, so a parallel or repeated delivery sends nothing, and takes over a stale claim', async () => {
    const id = await insert('join_approved', 'member01', '{"groupName":"Go Talk"}');
    let release: () => void = () => undefined;
    send.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ messageId: 'ses-slow' }); }));
    const first = sender()(id);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(await sender()(id)).toBe('done');
    expect(await status(id)).toMatchObject({ status: 'sending', attempts: 1 });
    release();
    expect(await first).toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);

    const stale = await insert('join_approved', 'member01', '{"groupName":"Go Talk"}');
    await db.prepare("UPDATE notifications SET status = 'sending', claimed_at = ?, attempts = 1 WHERE id = ?").bind(iso(-5 * MINUTE), stale).run();
    expect(await sender()(stale)).toBe('done');
    await db.prepare('UPDATE notifications SET claimed_at = ? WHERE id = ?').bind(iso(-11 * MINUTE), stale).run();
    expect(await sender()(stale)).toBe('sent');
    expect(await status(stale)).toMatchObject({ status: 'sent', attempts: 2 });
  });

  it('defers a row scheduled for later (the trailing digest)', async () => {
    const id = await insert('join_request', 'owner001', '{}', '', iso(90 * MINUTE));
    expect(await sender()(id)).toEqual({ deferSeconds: 5400 });
    expect(await status(id)).toMatchObject({ status: 'pending', attempts: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it('marks the row failed on the last attempt instead of retrying', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const id = await insert('join_approved', 'member01', '{"groupName":"Go Talk"}');
    await db.prepare('UPDATE notifications SET attempts = 5 WHERE id = ?').bind(id).run();
    send.mockRejectedValueOnce(new Error('SES SendEmail failed with 503 Unknown'));
    expect(await sender()(id)).toBe('failed');
    expect(await status(id)).toMatchObject({ status: 'failed', attempts: 6 });
    expect(error).toHaveBeenCalledWith('Study group notification failed', id, 'SES SendEmail failed with 503 Unknown');
    const other = await insert('join_approved', 'member01', '{"groupName":"Go Talk"}');
    await db.prepare('UPDATE notifications SET attempts = 5 WHERE id = ?').bind(other).run();
    send.mockRejectedValueOnce('offline');
    expect(await sender()(other)).toBe('failed');
    expect(error).toHaveBeenLastCalledWith('Study group notification failed', other, 'offline');
  });

  it('sends a digest only for requests that arrived after the last sent one', async () => {
    await db.prepare('UPDATE join_requests SET created_at = ?').bind(iso(-120 * MINUTE)).run();
    await insert('join_request', 'owner001', '{}', `'sent', '${iso(-30 * MINUTE)}'`);
    // The pending request was created before that digest went out.
    const covered = await insert('join_request', 'owner001');
    expect(await sender()(covered)).toBe('skipped');
    // A request approved before the digest is sent, then a new one: the digest counts only what is still pending.
    await db.prepare("UPDATE join_requests SET status = 'approved'").run();
    await db.prepare("INSERT INTO join_requests (group_id, user_id, status, created_at) VALUES ('gotalk', 'owner001', 'pending', ?)").bind(iso(-MINUTE)).run();
    const fresh = await insert('join_request', 'owner001');
    expect(await sender()(fresh)).toBe('sent');
    expect(send.mock.calls[0][0].text).toContain('1 person is waiting');
  });
});
