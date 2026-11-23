// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRepository } from '@/workers/study-group/repository';

import { png } from './fixtures/images';
import { appOrigin, authorizeAt, base, cookieValue, createHarness, createWorld, expectJson, memoryBucket, request, signIn, startLogin, type Harness, type World } from './harness';

let h: Harness;
let w: World;
let bucket: ReturnType<typeof memoryBucket>;

beforeEach(async () => {
  bucket = memoryBucket();
  h = await createHarness({ icons: bucket, notify: vi.fn(async () => undefined) });
  w = await createWorld(h);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const call = (method: string, path: string, cookie?: string, body?: unknown) => h.handler(request(method, path, { cookie, body }));
const reason = 'Repeated political propaganda in suggestions';
const groupBody = (name: string) => ({ name, summary: 'Weekly English practice about our own topics.', rules: [], meetingDay: 'Monday', meetingStart: '19:00', meetingEnd: '20:00', timezone: 'UTC', meetingUrl: null, moderationMode: 'free', listed: true, acceptContentPolicy: true });

async function callback(user: { sub?: string; email?: string; name?: string }) {
  const { flow, params } = await startLogin(h);
  const url = await authorizeAt(h, params, user);
  return h.handler(request('GET', `${base}/auth/callback${url.search}`, { cookie: `__Host-sg_oauth=${flow}` }));
}

describe('admin user list', () => {
  it('searches by display name, exact email or ID, pages results and never returns emails', async () => {
    const all = await expectJson(await call('GET', '/admin/users', w.admin), 200);
    expect(all.users.map((user: { displayName: string }) => user.displayName).sort()).toEqual(['Ada', 'Max', 'Olivia', 'Oscar']);
    expect(JSON.stringify(all)).not.toContain('@');
    expect(all.users.find((user: { displayName: string }) => user.displayName === 'Ada')).toMatchObject({ isPlatformAdmin: true, ban: null });
    expect(all.users.find((user: { displayName: string }) => user.displayName === 'Olivia')).toMatchObject({ isPlatformAdmin: false, ownedGroups: 1 });

    expect((await (await call('GET', '/admin/users?q=ma', w.admin)).json()).users.map((user: { id: string }) => user.id)).toEqual([w.memberId]);
    expect((await (await call('GET', '/admin/users?q=MEMBER%40example.test', w.admin)).json()).users.map((user: { id: string }) => user.id)).toEqual([w.memberId]);
    expect((await (await call('GET', `/admin/users?q=${w.memberId}`, w.admin)).json()).users).toHaveLength(1);
    expect((await (await call('GET', '/admin/users?q=%25', w.admin)).json()).users).toEqual([]);

    for (let index = 0; index < 24; index += 1) await signIn(h, { email: `bulk${index}@example.test`, name: `Bulk ${index}` });
    const first = await expectJson(await call('GET', '/admin/users', w.admin), 200);
    expect(first.users).toHaveLength(24);
    const second = await expectJson(await call('GET', `/admin/users?cursor=${encodeURIComponent(first.nextCursor)}`, w.admin), 200);
    expect(second.users).toHaveLength(4);
    await expectJson(await call('GET', '/admin/users', w.owner), 403);
  });
});

describe('account bans', () => {
  it('bans with a reason: groups deleted with an E4 email each, sessions ended, content hidden, sign-in refused', async () => {
    // The member owns a group with an icon, and has content in the owner's group.
    const { group } = await expectJson(await call('POST', '/groups', w.member, groupBody('Member Group')), 201);
    expect((await h.handler(new Request(`${base}/groups/${group.id}/icon`, { method: 'PUT', headers: { Origin: appOrigin, 'Content-Type': 'image/png', Cookie: w.member }, body: png(8, 8) }))).status).toBe(200);
    const { material } = await expectJson(await call('POST', `/groups/${w.groupId}/materials`, w.member, { type: 'article', title: 'Member suggestion' }), 201);
    await expectJson(await call('POST', `/groups/${w.groupId}/materials`, w.owner, { type: 'article', title: 'Owner suggestion' }), 201);
    const { round } = await expectJson(await call('POST', `/groups/${w.groupId}/rounds`, w.owner, { mode: 'vote' }), 201);
    await expectJson(await call('POST', `/groups/${w.groupId}/rounds/${round.id}/votes`, w.member, { materialId: material.id }), 201);
    const outsiderId = (await (await call('GET', '/me', w.outsider)).json()).user.id;

    await expectJson(await call('POST', `/admin/users/${w.memberId}/ban`, w.admin, {}), 400);
    expect((await call('POST', `/admin/users/${w.memberId}/ban`, w.admin, { reason })).status).toBe(204);

    expect((await (await call('GET', '/me', w.member)).json()).user).toBeNull();
    await expectJson(await call('GET', `/groups/${group.id}`, w.owner), 404);
    expect(bucket.objects.size).toBe(0);
    const { materials } = await (await call('GET', `/groups/${w.groupId}/materials`, w.owner)).json();
    expect(materials.map((item: { title: string }) => item.title)).toEqual(['Owner suggestion']);
    expect((await (await call('GET', `/groups/${w.groupId}/rounds/current`, w.owner)).json()).tally).toEqual([]);
    const { members } = await (await call('GET', `/groups/${w.groupId}/members`, w.owner)).json();
    expect(members.map((member: { displayName: string }) => member.displayName)).toEqual(['Olivia']);

    const { actions } = await (await call('GET', '/admin/moderation-log', w.admin)).json();
    expect(actions.map((action: { action: string }) => action.action).sort()).toEqual(['ban_user', 'delete_group']);
    const outbox = await h.db.prepare("SELECT user_id, payload FROM notifications WHERE kind = 'group_deleted'").all();
    expect(outbox.results).toEqual([{ user_id: w.memberId, payload: JSON.stringify({ groupName: 'Member Group', reason }) }]);
    const notice = await h.db.prepare("SELECT user_id, group_id, payload, dedupe_key FROM notifications WHERE kind = 'account_banned'").first<{ dedupe_key: string }>();
    expect(notice).toMatchObject({ user_id: w.memberId, group_id: null, payload: JSON.stringify({ reason }) });
    expect(notice!.dedupe_key).toMatch(new RegExp(`^account_banned:${w.memberId}:`));
    const listed = (await (await call('GET', `/admin/users?q=${w.memberId}`, w.admin)).json()).users[0];
    expect(listed).toMatchObject({ ownedGroups: 0, ban: { reason, createdAt: expect.any(String) } });
    // The ban record expires 2 years after the ban.
    const bannedAt = new Date(listed.ban.createdAt);
    bannedAt.setUTCFullYear(bannedAt.getUTCFullYear() + 2);
    expect(listed.ban.expiresAt).toBe(bannedAt.toISOString());

    // The same Google account, and another account with the same email, can't sign in or sign up.
    expect((await callback({ sub: 'fake-member' })).headers.get('Location')).toBe(`${appOrigin}/study-groups?signin=banned`);
    expect((await callback({ email: 'member@example.test', name: 'Max Again' })).headers.get('Location')).toBe(`${appOrigin}/study-groups?signin=banned`);
    expect((await callback({ sub: 'fake-outsider' })).headers.get('Location')).not.toMatch(/banned/);
    expect(outsiderId).toBeTruthy();

    await expectJson(await call('POST', `/admin/users/${w.memberId}/ban`, w.admin, { reason }), 409, { error: 'This user is already banned' });
  });

  it('sends the ban notice even to a user who turned service emails off, but no group emails', async () => {
    await expectJson(await call('PUT', '/me/notifications', w.member, { emailEnabled: false }), 200);
    await expectJson(await call('POST', '/groups', w.member, groupBody('Quiet Group')), 201);
    expect((await call('POST', `/admin/users/${w.memberId}/ban`, w.admin, { reason })).status).toBe(204);
    const { results } = await h.db.prepare('SELECT kind FROM notifications WHERE user_id = ? ORDER BY id').bind(w.memberId).all<{ kind: string }>();
    expect(results.map((row) => row.kind)).toEqual(['join_approved', 'account_banned']);
  });

  it('blocks a sign-up that started before the ban', async () => {
    const { flow, params } = await startLogin(h);
    const url = await authorizeAt(h, params, { email: 'late@example.test', name: 'Late' });
    const pending = cookieValue(await h.handler(request('GET', `${base}/auth/callback${url.search}`, { cookie: `__Host-sg_oauth=${flow}` })), '__Host-sg_signup')!;
    await h.db.prepare("INSERT INTO bans (user_id, google_sub, email, reason, created_at, expires_at) SELECT id, 'other-sub', 'late@example.test', 'x', 'x', 'x' FROM users LIMIT 1").run();
    await expectJson(await h.handler(request('POST', '/auth/signup', { cookie: `__Host-sg_signup=${pending}`, body: { acceptTerms: true, acceptPrivacy: true, confirmAge: true } })), 403, { error: 'account_banned' });
  });

  it('can’t ban a platform admin, oneself or an unknown user', async () => {
    const adminId = (await (await call('GET', '/me', w.admin)).json()).user.id;
    await expectJson(await call('POST', `/admin/users/${adminId}/ban`, w.admin, { reason }), 409, { error: 'A platform admin can’t be banned' });
    await expectJson(await call('POST', '/admin/users/unknown0001/ban', w.admin, { reason }), 404, { error: 'User not found' });
    await expectJson(await call('POST', `/admin/users/${w.memberId}/ban`, w.owner, { reason }), 403);
  });

  it('unbans with a reason, logged; deleted groups stay deleted and content shows again', async () => {
    await expectJson(await call('POST', `/groups/${w.groupId}/materials`, w.member, { type: 'article', title: 'Member suggestion' }), 201);
    await expectJson(await call('DELETE', `/admin/users/${w.memberId}/ban`, w.admin, { reason: 'Never banned at all' }), 409, { error: 'This user is not banned' });
    expect((await call('POST', `/admin/users/${w.memberId}/ban`, w.admin, { reason })).status).toBe(204);
    await expectJson(await call('DELETE', `/admin/users/${w.memberId}/ban`, w.admin, {}), 400);
    expect((await call('DELETE', `/admin/users/${w.memberId}/ban`, w.admin, { reason: 'Appeal accepted after review' })).status).toBe(204);
    const { actions } = await (await call('GET', '/admin/moderation-log', w.admin)).json();
    expect(actions[0]).toMatchObject({ action: 'unban_user', targetType: 'user', targetId: w.memberId, label: 'Max', reason: 'Appeal accepted after review' });
    expect((await (await call('GET', `/groups/${w.groupId}/materials`, w.owner)).json()).materials).toHaveLength(1);
    const again = await signIn(h, { sub: 'fake-member' });
    expect((await (await call('GET', '/me', again)).json()).user.id).toBe(w.memberId);
    // The "account restored" email goes out once, without the reason.
    const restored = await h.db.prepare("SELECT user_id, group_id, payload, dedupe_key FROM notifications WHERE kind = 'account_restored'").all<{ dedupe_key: string }>();
    expect(restored.results).toEqual([{ user_id: w.memberId, group_id: null, payload: '{}', dedupe_key: expect.stringMatching(new RegExp(`^account_restored:${w.memberId}:`)) }]);
    expect(h.deps.notify).toHaveBeenLastCalledWith([{ id: expect.any(Number), sendAfter: expect.any(String) }]);
  });

  it('sends the restore notice even to a user who turned service emails off', async () => {
    await expectJson(await call('PUT', '/me/notifications', w.member, { emailEnabled: false }), 200);
    expect((await call('POST', `/admin/users/${w.memberId}/ban`, w.admin, { reason })).status).toBe(204);
    expect((await call('DELETE', `/admin/users/${w.memberId}/ban`, w.admin, { reason: 'Appeal accepted after review' })).status).toBe(204);
    const { results } = await h.db.prepare('SELECT kind FROM notifications WHERE user_id = ? ORDER BY id').bind(w.memberId).all<{ kind: string }>();
    expect(results.map((row) => row.kind)).toEqual(['join_approved', 'account_banned', 'account_restored']);
  });

  it('renews a ban with a reason for another 2 years, logged and without an email', async () => {
    const renewal = 'Still posting propaganda from another account';
    await expectJson(await call('POST', `/admin/users/${w.memberId}/ban/renew`, w.admin, { reason: renewal }), 409, { error: 'This user is not banned' });
    expect((await call('POST', `/admin/users/${w.memberId}/ban`, w.admin, { reason })).status).toBe(204);
    h.clock.now += 400 * 86_400_000;
    const admin = await signIn(h, { sub: 'fake-admin' });
    const owner = await signIn(h, { sub: 'fake-owner' });
    await expectJson(await call('POST', `/admin/users/${w.memberId}/ban/renew`, admin, {}), 400);
    await expectJson(await call('POST', `/admin/users/${w.memberId}/ban/renew`, owner, { reason: renewal }), 403);
    expect((await call('POST', `/admin/users/${w.memberId}/ban/renew`, admin, { reason: renewal })).status).toBe(204);
    const { actions } = await (await call('GET', '/admin/moderation-log', admin)).json();
    expect(actions[0]).toMatchObject({ action: 'renew_ban', targetId: w.memberId, reason: renewal });
    const listed = (await (await call('GET', `/admin/users?q=${w.memberId}`, admin)).json()).users[0];
    const expected = new Date(actions[0].createdAt);
    expected.setUTCFullYear(expected.getUTCFullYear() + 2);
    expect(listed.ban).toMatchObject({ reason: renewal, expiresAt: expected.toISOString() });
    const { results } = await h.db.prepare("SELECT kind FROM notifications WHERE user_id = ? AND kind LIKE 'account_%'").bind(w.memberId).all<{ kind: string }>();
    expect(results.map((row) => row.kind)).toEqual(['account_banned']);
  });

  it('lifts a ban when its record expires (daily purge)', async () => {
    expect((await call('POST', `/admin/users/${w.memberId}/ban`, w.admin, { reason })).status).toBe(204);
    const banOf = async () => {
      const admin = await signIn(h, { sub: 'fake-admin' });
      return (await (await call('GET', `/admin/users?q=${w.memberId}`, admin)).json()).users[0].ban;
    };
    h.clock.now += 365 * 86_400_000;
    await createRepository(h.db).purgeExpired(new Date(h.clock.now));
    expect(await banOf()).not.toBeNull();
    h.clock.now += 366 * 86_400_000;
    await createRepository(h.db).purgeExpired(new Date(h.clock.now));
    expect(await banOf()).toBeNull();
    const again = await signIn(h, { sub: 'fake-member' });
    expect((await (await call('GET', '/me', again)).json()).user.id).toBe(w.memberId);
  });

  it('bans a user who owns nothing without touching the public list cache', async () => {
    const cacheDelete = vi.fn(async () => true);
    const cached = await createHarness({ cache: { match: async () => undefined, put: async () => undefined, delete: cacheDelete } });
    const world = await createWorld(cached);
    const before = cacheDelete.mock.calls.length;
    expect((await cached.handler(request('POST', `/admin/users/${world.memberId}/ban`, { cookie: world.admin, body: { reason } }))).status).toBe(204);
    expect(cacheDelete.mock.calls.length).toBe(before);
  });
});

describe('ban expiry and admin reasons', () => {
  it('lifts a ban exactly at its expiry, before the purge, and the purge logs it without an email', async () => {
    expect((await call('POST', `/admin/users/${w.memberId}/ban`, w.admin, { reason })).status).toBe(204);
    await expectJson(await call('POST', `/groups/${w.groupId}/materials`, w.owner, { type: 'article', title: 'Owner suggestion' }), 201);
    // The ban's expiry passes (by the database clock); the row is still there until the daily purge.
    await h.db.prepare("UPDATE bans SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    expect((await (await call('GET', `/admin/users?q=${w.memberId}`, w.admin)).json()).users[0].ban).toBeNull();
    const again = await signIn(h, { sub: 'fake-member' });
    expect((await (await call('GET', '/me', again)).json()).user.id).toBe(w.memberId);
    const { members } = await (await call('GET', `/groups/${w.groupId}/members`, w.owner)).json();
    expect(members.map((member: { displayName: string }) => member.displayName)).toContain('Max');
    await expectJson(await call('DELETE', `/admin/users/${w.memberId}/ban`, w.admin, { reason: 'Appeal accepted after review' }), 409);

    await createRepository(h.db).purgeExpired(new Date(h.clock.now));
    expect(await h.db.prepare('SELECT COUNT(*) AS count FROM bans').first()).toEqual({ count: 0 });
    const { actions } = await (await call('GET', '/admin/moderation-log', w.admin)).json();
    expect(actions[0]).toMatchObject({ action: 'unban_user', targetType: 'user', targetId: w.memberId, label: 'Max', reason: 'Ban expired', actorName: null });
    expect(await h.db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE kind = 'account_restored'").first()).toEqual({ count: 0 });
  });

  it('bans again over an expired row the purge hasn’t deleted yet', async () => {
    expect((await call('POST', `/admin/users/${w.memberId}/ban`, w.admin, { reason })).status).toBe(204);
    await h.db.prepare("UPDATE bans SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    expect((await call('POST', `/admin/users/${w.memberId}/ban`, w.admin, { reason: 'Banned again for the same reason' })).status).toBe(204);
    expect(await h.db.prepare('SELECT reason FROM bans').all()).toMatchObject({ results: [{ reason: 'Banned again for the same reason' }] });
  });

  it('answers every admin route with the same plain message for a missing, short or long reason', async () => {
    const reasonError = { error: 'A reason of 10 to 500 characters is required.' };
    await h.handler(new Request(`${base}/groups/${w.groupId}/icon`, { method: 'PUT', headers: { Origin: appOrigin, 'Content-Type': 'image/png', Cookie: w.owner }, body: png(8, 8) }));
    const { material } = await expectJson(await call('POST', `/groups/${w.groupId}/materials`, w.owner, { type: 'article', title: 'Owner suggestion' }), 201);
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode, message: 'Call me at +55 11 99999-9999' }), 201);
    const { requests } = await (await call('GET', `/groups/${w.groupId}/requests`, w.owner)).json();
    const outsiderId = (await (await call('GET', '/me', w.outsider)).json()).user.id;
    expect((await call('POST', `/admin/users/${outsiderId}/ban`, w.admin, { reason })).status).toBe(204);
    const routes: [string, string, Record<string, unknown>][] = [
      ['POST', `/admin/users/${w.memberId}/ban`, {}],
      ['POST', `/admin/users/${outsiderId}/ban/renew`, {}],
      ['DELETE', `/admin/users/${outsiderId}/ban`, {}],
      ['DELETE', `/groups/${w.groupId}`, { confirmName: 'Go Talk' }],
      ['DELETE', `/groups/${w.groupId}/icon`, {}],
      ['DELETE', `/groups/${w.groupId}/materials/${material.id}`, {}],
      ['DELETE', `/groups/${w.groupId}/requests/${requests[0].id}/message`, {}],
    ];
    for (const [method, path, body] of routes) {
      for (const bad of [{}, { reason: 'too short' }, { reason: 'x'.repeat(501) }]) {
        expect(await expectJson(await call(method, path, w.admin, { ...body, ...bad }), 400)).toMatchObject(reasonError);
      }
    }
  });
});
