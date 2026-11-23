import { expect, test, type Browser, type Page } from '@playwright/test';

import { api, createGroupViaApi, freshUser, groupInput, sessionFor, suggest, users } from './support';

// e2e/features/api-access.feature: the role × route table, CSRF, content types and email exposure, called straight
// from Node (no browser), so each caller sends exactly the cookie and Origin the scenario names.
const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const appOrigin = new URL(baseUrl).origin;
const SESSION = '__Host-sg_session';

interface Call {
  status: number;
  text: string;
}

async function call(cookie: string | null, method: string, path: string, body?: unknown, options: { origin?: string | null; contentType?: string | null } = {}): Promise<Call> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (cookie) headers.Cookie = `${SESSION}=${cookie}`;
  if (method !== 'GET') {
    const origin = options.origin === undefined ? appOrigin : options.origin;
    if (origin) headers.Origin = origin;
    const contentType = options.contentType === undefined ? 'application/json' : options.contentType;
    if (contentType) headers['Content-Type'] = contentType;
  }
  const payload = method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body ?? {});
  const response = await fetch(`${baseUrl}/api/study-group${path}`, { method, headers, body: payload, redirect: 'manual' });
  return { status: response.status, text: await response.text() };
}

async function sessionCookie(page: Page): Promise<string> {
  const cookie = (await page.context().cookies()).find((item) => item.name === SESSION);
  expect(cookie, 'session cookie').toBeTruthy();
  return cookie!.value;
}

const callers = ['a visitor', 'a forged-cookie caller', 'a banned user', 'a signed-in non-member', 'a pending requester', 'a member', 'an owner', 'the platform admin'] as const;
type Caller = (typeof callers)[number];

const profile = { summary: 'A QA group to practice English conversation weekly.', rules: ['Be kind'], meetingDay: 'Monday', meetingStart: '20:00', meetingEnd: '21:00', timezone: 'America/Sao_Paulo', meetingUrl: null, moderationMode: 'free', listed: true };

/**
 * Every route with a request body that is harmless for allowed callers (invalid or a no-op) and the status each caller
 * gets, in the order of `callers`. `null` skips a destructive call for a caller allowed to make it (covered elsewhere).
 */
const table: [string, string, unknown, (number | null)[]][] = [
  ['GET', '/auth/signup', undefined, [404, 404, 404, 404, 404, 404, 404, 404]],
  ['POST', '/auth/signup/cancel', {}, [204, 204, 204, 204, 204, 204, 204, 204]],
  ['GET', '/me', undefined, [200, 200, 200, 200, 200, 200, 200, 200]],
  ['PATCH', '/me', { displayName: '' }, [401, 401, 401, 400, 400, 400, 400, 400]],
  ['DELETE', '/me', { confirm: false }, [401, 401, 401, 400, 400, 400, 400, 400]],
  ['POST', '/me/consents', {}, [401, 401, 401, 200, 200, 200, 200, 200]],
  ['GET', '/me/groups', undefined, [401, 401, 401, 200, 200, 200, 200, 200]],
  ['GET', '/me/export', undefined, [401, 401, 401, 200, 200, 200, 200, 200]],
  ['GET', '/me/notifications', undefined, [401, 401, 401, 200, 200, 200, 200, 200]],
  ['PUT', '/me/notifications', { emailEnabled: true }, [401, 401, 401, 200, 200, 200, 200, 200]],
  ['GET', '/groups', undefined, [200, 200, 200, 200, 200, 200, 200, 200]],
  ['POST', '/groups', { ...profile, name: 'x', acceptContentPolicy: true }, [401, 401, 401, 400, 400, 400, 400, 400]],
  ['GET', '/groups/:groupId/preview', undefined, [401, 401, 401, 200, 200, 200, 200, 200]],
  ['POST', '/groups/:groupId/join', { code: 'wrong-code' }, [401, 401, 401, 403, 409, 409, 409, 403]],
  ['GET', '/groups/:groupId', undefined, [401, 401, 401, 403, 403, 200, 200, 200]],
  ['DELETE', '/groups/:groupId', { confirmName: 'not the name' }, [401, 401, 401, 403, 403, 403, 400, 400]],
  ['GET', '/groups/:groupId/members', undefined, [401, 401, 401, 403, 403, 200, 200, 200]],
  ['DELETE', '/groups/:groupId/members/:userId', {}, [401, 401, 401, 403, 403, 403, null, null]],
  ['POST', '/groups/:groupId/leave', {}, [401, 401, 401, 403, 403, null, null, null]],
  ['GET', '/groups/:groupId/settings', undefined, [401, 401, 401, 403, 403, 403, 200, 200]],
  ['PUT', '/groups/:groupId/settings', { ...profile, name: 'bad', summary: 'short' }, [401, 401, 401, 403, 403, 403, 400, 400]],
  ['POST', '/groups/:groupId/access-code', {}, [401, 401, 401, 403, 403, 403, null, null]],
  ['GET', '/groups/:groupId/requests', undefined, [401, 401, 401, 403, 403, 403, 200, 200]],
  ['POST', '/groups/:groupId/requests/:requestId/approve', {}, [401, 401, 401, 403, 403, 403, null, null]],
  ['POST', '/groups/:groupId/requests/:requestId/reject', {}, [401, 401, 401, 403, 403, 403, null, null]],
  ['DELETE', '/groups/:groupId/requests/:requestId/message', { reason: 'short' }, [401, 401, 401, 403, 403, 403, 403, 400]],
  ['PUT', '/groups/:groupId/icon', 'not an image', [401, 401, 401, 403, 403, 403, 422, 403]],
  ['DELETE', '/groups/:groupId/icon', {}, [401, 401, 401, 403, 403, 403, 404, 404]],
  ['GET', '/groups/:groupId/materials', undefined, [401, 401, 401, 403, 403, 200, 200, 200]],
  ['POST', '/groups/:groupId/materials', { type: 'nope' }, [401, 401, 401, 403, 403, 400, 400, 403]],
  ['PATCH', '/groups/:groupId/materials/:materialId', { status: 'bogus' }, [401, 401, 401, 403, 403, 403, 400, 400]],
  ['DELETE', '/groups/:groupId/materials/:materialId', { reason: 'x' }, [401, 401, 401, 403, 403, 403, 400, 400]],
  ['POST', '/groups/:groupId/materials/:materialId/approve', {}, [401, 401, 401, 403, 403, 403, 404, 404]],
  ['GET', '/groups/:groupId/rounds/current', undefined, [401, 401, 401, 403, 403, 200, 200, 200]],
  ['POST', '/groups/:groupId/rounds', { mode: 'bogus' }, [401, 401, 401, 403, 403, 403, 400, 400]],
  ['POST', '/groups/:groupId/rounds/999999/votes', { materialId: 1 }, [401, 401, 401, 403, 403, 404, 404, 403]],
  ['POST', '/groups/:groupId/rounds/999999/close', {}, [401, 401, 401, 403, 403, 403, 404, 404]],
  ['POST', '/groups/:groupId/rounds/999999/cancel', {}, [401, 401, 401, 403, 403, 403, 404, 404]],
  ['GET', '/admin/groups', undefined, [401, 401, 401, 403, 403, 403, 403, 200]],
  ['GET', '/admin/moderation-log', undefined, [401, 401, 401, 403, 403, 403, 403, 200]],
  ['GET', '/admin/users', undefined, [401, 401, 401, 403, 403, 403, 403, 200]],
  ['POST', '/admin/users/:userId/ban', { reason: 'x' }, [401, 401, 401, 403, 403, 403, 403, 400]],
  ['POST', '/admin/users/:userId/ban/renew', { reason: 'x' }, [401, 401, 401, 403, 403, 403, 403, 400]],
  ['DELETE', '/admin/users/:userId/ban', { reason: 'x' }, [401, 401, 401, 403, 403, 403, 403, 400]]
];

test.describe('API access control', () => {
  test.describe.configure({ mode: 'serial' });

  const people = { owner: freshUser('AclOwner'), member: freshUser('AclMember'), pending: freshUser('AclPending'), user: freshUser('AclUser'), banned: freshUser('AclBanned') };
  const pages: Page[] = [];
  const cookies = {} as Record<Caller, string | null>;
  let groupId = '';
  let memberId = '';
  let requestId = 0;
  let materialId = 0;

  async function open(browser: Browser, user: (typeof people)[keyof typeof people] | typeof users.admin): Promise<Page> {
    const page = await sessionFor(browser, user);
    pages.push(page);
    return page;
  }

  test.beforeAll(async ({ browser }) => {
    const owner = await open(browser, people.owner);
    const member = await open(browser, people.member);
    const pending = await open(browser, people.pending);
    const user = await open(browser, people.user);
    const banned = await open(browser, people.banned);
    const admin = await open(browser, users.admin);
    const group = await createGroupViaApi(owner, groupInput('Access table'));
    groupId = group.id;
    for (const page of [member, banned]) expect((await api(page, 'POST', `/groups/${groupId}/join`, { code: group.accessCode })).status).toBe(201);
    for (const request of (await api<{ requests: { id: number }[] }>(owner, 'GET', `/groups/${groupId}/requests`)).body.requests) {
      expect((await api(owner, 'POST', `/groups/${groupId}/requests/${request.id}/approve`)).status).toBe(204);
    }
    expect((await api(pending, 'POST', `/groups/${groupId}/join`, { code: group.accessCode, message: 'Hello' })).status).toBe(201);
    requestId = (await api<{ requests: { id: number }[] }>(owner, 'GET', `/groups/${groupId}/requests`)).body.requests[0].id;
    memberId = (await api<{ user: { id: string } }>(member, 'GET', '/me')).body.user.id;
    materialId = (await suggest(member, groupId, 'Access table material')).id;
    const bannedId = (await api<{ user: { id: string } }>(banned, 'GET', '/me')).body.user.id;
    const bannedCookie = await sessionCookie(banned);
    expect((await api(admin, 'POST', `/admin/users/${bannedId}/ban`, { reason: 'Access table ban for the role checks' })).status).toBe(204);

    Object.assign(cookies, {
      'a visitor': null,
      'a forged-cookie caller': 'forged-session-token-that-was-never-issued-0000',
      'a banned user': bannedCookie,
      'a signed-in non-member': await sessionCookie(user),
      'a pending requester': await sessionCookie(pending),
      'a member': await sessionCookie(member),
      'an owner': await sessionCookie(owner),
      'the platform admin': await sessionCookie(admin)
    });
  });

  test.afterAll(async () => {
    for (const page of pages) await page.context().close();
  });

  const resolve = (path: string) => path.replace(':groupId', groupId).replace(':userId', memberId).replace(':requestId', String(requestId)).replace(':materialId', String(materialId));

  for (const [index, caller] of callers.entries()) {
    test(`${caller} gets the expected status from every API route`, async () => {
      const mismatches: string[] = [];
      for (const [method, path, body, statuses] of table) {
        const expected = statuses[index];
        if (expected === null) continue;
        const isIcon = path.endsWith('/icon') && method === 'PUT';
        const result = await call(cookies[caller], method, resolve(path), body, isIcon ? { contentType: 'image/png' } : {});
        if (result.status !== expected) mismatches.push(`${method} ${path}: expected ${expected}, got ${result.status} ${result.text.slice(0, 120)}`);
      }
      expect(mismatches).toEqual([]);
    });
  }

  test('state-changing calls with no Origin, a foreign Origin or a null Origin get 403', async () => {
    const member = cookies['a member'];
    for (const origin of [null, 'https://evil.example', 'null', `${appOrigin}.evil.example`]) {
      expect((await call(member, 'PATCH', '/me', { displayName: 'Hijacked' }, { origin })).status, String(origin)).toBe(403);
    }
    expect((await call(cookies['an owner'], 'PUT', `/groups/${groupId}/icon`, 'x', { contentType: 'image/png', origin: 'https://evil.example' })).status).toBe(403);
  });

  test('non-JSON bodies get 415 and malformed JSON gets 400', async () => {
    const member = cookies['a member'];
    const json = JSON.stringify({ displayName: 'Plain' });
    expect((await call(member, 'PATCH', '/me', json, { contentType: 'text/plain' })).status).toBe(415);
    expect((await call(member, 'PATCH', '/me', 'displayName=Form', { contentType: 'application/x-www-form-urlencoded' })).status).toBe(415);
    expect((await call(member, 'PATCH', '/me', json, { contentType: null })).status).toBe(415);
    expect((await call(member, 'PATCH', '/me', '{not json')).status).toBe(400);
    expect((await call(cookies['an owner'], 'PUT', `/groups/${groupId}/icon`, {})).status).toBe(415);
  });

  test('unknown routes get 404, wrong methods 405 and a visitor never learns whether a group exists', async () => {
    const member = cookies['a member'];
    expect((await call(member, 'GET', '/nope')).status).toBe(404);
    expect((await call(member, 'PUT', '/me', {})).status).toBe(405);
    expect((await call(member, 'GET', '/groups/AB!')).status).toBe(404);
    expect((await call(member, 'GET', '/groups/zzzzzzzzzz')).status).toBe(404);
    expect((await call(null, 'GET', '/groups/zzzzzzzzzz')).status).toBe(401);
    expect((await call(null, 'GET', `/groups/${groupId}`)).status).toBe(401);
  });

  test("no API response exposes another user's email address", async () => {
    const reads = ['/me', '/me/groups', '/me/notifications', '/groups', `/groups/${groupId}`, `/groups/${groupId}/preview`, `/groups/${groupId}/members`, `/groups/${groupId}/settings`,
      `/groups/${groupId}/requests`, `/groups/${groupId}/materials`, `/groups/${groupId}/rounds/current`, '/admin/groups', '/admin/moderation-log', '/admin/users',
      `/admin/users?q=${encodeURIComponent(people.member.email)}`];
    const leaks: string[] = [];
    for (const caller of callers) {
      for (const path of reads) {
        const { text } = await call(cookies[caller], 'GET', path);
        for (const person of Object.values(people)) if (text.includes(person.email)) leaks.push(`${caller} ${path}: ${person.email}`);
      }
    }
    expect(leaks).toEqual([]);
    // The admin search matches the exact email but answers with the user ID and name only.
    expect((await call(cookies['the platform admin'], 'GET', `/admin/users?q=${encodeURIComponent(people.member.email)}`)).text).toContain(memberId);
  });

  test('the public groups list is cacheable and holds only id, name and summary', async () => {
    const response = await fetch(`${baseUrl}/api/study-group/groups`);
    expect(response.headers.get('cache-control')).toBe('public, max-age=60');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    const { groups } = (await response.json()) as { groups: Record<string, unknown>[] };
    expect(groups.length).toBeGreaterThan(0);
    for (const group of groups) expect(Object.keys(group).sort()).toEqual(['id', 'name', 'summary']);
  });
});
