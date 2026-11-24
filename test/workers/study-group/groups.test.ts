// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CacheLike } from '@/workers/study-group/oidc';

import { createHarness, createWorld, expectJson, groupInput, request, signIn, type Harness, type World } from './harness';

let h: Harness;
let w: World;

beforeEach(async () => {
  h = await createHarness();
  w = await createWorld(h);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const call = (method: string, path: string, cookie?: string, body?: unknown) => h.handler(request(method, path, { cookie, body }));

describe('groups', () => {
  it('rejects group names that look like links or web addresses, on create and update', async () => {
    const refused = [
      'Visit https://evil.test', 'www.example', 'Join fbrissi.dev now', 'go-talk.com.br', 'HTTP://SHOUT', 'EVIL.COM', 'Join Evil.Dev',
      // Any label.tld, not only common top-level domains, and IDN-style punycode hosts.
      'Meet at chat.example.museum', 'Talk on xn--80ak6aa92e.xn--p1ai', 'Go.Talk', 'my-group.engineering',
      // IP addresses and schemes, with or without slashes.
      'Join 10.0.0.1 now', 'Go 192.168.0.10', 'mailto:me', 'JavaScript:alert(1)', 'ftp://files', 'Use tel:+5511999999999', 'Data:text',
      // A tech name followed by more of a host is still a host.
      'node.js.example', 'asp.net.example',
    ];
    for (const name of refused) {
      await expectJson(await call('POST', '/groups', w.owner, { ...groupInput, name, acceptContentPolicy: true }), 400, { error: "Group names can't contain links or web addresses.", issues: expect.anything() });
      const response = await expectJson(await call('PUT', `/groups/${w.groupId}/settings`, w.owner, { ...groupInput, name }), 400);
      expect(response.error).toBe("Group names can't contain links or web addresses.");
    }
    // Invisible characters and email addresses are refused in the name and the summary.
    await expectJson(await call('PUT', `/groups/${w.groupId}/settings`, w.owner, { ...groupInput, name: 'Go\u202ETalk' }), 400, { error: 'Remove invisible or text-direction characters.', issues: expect.anything() });
    await expectJson(await call('PUT', `/groups/${w.groupId}/settings`, w.owner, { ...groupInput, summary: `${groupInput.summary}\u2066` }), 400, { error: 'Remove invisible or text-direction characters.', issues: expect.anything() });
    await expectJson(await call('PUT', `/groups/${w.groupId}/settings`, w.owner, { ...groupInput, summary: `${groupInput.summary} Write to me@example.com` }), 400, { error: "Don't include an email address.", issues: expect.anything() });
    // Common tech names with a dot, versions, abbreviations and a colon in plain text stay allowed.
    for (const name of ['Node.js Talk', 'NODE.JS Talk', 'Vue.js and Nuxt', 'Next.js & React', 'ASP.NET Core', 'VB.NET legacy', 'ADO.NET', '.NET devs', 'C#/.NET', 'Socket.IO chat', 'Go 1.22 club', 'Python 3.12', 'e.g. English', 'Mr. Smith', 'Go: the basics', 'U.S. devs']) {
      await expectJson(await call('PUT', `/groups/${w.groupId}/settings`, w.owner, { ...groupInput, name }), 200);
    }
  });

  it('lists only listed, non-deleted groups with name and summary, paginated and cacheable (D3)', async () => {
    const response = await call('GET', '/groups');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
    const body = await expectJson(response, 200);
    expect(body.groups).toHaveLength(2);
    expect(body.groups).toEqual(expect.arrayContaining([
      { id: w.groupId, name: 'Go Talk', summary: groupInput.summary, meetingDay: 'Tuesday', meetingStart: '19:00', meetingEnd: '20:00', timezone: 'America/Sao_Paulo', requiresAccessCode: true, iconUrl: null },
      {
        id: 'devtalk', name: 'DevTalk', summary: expect.stringContaining('improve our English'),
        meetingDay: expect.any(String), meetingStart: expect.any(String), meetingEnd: expect.any(String), timezone: expect.any(String), requiresAccessCode: true, iconUrl: null,
      },
    ]));
    expect(body.nextCursor).toBeNull();
    // The schedule is public for listed groups; the meeting link and the access code never are.
    for (const group of body.groups) {
      expect(group).not.toHaveProperty('meetingUrl');
      expect(group).not.toHaveProperty('accessCode');
    }
    expect(JSON.stringify(body)).not.toContain(groupInput.meetingUrl);
    expect(JSON.stringify(body)).not.toContain(w.accessCode);

    for (let index = 0; index < 2; index += 1) {
      const owner = await signIn(h, { email: `owner${index}@example.test`, name: `Owner ${index}` });
      for (let group = 0; group < 3; group += 1) {
        await expectJson(await call('POST', '/groups', owner, { ...groupInput, name: `Group ${index}-${group}`, acceptContentPolicy: true }), 201);
      }
    }
    for (let index = 0; index < 6; index += 1) {
      const owner = await signIn(h, { email: `more${index}@example.test`, name: `More ${index}` });
      for (let group = 0; group < 3; group += 1) await call('POST', '/groups', owner, { ...groupInput, name: `More ${index}-${group}`, acceptContentPolicy: true });
    }
    await call('POST', '/groups', w.admin, { ...groupInput, name: 'Hidden', listed: false, acceptContentPolicy: true });

    const first = await expectJson(await call('GET', '/groups'), 200);
    expect(first.groups).toHaveLength(24);
    const second = await expectJson(await call('GET', `/groups?cursor=${encodeURIComponent(first.nextCursor)}`), 200);
    expect(second.groups).toHaveLength(2);
    expect(new Set([...first.groups, ...second.groups].map((group: { id: string }) => group.id)).size).toBe(26);
    expect(second.nextCursor).toBeNull();
    expect([...first.groups, ...second.groups].some((group: { name: string }) => group.name === 'Hidden')).toBe(false);
    await expectJson(await call('GET', '/groups?cursor=not-a-cursor'), 200);
    const adminFirst = await expectJson(await call('GET', '/admin/groups', w.admin), 200);
    expect(adminFirst.groups).toHaveLength(24);
    const adminSecond = await expectJson(await call('GET', `/admin/groups?cursor=${encodeURIComponent(adminFirst.nextCursor)}`, w.admin), 200);
    expect(adminSecond.groups).toHaveLength(3);
    await expectJson(await call('GET', `/groups?cursor=${btoa('[1]')}`), 200);
  });

  it('serves the public list from the Cache API when one is given', async () => {
    const store = new Map<string, Response>();
    const cache: CacheLike = {
      match: async (key) => store.get(key.url)?.clone(),
      put: async (key, response) => void store.set(key.url, response),
      delete: async (key) => store.delete(key.url),
    };
    const cached = await createHarness({ cache });
    const world = await createWorld(cached);
    const listed = async () => (await (await cached.handler(request('GET', '/groups'))).json()).groups.map((group: { id: string }) => group.id);
    const key = 'https://fbrissi.dev/api/study-group/groups';

    expect(await listed()).toHaveLength(2);
    expect(store.has(key)).toBe(true);
    // Served from the cache while nothing changes.
    await cached.db.prepare('UPDATE groups SET name = name').run();
    expect(store.has(key)).toBe(true);

    // Every change to the list purges it (decision 10): edit/unlist, create, delete, account deletion.
    const mutations: [string, string, string, object][] = [
      ['PUT', `/groups/${world.groupId}/settings`, world.owner, { ...groupInput, listed: false }],
      ['POST', '/groups', world.outsider, { ...groupInput, name: 'New one', acceptContentPolicy: true }],
      ['DELETE', `/groups/${world.groupId}`, world.owner, { confirmName: 'Go Talk' }],
      ['DELETE', '/me', world.outsider, { confirm: true }],
    ];
    for (const [method, path, cookie, body] of mutations) {
      await listed();
      expect(store.has(key)).toBe(true);
      expect((await cached.handler(request(method, path, { cookie, body }))).status).toBeLessThan(300);
      expect(store.has(key)).toBe(false);
    }
    expect(await listed()).toEqual(['devtalk']);
  });

  it('creates groups with a server-generated access code, enforces the content policy and the owner cap (Q12, Q13)', async () => {
    await expectJson(await call('POST', '/groups', w.outsider, { ...groupInput }), 400);
    await expectJson(await call('POST', '/groups', w.outsider, { ...groupInput, name: 'ab', acceptContentPolicy: true }), 400);
    await expectJson(await call('POST', '/groups', w.outsider, { ...groupInput, summary: 'too short', acceptContentPolicy: true }), 400);
    await expectJson(await call('POST', '/groups', w.outsider, { ...groupInput, meetingUrl: 'javascript:alert(1)', acceptContentPolicy: true }), 400);

    const { group } = await expectJson(await call('POST', '/groups', w.outsider, { ...groupInput, meetingUrl: null, acceptContentPolicy: true, accessCode: 'mine' }), 201);
    expect(group.id).toMatch(/^[a-z0-9]{10}$/);
    expect(group.accessCode).toMatch(/^[a-z0-9]{12}$/);
    expect(group).not.toHaveProperty('acceptContentPolicy');
    await call('POST', '/groups', w.outsider, { ...groupInput, acceptContentPolicy: true });
    await call('POST', '/groups', w.outsider, { ...groupInput, acceptContentPolicy: true });
    await expectJson(await call('POST', '/groups', w.outsider, { ...groupInput, acceptContentPolicy: true }), 409, { error: 'You can own at most 3 groups' });
  });

  it('creates open groups by default: anyone signed in asks to join without a code, and the owner still approves', async () => {
    const { group } = await expectJson(await call('POST', '/groups', w.owner, { ...groupInput, requiresAccessCode: undefined, name: 'Open Talk', acceptContentPolicy: true }), 201);
    expect(group.requiresAccessCode).toBe(false);
    expect(group.accessCode).toMatch(/^[a-z0-9]{12}$/);
    expect((await expectJson(await call('GET', `/groups/${group.id}/preview`, w.outsider), 200)).group.requiresAccessCode).toBe(false);
    await expectJson(await call('POST', `/groups/${group.id}/join`, w.outsider, { message: 'Hi!' }), 201, { status: 'pending' });
    // A code sent anyway is ignored, even a wrong one.
    await expectJson(await call('POST', `/groups/${group.id}/join`, w.member, { code: 'wrong-code' }), 201, { status: 'pending' });
    const { requests } = await expectJson(await call('GET', `/groups/${group.id}/requests`, w.owner), 200);
    expect(requests).toHaveLength(2);
    await expectJson(await call('GET', `/groups/${group.id}`, w.outsider), 403, { error: 'Forbidden' });

    // Saving without the field keeps the setting; the owner can turn the code on and off.
    const update = (body: object) => call('PUT', `/groups/${group.id}/settings`, w.owner, { ...groupInput, name: 'Open Talk', ...body });
    expect((await expectJson(await update({ requiresAccessCode: undefined }), 200)).settings).toMatchObject({ requiresAccessCode: false, accessCode: group.accessCode });
    const { settings } = await expectJson(await update({ requiresAccessCode: true }), 200);
    expect(settings.requiresAccessCode).toBe(true);
    expect(settings.accessCode).toMatch(/^[a-z0-9]{12}$/);
    expect(settings.accessCode).not.toBe(group.accessCode);
    expect((await expectJson(await update({ requiresAccessCode: undefined }), 200)).settings).toMatchObject({ requiresAccessCode: true, accessCode: settings.accessCode });
    const listed = (await expectJson(await call('GET', '/groups'), 200)).groups.find((item: { id: string }) => item.id === group.id);
    expect(listed.requiresAccessCode).toBe(true);
    const latecomer = await signIn(h, { email: 'latecomer@example.test', name: 'Lea Latecomer' });
    await expectJson(await call('POST', `/groups/${group.id}/join`, latecomer, {}), 403, { error: 'invalid_code' });
    await expectJson(await call('POST', `/groups/${group.id}/join`, latecomer, { code: group.accessCode }), 403, { error: 'invalid_code' });
    await expectJson(await call('POST', `/groups/${group.id}/join`, latecomer, { code: settings.accessCode }), 201, { status: 'pending' });
    expect((await expectJson(await update({ requiresAccessCode: false }), 200)).settings.requiresAccessCode).toBe(false);
  });

  it('issues a new access code only when the owner turns the requirement back on', async () => {
    const update = (body: object) => call('PUT', `/groups/${w.groupId}/settings`, w.owner, { ...groupInput, ...body });
    // Already on: saving it on again, or editing anything else, keeps the code members were given.
    expect((await expectJson(await update({ requiresAccessCode: true }), 200)).settings).toMatchObject({ requiresAccessCode: true, accessCode: w.accessCode });
    expect((await expectJson(await update({ summary: 'A new summary for the group.' }), 200)).settings).toMatchObject({ requiresAccessCode: true, accessCode: w.accessCode });
    // Off and back on: the code shared before stops working.
    expect((await expectJson(await update({ requiresAccessCode: false }), 200)).settings).toMatchObject({ requiresAccessCode: false, accessCode: w.accessCode });
    const { settings } = await expectJson(await update({ requiresAccessCode: true }), 200);
    expect(settings.accessCode).toMatch(/^[a-z0-9]{12}$/);
    expect(settings.accessCode).not.toBe(w.accessCode);
    expect((await expectJson(await call('GET', `/groups/${w.groupId}/settings`, w.owner), 200)).settings.accessCode).toBe(settings.accessCode);
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode }), 403, { error: 'invalid_code' });
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: settings.accessCode }), 201, { status: 'pending' });
  });

  it('shows the join screen data and handles join requests (D5, Q10)', async () => {
    const outsiderPreview = await expectJson(await call('GET', `/groups/${w.groupId}/preview`, w.outsider), 200, {
      group: { id: w.groupId, name: 'Go Talk', summary: groupInput.summary, meetingDay: 'Tuesday', meetingStart: '19:00', meetingEnd: '20:00', timezone: 'America/Sao_Paulo', requiresAccessCode: true, iconUrl: null },
      membership: 'none',
      canAskAgainAt: null,
    });
    // The join screen shows the schedule, never the meeting link or the access code.
    expect(outsiderPreview.group).not.toHaveProperty('meetingUrl');
    expect(outsiderPreview.group).not.toHaveProperty('accessCode');
    expect(JSON.stringify(outsiderPreview)).not.toContain(groupInput.meetingUrl);
    expect(JSON.stringify(outsiderPreview)).not.toContain(w.accessCode);
    await expectJson(await call('GET', `/groups/${w.groupId}/preview`, w.member), 200, expect.objectContaining({ membership: 'member' }));
    await expectJson(await call('GET', `/groups/${w.groupId}/preview`, w.owner), 200, expect.objectContaining({ membership: 'owner' }));

    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: 'wrong-code' }), 403, { error: 'invalid_code' });
    // A group that requires the code refuses a request without one, or with an empty one.
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, {}), 403, { error: 'invalid_code' });
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: '  ' }), 403, { error: 'invalid_code' });
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode, message: 'x'.repeat(201) }), 400);
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: ` ${w.accessCode} `, message: 'Hi! I am Oscar.' }), 201, { status: 'pending' });
    await expectJson(await call('GET', `/groups/${w.groupId}/preview`, w.outsider), 200, expect.objectContaining({ membership: 'pending' }));
    await expectJson(await call('GET', '/me/groups', w.outsider), 200, { groups: [], pending: [{ id: w.groupId, name: 'Go Talk', summary: groupInput.summary, requestedAt: expect.any(String) }], rejected: [], notices: [] });
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode }), 409, { error: 'You already asked to join this group' });
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.member, { code: w.accessCode }), 409, { error: 'You are already a member of this group' });
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.owner, { code: w.accessCode }), 409);
    await expectJson(await call('GET', `/groups/${w.groupId}`, w.outsider), 403, { error: 'Forbidden' });

    const { requests } = await expectJson(await call('GET', `/groups/${w.groupId}/requests`, w.owner), 200);
    expect(requests).toEqual([{ id: expect.any(Number), displayName: 'Oscar', message: 'Hi! I am Oscar.', createdAt: expect.any(String) }]);
    expect(JSON.stringify(requests)).not.toContain('@');

    expect((await call('POST', `/groups/${w.groupId}/requests/${requests[0].id}/reject`, w.owner)).status).toBe(204);
    await expectJson(await call('POST', `/groups/${w.groupId}/requests/${requests[0].id}/reject`, w.owner), 404);
    await expectJson(await call('POST', `/groups/${w.groupId}/requests/${requests[0].id}/approve`, w.owner), 404);
    // A rejected user can ask again only after a 7-day cooldown, and the wait counts no code attempt.
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: 'wrong' }), 409, {
      error: 'Your request to join this group was not approved. You can ask again after November 23, 2026 at 9:01 AM (Brasília time).',
    });
    // The rejection shows on the group page and in My groups before any code is typed.
    const preview = await expectJson(await call('GET', `/groups/${w.groupId}/preview`, w.outsider), 200);
    expect(preview).toMatchObject({ membership: 'none', canAskAgainAt: expect.stringMatching(/^2026-11-23T12:01:/) });
    const mine = await expectJson(await call('GET', '/me/groups', w.outsider), 200);
    expect(mine).toMatchObject({ pending: [], rejected: [{ id: w.groupId, name: 'Go Talk', canAskAgainAt: preview.canAskAgainAt }] });
    expect((await (await call('GET', `/groups/${w.groupId}/preview`, w.member)).json()).canAskAgainAt).toBeNull();
    h.clock.now += 7 * 86_400_000;
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode }), 201);
    expect((await (await call('GET', '/me/groups', w.outsider)).json()).rejected).toEqual([]);
  });

  it('reports a duplicate request that races the pending check', async () => {
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode }), 201);
    // The pending check misses the row, as if both requests ran at the same time; the unique index still holds.
    const racing = await createHarness({ db: interceptPendingCheck(h.db) });
    await expectJson(await racing.handler(request('POST', `/groups/${w.groupId}/join`, { cookie: w.outsider, body: { code: w.accessCode } })), 409, { error: 'You already asked to join this group' });
  });

  it('surfaces unexpected errors when creating a join request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = h.db;
    const failing = await createHarness({
      db: { prepare: (query) => (query.startsWith('INSERT INTO join_requests') ? { bind: () => ({ run: async () => { throw new Error('disk full'); } }) } as never : db.prepare(query)), batch: (statements) => db.batch(statements) },
    });
    await expectJson(await failing.handler(request('POST', `/groups/${w.groupId}/join`, { cookie: w.outsider, body: { code: w.accessCode } })), 500);
  });

  it('caps pending requests per user and members per group (Q12)', async () => {
    const owners = await Promise.all([0, 1, 2, 3].map((index) => signIn(h, { email: `cap${index}@example.test`, name: `Cap ${index}` })));
    const groups: { id: string; accessCode: string }[] = [];
    for (const owner of owners) {
      for (let index = 0; index < 3; index += 1) {
        groups.push((await (await call('POST', '/groups', owner, { ...groupInput, acceptContentPolicy: true })).json()).group);
      }
    }
    for (const group of groups.slice(0, 10)) await expectJson(await call('POST', `/groups/${group.id}/join`, w.outsider, { code: group.accessCode }), 201, { status: 'pending' });
    await expectJson(await call('POST', `/groups/${groups[10].id}/join`, w.outsider, { code: groups[10].accessCode }), 409, { error: 'You can have at most 10 pending requests' });

    await h.db.prepare(`INSERT INTO users (id, google_sub, email, display_name, created_at, updated_at)
      WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 49) SELECT 'bulkuser' || i, 'bulk' || i, 'bulk' || i || '@example.test', 'Bulk', 'x', 'x' FROM n`).run();
    await h.db.prepare("INSERT INTO group_members (group_id, user_id, joined_at) SELECT ?, id, 'x' FROM users WHERE id LIKE 'bulkuser%'").bind(w.groupId).run();
    const latecomer = await signIn(h, { email: 'late@example.test', name: 'Late' });
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, latecomer, { code: w.accessCode }), 201);
    const { requests } = await (await call('GET', `/groups/${w.groupId}/requests`, w.owner)).json();
    await expectJson(await call('POST', `/groups/${w.groupId}/requests/${requests[0].id}/approve`, w.owner), 409, { error: 'A group can have at most 50 members' });
  });

  it('returns the group to members with the meeting link but never the access code (Q9)', async () => {
    const { group, role } = await expectJson(await call('GET', `/groups/${w.groupId}`, w.member), 200);
    expect(role).toBe('member');
    expect(group).toMatchObject({ name: 'Go Talk', meetingUrl: 'https://meet.example.com/abc', rules: ['Be kind'], moderationMode: 'free', listed: true });
    expect(group).not.toHaveProperty('accessCode');
    expect(group).not.toHaveProperty('ownerId');
    expect((await expectJson(await call('GET', `/groups/${w.groupId}`, w.owner), 200)).role).toBe('owner');
    expect((await expectJson(await call('GET', `/groups/${w.groupId}`, w.admin), 200)).role).toBe('platform_admin');
    await expectJson(await call('GET', '/groups/missing123', w.member), 404, { error: 'Group not found' });
  });

  it('lists members, removes them and lets members leave (3.5, Q16)', async () => {
    const { members } = await expectJson(await call('GET', `/groups/${w.groupId}/members`, w.member), 200);
    expect(members).toEqual([
      { userId: expect.any(String), displayName: 'Olivia', role: 'owner', joinedAt: null },
      { userId: w.memberId, displayName: 'Max', role: 'member', joinedAt: expect.any(String) },
    ]);
    expect(JSON.stringify(members)).not.toContain('@');

    await expectJson(await call('POST', `/groups/${w.groupId}/leave`, w.owner), 409, { error: 'The owner can only delete the group' });
    await expectJson(await call('POST', `/groups/${w.groupId}/leave`, w.admin), 409, { error: 'You are not a member of this group' });
    expect((await call('DELETE', `/groups/${w.groupId}/members/${w.memberId}`, w.owner)).status).toBe(204);
    await expectJson(await call('GET', `/groups/${w.groupId}`, w.member), 403);
    await expectJson(await call('DELETE', `/groups/${w.groupId}/members/${w.memberId}`, w.owner), 404, { error: 'Member not found' });

    await call('POST', `/groups/${w.groupId}/join`, w.member, { code: w.accessCode });
    const { requests } = await (await call('GET', `/groups/${w.groupId}/requests`, w.owner)).json();
    await call('POST', `/groups/${w.groupId}/requests/${requests[0].id}/approve`, w.owner);
    expect((await call('POST', `/groups/${w.groupId}/leave`, w.member)).status).toBe(204);
    await expectJson(await call('GET', `/groups/${w.groupId}/materials`, w.member), 403);
  });

  it('keeps the meeting reminder setting when a save leaves it out, and validates the schedule', async () => {
    const created = await expectJson(await call('POST', '/groups', w.outsider, { ...groupInput, name: 'Quiet Group', meetingReminders: false, acceptContentPolicy: true }), 201);
    expect(created.group).toMatchObject({ meetingReminders: false });
    const path = `/groups/${created.group.id}/settings`;
    const owner = w.outsider;
    expect((await expectJson(await call('PUT', path, owner, { ...groupInput, timezone: 'europe/lisbon' }), 200)).settings).toMatchObject({ meetingReminders: false, timezone: 'Europe/Lisbon' });
    expect((await expectJson(await call('PUT', path, owner, { ...groupInput, meetingReminders: true }), 200)).settings).toMatchObject({ meetingReminders: true });
    expect((await expectJson(await call('PUT', path, owner, { ...groupInput, meetingReminders: false }), 200)).settings).toMatchObject({ meetingReminders: false });
    await expectJson(await call('PUT', path, owner, { ...groupInput, meetingDay: 'Mon' }), 400);
    await expectJson(await call('PUT', path, owner, { ...groupInput, timezone: 'BRT' }), 400);
    expect((await expectJson(await call('GET', `/groups/${w.groupId}`, w.member), 200)).group).toMatchObject({ meetingReminders: true });
  });

  it('updates the settings and rotates the access code without affecting members or pending requests (4.3, Q13)', async () => {
    const settings = await expectJson(await call('GET', `/groups/${w.groupId}/settings`, w.owner), 200);
    expect(settings).toEqual({ settings: expect.objectContaining({ accessCode: w.accessCode, name: 'Go Talk' }), notices: [], role: 'owner' });
    expect(settings.settings).not.toHaveProperty('ownerId');

    const updated = await expectJson(await call('PUT', `/groups/${w.groupId}/settings`, w.owner, { ...groupInput, name: 'Go Talk 2', moderationMode: 'review', listed: false, rules: [] }), 200);
    expect(updated.settings).toMatchObject({ name: 'Go Talk 2', moderationMode: 'review', listed: false, rules: [], accessCode: w.accessCode });
    await expectJson(await call('PUT', `/groups/${w.groupId}/settings`, w.owner, { ...groupInput, moderationMode: 'other' }), 400);
    expect((await (await call('GET', '/groups')).json()).groups.map((group: { id: string }) => group.id)).not.toContain(w.groupId);

    await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode });
    const rotated = await expectJson(await call('POST', `/groups/${w.groupId}/access-code`, w.owner), 200);
    expect(rotated.settings.accessCode).toMatch(/^[a-z0-9]{12}$/);
    expect(rotated.settings.accessCode).not.toBe(w.accessCode);
    expect((await (await call('GET', `/groups/${w.groupId}/requests`, w.owner)).json()).requests).toHaveLength(1);
    await expectJson(await call('GET', `/groups/${w.groupId}`, w.member), 200);

    const stranger = await signIn(h, { email: 'stranger@example.test', name: 'Stranger' });
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, stranger, { code: w.accessCode }), 403, { error: 'invalid_code' });
    await expectJson(await call('POST', `/groups/${w.groupId}/join`, stranger, { code: rotated.settings.accessCode }), 201);
  });

  it('deletes a group after the owner confirms its name (4.5)', async () => {
    await expectJson(await call('DELETE', `/groups/${w.groupId}`, w.owner, { confirmName: 'Wrong' }), 400, { error: 'Type the group name to confirm' });
    expect((await call('DELETE', `/groups/${w.groupId}`, w.owner, { confirmName: 'go talk' })).status).toBe(204);
    await expectJson(await call('GET', `/groups/${w.groupId}`, w.member), 404);
    expect((await (await call('GET', '/groups')).json()).groups.map((group: { id: string }) => group.id)).toEqual(['devtalk']);
    const { results } = await h.db.prepare('SELECT * FROM moderation_actions').all();
    expect(results).toEqual([]);
  });
});

describe('platform admin moderation (D7, 5.x)', () => {
  it('requires a 10 to 500 character reason, logs the deletion and notifies the owner (Q5, Q6)', async () => {
    await expectJson(await call('DELETE', `/groups/${w.groupId}`, w.admin, { confirmName: 'Go Talk' }), 400, { error: 'A reason of 10 to 500 characters is required.' });
    await expectJson(await call('DELETE', `/groups/${w.groupId}`, w.admin, { confirmName: 'Go Talk', reason: 'too short' }), 400);
    await expectJson(await call('DELETE', `/groups/${w.groupId}`, w.admin, { confirmName: 'Go Talk', reason: 'x'.repeat(501) }), 400);
    expect((await call('DELETE', `/groups/${w.groupId}`, w.admin, { confirmName: 'Go Talk', reason: 'Spam and unrelated promotion' })).status).toBe(204);

    const { notices } = await expectJson(await call('GET', '/me/groups', w.owner), 200);
    expect(notices).toEqual([{ id: expect.any(Number), action: 'delete_group', groupId: w.groupId, label: 'Go Talk', reason: 'Spam and unrelated promotion', createdAt: expect.any(String) }]);

    const log = await expectJson(await call('GET', '/admin/moderation-log', w.admin), 200);
    expect(log).toEqual({
      actions: [expect.objectContaining({ action: 'delete_group', targetType: 'group', targetId: w.groupId, actorName: 'Ada', reason: 'Spam and unrelated promotion' })],
      nextCursor: null,
    });
  });

  it('removes join request messages with a reason, admin only', async () => {
    await call('POST', `/groups/${w.groupId}/join`, w.outsider, { code: w.accessCode, message: 'Call me at 555-0100' });
    const { requests } = await (await call('GET', `/groups/${w.groupId}/requests`, w.admin)).json();
    const path = `/groups/${w.groupId}/requests/${requests[0].id}/message`;

    await expectJson(await call('DELETE', path, w.owner, { reason: 'Personal data in the message' }), 403, { error: 'Forbidden' });
    await expectJson(await call('DELETE', path, w.admin, {}), 400);
    await expectJson(await call('DELETE', path, w.admin, { reason: 'short' }), 400);
    expect((await call('DELETE', path, w.admin, { reason: 'Personal data in the message' })).status).toBe(204);
    await expectJson(await call('DELETE', path, w.admin, { reason: 'Personal data in the message' }), 404, { error: 'Join request message not found' });
    await expectJson(await call('DELETE', `/groups/${w.groupId}/requests/999/message`, w.admin, { reason: 'Personal data in the message' }), 404);
    expect((await (await call('GET', `/groups/${w.groupId}/requests`, w.owner)).json()).requests[0].message).toBeNull();

    const { notices } = await (await call('GET', `/groups/${w.groupId}/settings`, w.owner)).json();
    expect(notices).toEqual([expect.objectContaining({ action: 'delete_join_message', label: `Join request #${requests[0].id}` })]);
    const { actions } = await (await call('GET', '/admin/moderation-log', w.admin)).json();
    expect(JSON.stringify(actions)).not.toContain('555-0100');
    expect(JSON.stringify(await h.db.prepare('SELECT * FROM moderation_actions').all())).not.toContain('555-0100');
  });

  it('lists every group and pages the moderation log newest first', async () => {
    await call('PUT', `/groups/${w.groupId}/settings`, w.owner, { ...groupInput, listed: false });
    const { groups } = await expectJson(await call('GET', '/admin/groups', w.admin), 200);
    expect(groups).toHaveLength(2);
    expect(groups).toEqual(expect.arrayContaining([
      { id: w.groupId, name: 'Go Talk', summary: groupInput.summary, ownerName: 'Olivia', listed: false, memberCount: 1, createdAt: expect.any(String) },
      expect.objectContaining({ id: 'devtalk', ownerName: 'Ada' }),
    ]));

    for (let index = 0; index < 51; index += 1) {
      const { material } = await (await call('POST', `/groups/${w.groupId}/materials`, w.owner, { type: 'other', title: `Item ${index}` })).json();
      await call('DELETE', `/groups/${w.groupId}/materials/${material.id}`, w.admin, { reason: `Removing item number ${index}` });
      h.clock.now += 2 * 3_600_000;
    }
    const first = await expectJson(await call('GET', '/admin/moderation-log', w.admin), 200);
    expect(first.actions).toHaveLength(50);
    expect(first.actions[0].label).toBe('Item 50');
    const second = await expectJson(await call('GET', `/admin/moderation-log?cursor=${first.nextCursor}`, w.admin), 200);
    expect(second).toEqual({ actions: [expect.objectContaining({ label: 'Item 0' })], nextCursor: null });
    await expectJson(await call('GET', '/admin/moderation-log?cursor=abc', w.admin), 200);
    await expectJson(await call('GET', '/admin/groups', w.owner), 403);
  });
});

function interceptPendingCheck(db: Harness['db']): Harness['db'] {
  let checked = false;
  return {
    prepare(query: string) {
      const statement = db.prepare(query);
      if (!query.includes("FROM join_requests WHERE group_id = ? AND user_id = ? AND status = 'pending'") || checked) return statement;
      checked = true;
      const wrapped = (inner: ReturnType<typeof db.prepare>): ReturnType<typeof db.prepare> => ({
        bind: (...values: unknown[]) => wrapped(inner.bind(...values)),
        first: async () => null,
        all: () => inner.all(),
        run: () => inner.run(),
      });
      return wrapped(statement);
    },
    batch: (statements) => db.batch(statements),
  };
}
