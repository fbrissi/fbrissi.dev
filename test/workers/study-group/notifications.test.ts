// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { QueuedNotification } from '@/workers/study-group/repository';
import { createUnsubscribeToken, UNSUBSCRIBE_TTL_MS } from '@/workers/study-group/unsubscribe';

import { createHarness, createWorld, expectJson, request, signIn, type Harness, type World } from './harness';

const unsubscribeSecret = 'test-unsubscribe-secret';
let h: Harness;
let w: World;
let notify: ReturnType<typeof vi.fn<(notifications: QueuedNotification[]) => Promise<void>>>;

beforeEach(async () => {
  notify = vi.fn(async () => undefined);
  h = await createHarness({ notify, unsubscribeSecret });
  w = await createWorld(h);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const call = (method: string, path: string, cookie?: string, body?: unknown) => h.handler(request(method, path, { cookie, body }));

interface Row { id: number; user_id: string; kind: string; group_id: string; payload: string; dedupe_key: string; status: string; created_at: string; send_after: string }
const rows = async () => (await h.db.prepare('SELECT id, user_id, kind, group_id, payload, dedupe_key, status, created_at, send_after FROM notifications ORDER BY id').all<Row>()).results;
const digests = async () => (await rows()).filter((row) => row.kind === 'join_request');
const HOUR = 3_600_000;
const userId = async (cookie: string) => (await (await call('GET', '/me', cookie)).json()).user.id as string;
const pendingId = async () => (await (await call('GET', `/groups/${w.groupId}/requests`, w.owner)).json()).requests[0].id as number;

describe('service email triggers', () => {
  it('writes one owner digest now, then one trailing digest at the end of the 6-hour window, with no requester data (E1)', async () => {
    const ownerId = await userId(w.owner);
    const [digest] = await digests();
    expect(digest).toMatchObject({ user_id: ownerId, kind: 'join_request', group_id: w.groupId, payload: '{}', send_after: digest.created_at });
    expect(digest.dedupe_key).toBe(`join_request:${w.groupId}:${digest.send_after}`);
    expect(notify).toHaveBeenNthCalledWith(1, [{ id: digest.id, sendAfter: digest.send_after }]);
    await h.db.prepare("UPDATE notifications SET status = 'sent', sent_at = send_after WHERE id = ?").bind(digest.id).run();

    // A request inside the window schedules one trailing digest for its end; more requests reuse it.
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode, message: 'Hello from Oscar' }), 201);
    const late = await signIn(h, { email: 'late@example.test', name: 'Late' });
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, late, { code: w.accessCode }), 201);
    const [, trailing] = await digests();
    expect(await digests()).toHaveLength(2);
    expect(trailing.send_after).toBe(new Date(Date.parse(digest.send_after) + 6 * HOUR).toISOString());
    expect(notify).toHaveBeenCalledWith([{ id: trailing.id, sendAfter: trailing.send_after }]);
    expect(JSON.stringify(await rows())).not.toMatch(/Oscar|Hello from/);

    // The trailing digest opens the next window; once 6 hours pass with no digest, a request gets one right away.
    h.clock.now = Date.parse(trailing.send_after) + 7 * HOUR;
    const later = await signIn(h, { email: 'later@example.test', name: 'Later' });
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, later, { code: w.accessCode }), 201);
    const immediate = (await digests()).at(-1)!;
    expect(await digests()).toHaveLength(3);
    expect(immediate.send_after).toBe(immediate.created_at);
  });

  it('does not let a skipped digest hold back the next one', async () => {
    await h.db.prepare("UPDATE notifications SET status = 'skipped' WHERE kind = 'join_request'").run();
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode }), 201);
    const fresh = (await digests()).at(-1)!;
    expect(fresh.send_after).toBe(fresh.created_at);
    expect(await digests()).toHaveLength(2);
  });

  it('queues one digest for pending requests when the platform admin claims DevTalk', async () => {
    const quiet = await createHarness({ notify });
    const outsider = await signIn(quiet, { sub: 'fake-outsider' });
    const { access_code: code } = (await quiet.db.prepare("SELECT access_code FROM groups WHERE id = 'devtalk'").first<{ access_code: string }>())!;
    await expectJson(await quiet.handler(request('POST', '/groups/devtalk/join', { cookie: outsider, body: { code } })), 201);
    expect(await quiet.db.prepare('SELECT COUNT(*) AS count FROM notifications').first()).toEqual({ count: 0 });
    notify.mockClear();
    const admin = await signIn(quiet, { sub: 'fake-admin' });
    const adminId = (await (await quiet.handler(request('GET', '/me', { cookie: admin }))).json()).user.id;
    const { results } = await quiet.db.prepare('SELECT id, user_id, group_id, send_after FROM notifications').all<{ id: number; user_id: string; group_id: string; send_after: string }>();
    expect(results).toEqual([{ id: expect.any(Number), user_id: adminId, group_id: 'devtalk', send_after: expect.any(String) }]);
    expect(notify).toHaveBeenCalledWith([{ id: results[0].id, sendAfter: results[0].send_after }]);
    // Signing in again claims nothing more and queues nothing.
    notify.mockClear();
    await signIn(quiet, { sub: 'fake-admin' });
    expect(notify).not.toHaveBeenCalled();
  });

  it('skips the digest for the unclaimed DevTalk group and for owners who turned email off', async () => {
    await h.db.prepare("UPDATE groups SET owner_id = NULL WHERE id = 'devtalk'").run();
    const before = (await rows()).length;
    const { access_code: devtalkCode } = (await h.db.prepare("SELECT access_code FROM groups WHERE id = 'devtalk'").first<{ access_code: string }>())!;
    await expectJson(await call('POST', '/groups/devtalk/join', w.outsider, { code: devtalkCode }), 201);

    await expectJson(await call('PUT', '/me/notifications', w.owner, { emailEnabled: false }), 200, { emailEnabled: false });
    h.clock.now += 7 * HOUR;
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode }), 201);
    expect(await rows()).toHaveLength(before);
  });

  it('tells the requester about the decision once, with the group name (E2, E3)', async () => {
    const memberRow = (await rows()).find((row) => row.kind === 'join_approved')!;
    expect(memberRow).toMatchObject({ user_id: w.memberId, payload: JSON.stringify({ groupName: 'Go Talk' }) });
    expect(memberRow.dedupe_key).toMatch(/^join_decision:\d+$/);

    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode }), 201);
    const id = await pendingId();
    expect((await call('POST', `/groups/${w.groupId}/requests/${id}/reject`, w.owner)).status).toBe(204);
    const rejected = (await rows()).find((row) => row.kind === 'join_rejected')!;
    expect(rejected).toMatchObject({ user_id: await userId(w.outsider), dedupe_key: `join_decision:${id}` });
    expect(notify).toHaveBeenLastCalledWith([{ id: rejected.id, sendAfter: rejected.send_after }]);
  });

  it('notifies the owner of an admin deletion with the reason, but not of their own deletion (E4)', async () => {
    const ownerId = await userId(w.owner);
    const reason = 'Off-topic content repeatedly';
    expect((await call('DELETE', `/groups/${w.groupId}`, w.admin, { confirmName: 'Go Talk', reason })).status).toBe(204);
    const deleted = (await rows()).find((row) => row.kind === 'group_deleted')!;
    expect(deleted).toMatchObject({ user_id: ownerId, group_id: w.groupId, dedupe_key: `group_deleted:${w.groupId}`, payload: JSON.stringify({ groupName: 'Go Talk', reason }) });

    const { group } = await expectJson(await call('POST', '/groups', w.owner, { name: 'Own Group', summary: 'Weekly English practice about our own topics.', rules: [], meetingDay: 'Monday', meetingStart: '19:00', meetingEnd: '20:00', timezone: 'UTC', meetingUrl: null, moderationMode: 'free', listed: true, acceptContentPolicy: true }), 201);
    const before = (await rows()).length;
    expect((await call('DELETE', `/groups/${group.id}`, w.owner, { confirmName: 'Own Group' })).status).toBe(204);
    expect(await rows()).toHaveLength(before);
  });

  it('keeps the write when the queue fails, logging only the row IDs', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    notify.mockRejectedValueOnce(new Error('queue down')).mockRejectedValueOnce('offline');
    h.clock.now += 7 * HOUR;
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode }), 201);
    expect(error).toHaveBeenCalledWith('Unable to queue study group notifications:', [expect.any(Number)], 'queue down');
    expect((await call('POST', `/groups/${w.groupId}/requests/${await pendingId()}/approve`, w.owner)).status).toBe(204);
    expect(error).toHaveBeenLastCalledWith('Unable to queue study group notifications:', [expect.any(Number)], 'offline');
    expect(JSON.stringify(error.mock.calls)).not.toContain('@');
  });

  it('writes outbox rows even without a queue, for the daily cron', async () => {
    const quiet = await createHarness();
    await createWorld(quiet);
    expect((await quiet.db.prepare('SELECT COUNT(*) AS count FROM notifications').first())).toEqual({ count: 2 });
  });
});

describe('round emails (E6)', () => {
  const board = (method: string, path: string, cookie: string, body?: unknown) => call(method, `/groups/${w.groupId}${path}`, cookie, body);
  const roundRows = async () => (await rows()).filter((row) => row.kind.startsWith('round_'));
  let outsiderId: string;

  beforeEach(async () => {
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode }), 201);
    expect((await call('POST', `/groups/${w.groupId}/requests/${await pendingId()}/approve`, w.owner)).status).toBe(204);
    outsiderId = await userId(w.outsider);
    for (const title of ['Clean code', 'Go tips']) await expectJson(await board('POST', '/materials', w.member, { type: 'article', title }), 201);
  });

  it('tells each member, never the owner, when a vote opens, a topic is picked or a vote closes without one', async () => {
    const { round } = await expectJson(await board('POST', '/rounds', w.owner, { mode: 'vote' }), 201);
    const started = await roundRows();
    expect(started.map((row) => row.user_id).sort()).toEqual([w.memberId, outsiderId].sort());
    for (const row of started) {
      expect(row).toMatchObject({ kind: 'round_started', group_id: w.groupId, payload: JSON.stringify({ groupName: 'Go Talk', roundId: round.id }), dedupe_key: `round_started:${round.id}:${row.user_id}`, send_after: row.created_at });
    }
    expect(notify).toHaveBeenLastCalledWith(started.map((row) => ({ id: row.id, sendAfter: row.send_after })));

    await expectJson(await board('POST', `/rounds/${round.id}/close`, w.owner), 200);
    const picked = (await roundRows()).filter((row) => row.kind === 'round_picked');
    expect(picked.map((row) => row.dedupe_key).sort()).toEqual([w.memberId, outsiderId].map((id) => `round_picked:${round.id}:${id}`).sort());
    // A repeated close writes nothing.
    await expectJson(await board('POST', `/rounds/${round.id}/close`, w.owner), 409);
    expect(await roundRows()).toHaveLength(4);

    const { round: cancelled } = await expectJson(await board('POST', '/rounds', w.owner, { mode: 'vote' }), 201);
    await expectJson(await board('POST', `/rounds/${cancelled.id}/cancel`, w.owner), 200);
    expect((await roundRows()).filter((row) => row.kind === 'round_cancelled').map((row) => row.dedupe_key).sort())
      .toEqual([w.memberId, outsiderId].map((id) => `round_cancelled:${cancelled.id}:${id}`).sort());

    // A draw picks the topic at once: no "vote open" email.
    const before = (await roundRows()).length;
    const { round: drawn } = await expectJson(await board('POST', '/rounds', w.owner, { mode: 'draw' }), 201);
    expect((await roundRows()).slice(before).map((row) => `${row.kind}:${row.user_id}`).sort())
      .toEqual([w.memberId, outsiderId].map((id) => `round_picked:${id}`).sort());
    expect((await roundRows()).slice(before).every((row) => row.dedupe_key.startsWith(`round_picked:${drawn.id}:`))).toBe(true);
  });

  it('leaves out members who turned emails off and banned members', async () => {
    await expectJson(await call('PUT', '/me/notifications', w.member, { emailEnabled: false }), 200, { emailEnabled: false });
    await h.db.prepare("INSERT INTO bans (user_id, google_sub, email, reason, created_at, expires_at) VALUES (?, 'fake-outsider', 'x@example.test', 'Spam', 'x', '2999-01-01T00:00:00.000Z')").bind(outsiderId).run();
    await expectJson(await board('POST', '/rounds', w.owner, { mode: 'draw' }), 201);
    expect(await roundRows()).toEqual([]);
  });
});

describe('rejected request cooldown', () => {
  it('blocks a new request to the same group for 7 days after a rejection, not to other groups', async () => {
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode }), 201);
    expect((await call('POST', `/groups/${w.groupId}/requests/${await pendingId()}/reject`, w.owner)).status).toBe(204);
    const blocked = await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode }), 409);
    expect(blocked.error).toMatch(/^Your request to join this group was not approved\. You can ask again after [A-Z][a-z]+ \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M \(Brasília time\)\.$/);
    const { access_code: devtalkCode } = (await h.db.prepare("SELECT access_code FROM groups WHERE id = 'devtalk'").first<{ access_code: string }>())!;
    await expectJson(await call('POST', '/groups/devtalk/join', w.outsider, { code: devtalkCode }), 201);

    h.clock.now += 7 * 86_400_000 - 60_000;
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode }), 409);
    h.clock.now += 60_000;
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode }), 201);
  });
});

describe('email preferences', () => {
  it('defaults to on, can be turned off and on, and is exported with the email records', async () => {
    await expectJson(await call('GET', '/me/notifications', w.member), 200, { emailEnabled: true });
    await expectJson(await call('PUT', '/me/notifications', w.member, { emailEnabled: false }), 200, { emailEnabled: false });
    await expectJson(await call('GET', '/me/notifications', w.member), 200, { emailEnabled: false });
    await expectJson(await call('PUT', '/me/notifications', w.member, { emailEnabled: 'no' }), 400);
    await expectJson(await call('GET', '/me/notifications'), 401);

    const data = await (await call('GET', '/me/export', w.member)).json();
    expect(data.emailPreferences).toEqual({ emailEnabled: false });
    expect(data.emails).toEqual([{ kind: 'join_approved', groupId: w.groupId, groupName: 'Go Talk', reason: null, status: 'pending', createdAt: expect.any(String), sentAt: null }]);
    const owner = await (await call('GET', '/me/export', w.owner)).json();
    expect(owner.emails).toEqual([expect.objectContaining({ kind: 'join_request', groupName: 'Go Talk', reason: null })]);
    expect((await call('DELETE', `/groups/${w.groupId}`, w.admin, { confirmName: 'Go Talk', reason: 'Off-topic content repeatedly' })).status).toBe(204);
    await h.db.prepare('DELETE FROM groups WHERE id = ?').bind(w.groupId).run();
    const after = await (await call('GET', '/me/export', w.owner)).json();
    expect(after.emails).toEqual([
      expect.objectContaining({ kind: 'join_request', groupId: w.groupId, groupName: null }),
      expect.objectContaining({ kind: 'group_deleted', groupName: 'Go Talk', reason: 'Off-topic content repeatedly' }),
    ]);
    await expectJson(await call('PUT', '/me/notifications', w.member, { emailEnabled: true }), 200, { emailEnabled: true });
    expect((await (await call('GET', '/me/export', w.member)).json()).emailPreferences).toEqual({ emailEnabled: true });
  });

  it('lets a user turn email off before accepting a new policy version', async () => {
    await h.db.prepare("UPDATE consents SET version = '2000-01-01' WHERE user_id = ?").bind(w.memberId).run();
    await expectJson(await call('PUT', '/me/notifications', w.member, { emailEnabled: false }), 200, { emailEnabled: false });
  });
});

describe('one-click unsubscribe', () => {
  const tokenFor = (id: string, environment = 'production', secret = unsubscribeSecret, at = new Date(h.clock.now)) => createUnsubscribeToken(id, environment, secret, at);
  const oneClick = (token: string) => h.handler(request('POST', `/unsubscribe?t=${encodeURIComponent(token)}`, { origin: null, contentType: 'application/x-www-form-urlencoded', body: 'List-Unsubscribe=One-Click' }));

  it('turns email off from a mail provider POST with no Origin, session or JSON body', async () => {
    const response = await oneClick(await tokenFor(w.memberId));
    await expectJson(response, 200, { emailEnabled: false });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expectJson(await call('GET', '/me/notifications', w.member), 200, { emailEnabled: false });
    // A token for an account that no longer exists changes nothing.
    await expectJson(await oneClick(await tokenFor('gone0001')), 200);
    expect(await h.db.prepare('SELECT COUNT(*) AS count FROM notification_preferences').first()).toEqual({ count: 1 });
  });

  it('rejects tampered, expired, foreign-environment and other-purpose tokens', async () => {
    const valid = await tokenFor(w.memberId);
    for (const token of [
      '',
      `${valid}x`,
      await tokenFor(w.memberId, 'sandbox'),
      await tokenFor(w.memberId, 'production', 'another-secret'),
      await tokenFor(w.memberId, 'production', unsubscribeSecret, new Date(h.clock.now - UNSUBSCRIBE_TTL_MS - 60_000)),
    ]) {
      await expectJson(await oneClick(token), 400, { error: 'invalid_link' });
    }
    const { signValue } = await import('@/workers/study-group/crypto');
    await expectJson(await oneClick(await signValue({ sub: w.memberId, env: 'production' }, unsubscribeSecret, new Date(h.clock.now + 60_000))), 400);
    await expectJson(await oneClick(await signValue({ sub: 7, env: 'production', purpose: 'unsubscribe' }, unsubscribeSecret, new Date(h.clock.now + 60_000))), 400);
    await expectJson(await call('GET', '/me/notifications', w.member), 200, { emailEnabled: true });
  });

  it('rejects every link while the secret is missing', async () => {
    const unconfigured = await createHarness();
    const token = await createUnsubscribeToken('user0001', 'production', unsubscribeSecret, new Date(unconfigured.clock.now));
    await expectJson(await unconfigured.handler(request('POST', `/unsubscribe?t=${token}`, { origin: null })), 400);
  });

  it('never unsubscribes on GET: it redirects to the confirmation page', async () => {
    const token = await tokenFor(w.memberId);
    const response = await h.handler(request('GET', `/unsubscribe?t=${encodeURIComponent(token)}`));
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe(`https://fbrissi.dev/study-groups/unsubscribe?t=${encodeURIComponent(token)}`);
    expect((await h.handler(request('GET', '/unsubscribe'))).headers.get('Location')).toBe('https://fbrissi.dev/study-groups/unsubscribe?t=');
    await expectJson(await call('GET', '/me/notifications', w.member), 200, { emailEnabled: true });
  });

  it('exempts only the unsubscribe route from the Origin and JSON checks', async () => {
    expect((await h.handler(request('PUT', '/me/notifications', { cookie: w.member, origin: null, body: { emailEnabled: false } }))).status).toBe(403);
    expect((await h.handler(request('PUT', '/me/notifications', { cookie: w.member, contentType: 'application/x-www-form-urlencoded', body: 'emailEnabled=false' }))).status).toBe(415);
    expect((await h.handler(request('POST', '/auth/logout', { origin: null }))).status).toBe(403);
  });
});
