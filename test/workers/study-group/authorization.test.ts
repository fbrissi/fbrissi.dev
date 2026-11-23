// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authorize, isPlatformAdminEmail, parseEmailAllowlist, resolveGroupRole, resolveRole, roles, type Role } from '@/workers/study-group/authorization';
import { routes } from '@/workers/study-group/handler';

import { appOrigin, base, createHarness, createWorld, expectJson, request, type Harness, type World } from './harness';

describe('authorization helpers', () => {
  it('orders roles from visitor to platform admin', () => {
    expect(roles).toEqual(['visitor', 'user', 'member', 'owner', 'platform_admin']);
    expect(authorize('platform_admin', 'owner')).toBe(true);
    expect(authorize('owner', 'platform_admin')).toBe(false);
    expect(authorize('member', 'member')).toBe(true);
    expect(authorize('user', 'member')).toBe(false);
  });

  it('resolves roles outside and inside a group', () => {
    const user = { id: 'u1' };
    expect(resolveRole(null, false)).toBe('visitor');
    expect(resolveRole(user, false)).toBe('user');
    expect(resolveRole(user, true)).toBe('platform_admin');
    expect(resolveGroupRole(null, true, { ownerId: 'u1' }, true)).toBe('visitor');
    expect(resolveGroupRole(user, true, { ownerId: 'u1' }, false)).toBe('owner');
    expect(resolveGroupRole(user, true, { ownerId: 'other' }, true)).toBe('platform_admin');
    expect(resolveGroupRole(user, false, { ownerId: null }, true)).toBe('member');
    expect(resolveGroupRole(user, false, { ownerId: null }, false)).toBe('user');
  });

  it('parses the admin allowlist and matches verified emails case-insensitively', () => {
    const allowlist = parseEmailAllowlist(' Admin@Example.test, ,other@example.test ');
    expect(allowlist).toEqual(['admin@example.test', 'other@example.test']);
    expect(parseEmailAllowlist(undefined)).toEqual([]);
    expect(isPlatformAdminEmail('ADMIN@example.test ', allowlist)).toBe(true);
    expect(isPlatformAdminEmail('nobody@example.test', allowlist)).toBe(false);
  });
});

/** The route x role matrix (D10): every route rejects callers below its minimum role, and lets the others through. */
describe('route x role matrix', () => {
  let h: Harness;
  let w: World;
  const identities: Record<Role, () => string | undefined> = {
    visitor: () => undefined,
    user: () => w.outsider,
    member: () => w.member,
    owner: () => w.owner,
    platform_admin: () => w.admin,
  };
  // Removing a join request message is reserved to the platform admin even inside the admin's own groups.
  const effectiveRole = (path: string, role: Role): Role => (path.endsWith('/message') ? 'platform_admin' : role);

  beforeEach(async () => {
    h = await createHarness();
    w = await createWorld(h);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const cases = routes.flatMap((route) => roles.map((role) => [`${route.method} ${route.path}`, role, route] as const));

  it.each(cases)('%s as %s', async (_name, role, route) => {
    const path = route.path
      .replace(':groupId', () => w.groupId)
      .replace(':userId', () => w.memberId)
      .replace(/:(materialId|roundId|requestId)/, '999');
    const response = await h.handler(request(route.method, path, { cookie: identities[role](), body: {}, contentType: route.imageBody ? 'image/png' : undefined }));
    const body = response.status === 204 || response.status === 302 ? {} : await response.json();
    const required = effectiveRole(route.path, route.role);
    // The platform admin isn't a member of the world's group, so it can manage but not suggest or vote.
    const participationDenied = Boolean(route.participate) && role === 'platform_admin';

    if (authorize(role, required) && !participationDenied) {
      expect(body.error).not.toBe('Sign in to continue');
      expect(body.error).not.toBe('Forbidden');
    } else if (role === 'visitor') {
      expect(response.status).toBe(401);
      expect(body).toEqual({ error: 'Sign in to continue' });
    } else {
      expect(response.status).toBe(403);
      expect(body).toEqual({ error: 'Forbidden' });
    }
  });
});

describe('request handling', () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness();
  });

  it.each([
    ['GET', 'https://fbrissi.dev/api/contact'],
    ['GET', `${base}`],
    ['GET', `${base}/unknown`],
    ['GET', `${base}/groups/AB`],
    ['GET', `${base}/groups/devtalk/materials/abc`],
    ['PATCH', `${base}/groups/devtalk/materials/0`],
    ['GET', `${base}/groups/devtalk/members/x`],
    ['POST', `${base}/groups/devtalk/rounds/1/unknown`],
  ])('returns 404 for %s %s', async (method, url) => {
    await expectJson(await h.handler(request(method, url)), 404, { error: 'Not found' });
  });

  it.each([
    ['DELETE', '/groups'],
    ['PUT', '/me'],
    ['PUT', '/groups/devtalk/requests'],
    ['OPTIONS', '/groups'],
  ])('returns 405 for %s %s', async (method, path) => {
    await expectJson(await h.handler(request(method, path)), 405, { error: 'Method not allowed' });
  });

  it('rejects state-changing requests without an allowed Origin or a JSON body (CSRF)', async () => {
    await expectJson(await h.handler(request('POST', '/auth/logout', { origin: null })), 403, { error: 'Forbidden' });
    await expectJson(await h.handler(request('POST', '/auth/logout', { origin: 'https://evil.test' })), 403);
    await expectJson(await h.handler(request('POST', '/auth/logout', { contentType: 'text/plain' })), 415, { error: 'Use a JSON body' });
    await expectJson(await h.handler(new Request(`${base}/auth/logout`, { method: 'POST', headers: { Origin: appOrigin } })), 415);
    expect((await h.handler(request('POST', '/auth/logout', { origin: appOrigin, contentType: 'application/json; charset=utf-8' }))).status).toBe(204);
  });

  it('sends no CORS headers and keeps responses private', async () => {
    const response = await h.handler(request('GET', '/me', { headers: { Origin: 'https://evil.test' } }));
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(Object.fromEntries(response.headers)).toMatchObject({
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    });
  });

  it('rate limits by user when signed in and by IP otherwise, with strict kinds for sign-in and joining', async () => {
    const rateLimit = vi.fn(async () => true);
    const limited = await createHarness({ rateLimit });
    const w = await createWorld(limited);
    rateLimit.mockClear();

    await limited.handler(request('GET', '/groups', { headers: { 'CF-Connecting-IP': '203.0.113.9' } }));
    await limited.handler(request('GET', '/me'));
    await limited.handler(request('GET', '/me', { cookie: w.member }));
    await limited.handler(request('POST', '/groups', { cookie: w.member }));
    await limited.handler(request('POST', `/groups/${w.groupId}/join`, { cookie: w.outsider, body: { code: 'x' } }));
    await limited.handler(request('GET', '/auth/login'));
    const memberId = w.memberId;
    expect(rateLimit.mock.calls).toEqual([
      ['read', 'ip:203.0.113.9'],
      ['read', 'ip:unknown'],
      ['read', `user:${memberId}`],
      ['write', `user:${memberId}`],
      ['join', expect.stringMatching(/^user:/)],
      ['auth', 'ip:unknown'],
    ]);

    rateLimit.mockResolvedValue(false);
    await expectJson(await limited.handler(request('GET', '/groups')), 429, { error: 'Too many requests' });
  });

  it('defaults to the global fetch, the system clock and crypto randomness', async () => {
    const { createHandler } = await import('@/workers/study-group/handler');
    const fetchMock = vi.fn(async () => new Response('', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const plain = createHandler({ ...h.deps, fetch: undefined, now: undefined, randomInt: undefined });
    const w = await createWorld(h);
    await h.handler(request('POST', `/groups/${w.groupId}/materials`, { cookie: w.owner, body: { type: 'video', title: 'A' } }));

    // Sessions created with the test clock (2026) are still valid against the real clock.
    const drawn = await expectJson(await plain(request('POST', `/groups/${w.groupId}/rounds`, { cookie: w.owner, body: { mode: 'draw' } })), 201);
    expect(drawn.round.status).toBe('closed');

    const login = await plain(request('GET', '/auth/login'));
    const flow = login.headers.getSetCookie()[0].split(';')[0];
    const state = new URL(login.headers.get('Location')!).searchParams.get('state');
    await plain(request('GET', `/auth/callback?code=c&state=${state}`, { cookie: flow }));
    expect(fetchMock).toHaveBeenCalledWith('https://idp.test/token', expect.any(Object));
    vi.unstubAllGlobals();
  });
});
