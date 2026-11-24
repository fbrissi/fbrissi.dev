// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { safeReturnTo } from '@/workers/study-group/auth-routes';
import { POLICY_VERSIONS } from '@/workers/study-group/contract';
import { signValue } from '@/workers/study-group/crypto';

import { authorizeAt, base, cookieValue, createHarness, createWorld, expectJson, request, sessionSecret, signIn, startLogin, type Harness } from './harness';

let h: Harness;

beforeEach(async () => {
  h = await createHarness();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function callback(search: string, flow?: string) {
  return h.handler(request('GET', `${base}/auth/callback${search}`, { cookie: flow ? `__Host-sg_oauth=${flow}` : undefined }));
}

function expectFailure(response: Response) {
  expect(response.status).toBe(302);
  expect(response.headers.get('Location')).toBe('https://fbrissi.dev/study-groups?signin=failed');
  expect(cookieValue(response, '__Host-sg_session')).toBeUndefined();
  expect(cookieValue(response, '__Host-sg_oauth')).toBe('');
}

describe('Google sign-in', () => {
  it('redirects to the provider with PKCE S256, state, nonce and the openid email profile scopes', async () => {
    const login = await h.handler(request('GET', '/auth/login?returnTo=/pt-br/grupos-de-estudo-de-ingles'));
    const location = new URL(login.headers.get('Location')!);

    expect(location.origin + location.pathname).toBe('https://idp.test/authorize');
    expect(Object.fromEntries(location.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'client-id',
      redirect_uri: 'https://fbrissi.dev/api/study-group/auth/callback',
      scope: 'openid email profile',
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    expect(location.searchParams.get('state')).toMatch(/^[\w-]{43}$/);
    expect(location.searchParams.get('nonce')).toMatch(/^[\w-]{43}$/);
    expect(location.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/);
    const cookie = login.headers.getSetCookie()[0];
    expect(cookie).toMatch(/^__Host-sg_oauth=[\w-]+\.[\w-]+; Max-Age=600; Path=\/; HttpOnly; Secure; SameSite=Lax$/);
    expect(login.headers.get('Cache-Control')).toBe('no-store');
    expect(login.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('only returns to program pages', () => {
    expect(safeReturnTo('/study-groups/g/abc123')).toBe('/study-groups/g/abc123');
    expect(safeReturnTo('/pt-br/grupos-de-estudo-de-ingles')).toBe('/pt-br/grupos-de-estudo-de-ingles');
    expect(safeReturnTo('/pt-br/study-groups')).toBe('/study-groups/my');
    expect(safeReturnTo('/pt-br/grupos-de-estudo-de-ingles/x')).toBe('/study-groups/my');
    expect(safeReturnTo('https://evil.test/study-groups')).toBe('/study-groups/my');
    expect(safeReturnTo('//evil.test/study-groups')).toBe('/study-groups/my');
    expect(safeReturnTo('/study-groups/../admin')).toBe('/study-groups/my');
    expect(safeReturnTo(null)).toBe('/study-groups/my');
  });

  it('fails without creating a session when sign-in is not configured', async () => {
    for (const overrides of [{ sessionSecret: '' }, { oidc: { ...h.deps.oidc, clientId: '' } }, { oidc: { ...h.deps.oidc, clientSecret: '' } }]) {
      const unconfigured = await createHarness(overrides);
      expectFailure(await unconfigured.handler(request('GET', '/auth/login')));
    }
  });

  it('signs up a new user only after the explicit acceptance and records the consents', async () => {
    const { flow, params } = await startLogin(h, '/study-groups/g/devtalk');
    const callbackUrl = await authorizeAt(h, params, { sub: 'fake-owner' });
    const response = await callback(callbackUrl.search, flow);

    expect(response.headers.get('Location')).toBe('https://fbrissi.dev/study-groups/welcome');
    expect(cookieValue(response, '__Host-sg_session')).toBeUndefined();
    const signup = cookieValue(response, '__Host-sg_signup')!;
    expect(await h.db.prepare('SELECT COUNT(*) AS count FROM users').first()).toEqual({ count: 0 });

    const cookie = `__Host-sg_signup=${signup}`;
    await expectJson(await h.handler(request('GET', '/auth/signup', { cookie })), 200, { displayName: 'Olivia' });
    await expectJson(await h.handler(request('POST', '/auth/signup', { cookie, body: { acceptTerms: true, acceptPrivacy: true } })), 400);
    await expectJson(await h.handler(request('POST', '/auth/signup', { cookie, body: { acceptTerms: true, acceptPrivacy: true, confirmAge: false } })), 400);
    expect(await h.db.prepare('SELECT COUNT(*) AS count FROM users').first()).toEqual({ count: 0 });

    const created = await h.handler(request('POST', '/auth/signup', { cookie, body: { acceptTerms: true, acceptPrivacy: true, confirmAge: true } }));
    await expectJson(created.clone(), 201, { returnTo: '/study-groups/g/devtalk' });
    expect(cookieValue(created, '__Host-sg_signup')).toBe('');
    const session = cookieValue(created, '__Host-sg_session')!;
    expect(created.headers.getSetCookie()[1]).toBe(`__Host-sg_session=${session}; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`);

    const stored = await h.db.prepare('SELECT token_hash FROM sessions').first<{ token_hash: string }>();
    expect(stored!.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored!.token_hash).not.toContain(session);
    const { results: consents } = await h.db.prepare('SELECT document, version FROM consents ORDER BY document').all();
    expect(consents).toEqual([{ document: 'privacy', version: POLICY_VERSIONS.privacy }, { document: 'terms', version: POLICY_VERSIONS.terms }]);

    const me = await expectJson(await h.handler(request('GET', '/me', { cookie: `__Host-sg_session=${session}` })), 200);
    expect(me.user).toEqual({ id: expect.any(String), displayName: 'Olivia', isPlatformAdmin: false, needsConsent: false, pendingConsents: [] });

    // A second submit of the same pending sign-up reuses the account.
    await expectJson(await h.handler(request('POST', '/auth/signup', { cookie, body: { acceptTerms: true, acceptPrivacy: true, confirmAge: true } })), 201);
    expect(await h.db.prepare('SELECT COUNT(*) AS count FROM users').first()).toEqual({ count: 1 });
  });

  it('keeps nothing when the user declines or the pending sign-up is missing', async () => {
    await expectJson(await h.handler(request('GET', '/auth/signup')), 404, { error: 'No pending sign-up' });
    await expectJson(await h.handler(request('POST', '/auth/signup', { body: { acceptTerms: true, acceptPrivacy: true, confirmAge: true } })), 404);
    const declined = await h.handler(request('POST', '/auth/signup/cancel'));
    expect(declined.status).toBe(204);
    expect(cookieValue(declined, '__Host-sg_signup')).toBe('');
    expect(await h.db.prepare('SELECT COUNT(*) AS count FROM users').first()).toEqual({ count: 0 });
  });

  it('signs in returning users directly and refreshes their email', async () => {
    await signIn(h, { email: 'Someone@Example.test', name: 'Someone' });
    const { flow, params } = await startLogin(h, '/study-groups/new');
    const callbackUrl = await authorizeAt(h, params, { email: 'someone@example.test', name: 'Someone' });
    const response = await callback(callbackUrl.search, flow);
    expect(response.headers.get('Location')).toBe('https://fbrissi.dev/study-groups/new');
    expect(cookieValue(response, '__Host-sg_session')).toBeTruthy();
    expect(cookieValue(response, '__Host-sg_oauth')).toBe('');
  });

  it('uses the full name, then a placeholder, when there is no given name', async () => {
    const providerName = await signIn(h, { email: 'long@example.test', name: 'A very long display name that exceeds forty characters easily' });
    expect((await (await h.handler(request('GET', '/me', { cookie: providerName }))).json()).user.displayName).toBe('A very long display name that exceeds fo');
  });

  it.each([
    ['no flow cookie', async () => ({ search: '?code=x&state=y', flow: undefined })],
    ['a forged flow cookie', async () => ({ search: '?code=x&state=y', flow: 'forged.cookie' })],
    ['a state mismatch', async () => {
      const { flow, params } = await startLogin(h);
      const url = await authorizeAt(h, params, { sub: 'fake-owner' });
      url.searchParams.set('state', 'other');
      return { search: url.search, flow };
    }],
    ['a missing code', async () => {
      const { flow, params } = await startLogin(h);
      return { search: `?state=${params.get('state')}&error=access_denied`, flow };
    }],
    ['an expired flow', async () => {
      const { flow, params } = await startLogin(h);
      const url = await authorizeAt(h, params, { sub: 'fake-owner' });
      h.clock.now += 11 * 60 * 1000;
      return { search: url.search, flow };
    }],
    ['a PKCE mismatch', async () => {
      const { flow, params } = await startLogin(h);
      params.set('code_challenge', 'A'.repeat(43));
      return { search: (await authorizeAt(h, params, { sub: 'fake-owner' })).search, flow };
    }],
    ['a nonce mismatch', async () => {
      const { flow, params } = await startLogin(h);
      params.set('nonce', 'another-nonce');
      return { search: (await authorizeAt(h, params, { sub: 'fake-owner' })).search, flow };
    }],
    ['an unverified email', async () => {
      const { flow, params } = await startLogin(h);
      return { search: (await authorizeAt(h, params, { sub: 'fake-unverified' })).search, flow };
    }],
    ['a reused code', async () => {
      const { flow, params } = await startLogin(h);
      const url = await authorizeAt(h, params, { sub: 'fake-owner' });
      await callback(url.search, flow);
      return { search: url.search, flow };
    }],
  ])('fails generically on %s', async (_name, setup) => {
    const { search, flow } = await setup();
    expectFailure(await callback(search, flow));
    expect(await h.db.prepare('SELECT COUNT(*) AS count FROM sessions').first()).toEqual({ count: 0 });
  });

  it('logs non-Error failures', async () => {
    const failing = await createHarness({ fetch: () => Promise.reject('offline') });
    const { flow, params } = await startLogin(failing);
    const response = await failing.handler(request('GET', `${base}/auth/callback?code=x&state=${params.get('state')}`, { cookie: `__Host-sg_oauth=${flow}` }));
    expectFailure(response);
    expect(console.warn).toHaveBeenCalledWith('Study group sign-in failed:', 'offline');
  });

  it('signs out by deleting the session', async () => {
    const cookie = await signIn(h, { sub: 'fake-owner' });
    const response = await h.handler(request('POST', '/auth/logout', { cookie }));
    expect(response.status).toBe(204);
    expect(cookieValue(response, '__Host-sg_session')).toBe('');
    await expectJson(await h.handler(request('GET', '/me', { cookie })), 200, { user: null });
    expect((await h.handler(request('POST', '/auth/logout'))).status).toBe(204);
  });

  it('expires sessions after 30 days', async () => {
    const cookie = await signIn(h, { sub: 'fake-owner' });
    h.clock.now += 30 * 24 * 60 * 60 * 1000;
    await expectJson(await h.handler(request('GET', '/me', { cookie })), 200, { user: null });
    await expectJson(await h.handler(request('GET', '/me/groups', { cookie })), 401, { error: 'Sign in to continue' });
  });

  it('lets the first platform admin sign-in claim the migrated DevTalk group', async () => {
    const admin = await signIn(h, { sub: 'fake-admin' });
    const { user } = await expectJson(await h.handler(request('GET', '/me', { cookie: admin })), 200);
    expect(user.isPlatformAdmin).toBe(true);
    const { groups } = await expectJson(await h.handler(request('GET', '/me/groups', { cookie: admin })), 200);
    expect(groups).toEqual([expect.objectContaining({ id: 'devtalk', role: 'owner' })]);
  });

  it('accepts a signed sign-up cookie for an existing account', async () => {
    await signIn(h, { sub: 'fake-owner' });
    const cookie = await signValue({ sub: 'fake-owner', email: 'owner@example.test', name: '', returnTo: '/study-groups/my' }, sessionSecret, new Date(h.clock.now + 60_000));
    await expectJson(await h.handler(request('GET', '/auth/signup', { cookie: `__Host-sg_signup=${cookie}` })), 200, { displayName: 'Member' });
  });
});

describe('account', () => {
  it('updates the display name and validates it', async () => {
    const cookie = await signIn(h, { sub: 'fake-owner' });
    await expectJson(await h.handler(request('PATCH', '/me', { cookie, body: { displayName: '  Liv  ' } })), 200);
    expect((await (await h.handler(request('GET', '/me', { cookie }))).json()).user.displayName).toBe('Liv');
    await expectJson(await h.handler(request('PATCH', '/me', { cookie, body: { displayName: 'x'.repeat(41) } })), 400);
    // Invisible or text-direction characters (even a name made only of them) and email addresses are refused.
    for (const displayName of ['\u200B\u200B', 'Liv\u202Eevil', '\u2066Liv\u2069', 'A\u200Fb', 'Li\uFEFFv']) {
      await expectJson(await h.handler(request('PATCH', '/me', { cookie, body: { displayName } })), 400, { error: 'Remove invisible or text-direction characters.', issues: expect.anything() });
    }
    for (const displayName of ['liv@example.com', 'Liv (liv@mail.example.org)']) {
      await expectJson(await h.handler(request('PATCH', '/me', { cookie, body: { displayName } })), 400, { error: "Don't include an email address.", issues: expect.anything() });
    }
    await expectJson(await h.handler(request('PATCH', '/me', { cookie, body: { displayName: 'Liv @ home' } })), 200);
  });

  it('cleans the Google name used as the first display name', async () => {
    for (const [name, expected] of [['Ana\u202E\u200B Silva', 'Ana Silva'], ['ana@example.com', 'Member'], ['\u200B', 'Member']]) {
      const cookie = await signValue({ sub: `fake-${expected}`, email: 'new@example.test', name, returnTo: '/study-groups/my' }, sessionSecret, new Date(h.clock.now + 60_000));
      await expectJson(await h.handler(request('GET', '/auth/signup', { cookie: `__Host-sg_signup=${cookie}` })), 200, { displayName: expected });
    }
  });

  it('asks for re-acceptance after a policy change and blocks writes until then (Q18)', async () => {
    const cookie = await signIn(h, { sub: 'fake-owner' });
    await h.db.prepare("UPDATE consents SET version = '2000-01-01'").run();

    const { user } = await expectJson(await h.handler(request('GET', '/me', { cookie })), 200);
    expect(user.needsConsent).toBe(true);
    await expectJson(await h.handler(request('GET', '/me/groups', { cookie })), 200);
    await expectJson(await h.handler(request('PATCH', '/me', { cookie, body: { displayName: 'Liv' } })), 403, { error: 'consent_required' });

    await expectJson(await h.handler(request('POST', '/me/consents', { cookie, body: { acceptTerms: true } })), 400);
    const accepted = await expectJson(await h.handler(request('POST', '/me/consents', { cookie, body: { acceptTerms: true, acceptPrivacy: true } })), 200);
    expect(accepted.user).toMatchObject({ needsConsent: false, pendingConsents: [] });
    await expectJson(await h.handler(request('PATCH', '/me', { cookie, body: { displayName: 'Liv' } })), 200);
  });

  it('asks again only for the document whose version changed, and records only that one', async () => {
    const cookie = await signIn(h, { sub: 'fake-owner' });
    await h.db.prepare("UPDATE consents SET version = '2000-01-01' WHERE document = 'terms'").run();
    const { user } = await expectJson(await h.handler(request('GET', '/me', { cookie })), 200);
    expect(user).toMatchObject({ needsConsent: true, pendingConsents: ['terms'] });
    await expectJson(await h.handler(request('POST', '/me/consents', { cookie, body: { acceptPrivacy: true } })), 400, { error: 'Accept the updated documents to continue' });
    await expectJson(await h.handler(request('POST', '/me/consents', { cookie, body: { acceptTerms: true } })), 200);
    const { results } = await h.db.prepare('SELECT document, version FROM consents ORDER BY id').all();
    expect(results).toEqual([{ document: 'terms', version: '2000-01-01' }, { document: 'privacy', version: POLICY_VERSIONS.privacy }, { document: 'terms', version: POLICY_VERSIONS.terms }]);
    // Accepting with nothing pending records nothing.
    await expectJson(await h.handler(request('POST', '/me/consents', { cookie, body: {} })), 200, { user: expect.objectContaining({ pendingConsents: [] }) });
    expect((await h.db.prepare('SELECT COUNT(*) AS count FROM consents').first())).toEqual({ count: 3 });
  });

  it('exports the account data as a JSON download', async () => {
    const world = await createWorld(h);
    await h.handler(request('POST', `/groups/${world.groupId}/materials`, { cookie: world.member, body: { type: 'video', title: 'Talk' } }));
    await h.handler(request('POST', `/groups/${world.groupId}/materials`, { cookie: world.owner, body: { type: 'video', title: 'Other talk' } }));
    const { round } = await expectJson(await h.handler(request('POST', `/groups/${world.groupId}/rounds`, { cookie: world.owner, body: { mode: 'vote' } })), 201);
    const { materials } = await (await h.handler(request('GET', `/groups/${world.groupId}/materials`, { cookie: world.member }))).json();
    await h.handler(request('POST', `/groups/${world.groupId}/rounds/${round.id}/votes`, { cookie: world.member, body: { materialId: materials[0].id } }));

    const response = await h.handler(request('GET', '/me/export', { cookie: world.member }));
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="study-groups-data.json"');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    const data = await expectJson(response, 200);
    expect(data.profile).toMatchObject({ email: 'member@example.test', displayName: 'Max' });
    expect(data.consents).toHaveLength(2);
    expect(data.memberships).toEqual([expect.objectContaining({ groupId: world.groupId, groupName: 'Go Talk' })]);
    expect(data.joinRequests).toEqual([expect.objectContaining({ status: 'approved', message: null })]);
    expect(data.suggestions).toEqual([expect.objectContaining({ title: 'Talk', type: 'video' })]);
    expect(data.votes).toEqual([expect.objectContaining({ roundId: round.id, materialId: materials[0].id })]);

    const owner = await expectJson(await h.handler(request('GET', '/me/export', { cookie: world.owner })), 200);
    expect(owner.ownedGroups).toEqual([{ id: world.groupId, name: 'Go Talk', summary: groupSummary, icon: null }]);
  });

  it('deletes the account, its owned groups, and anonymizes contributions elsewhere (Q7, Q8)', async () => {
    const world = await createWorld(h);
    await h.handler(request('POST', `/groups/${world.groupId}/materials`, { cookie: world.member, body: { type: 'video', title: 'Talk' } }));
    await h.handler(request('POST', `/groups/${world.groupId}/materials`, { cookie: world.owner, body: { type: 'video', title: 'Other talk' } }));
    const { round } = await expectJson(await h.handler(request('POST', `/groups/${world.groupId}/rounds`, { cookie: world.owner, body: { mode: 'vote' } })), 201);
    const { materials } = await (await h.handler(request('GET', `/groups/${world.groupId}/materials`, { cookie: world.member }))).json();
    await h.handler(request('POST', `/groups/${world.groupId}/rounds/${round.id}/votes`, { cookie: world.member, body: { materialId: materials[0].id } }));

    await expectJson(await h.handler(request('DELETE', '/me', { cookie: world.member, body: {} })), 400);
    const deleted = await h.handler(request('DELETE', '/me', { cookie: world.member, body: { confirm: true } }));
    expect(deleted.status).toBe(204);
    expect(cookieValue(deleted, '__Host-sg_session')).toBe('');
    await expectJson(await h.handler(request('GET', '/me', { cookie: world.member })), 200, { user: null });

    const list = await expectJson(await h.handler(request('GET', `/groups/${world.groupId}/materials`, { cookie: world.owner })), 200);
    expect(list.materials.find((item: { title: string }) => item.title === 'Talk')).toMatchObject({ suggestedBy: 'Former member', mine: false });
    const current = await expectJson(await h.handler(request('GET', `/groups/${world.groupId}/rounds/current`, { cookie: world.owner })), 200);
    expect(current.tally[0].voters).toEqual(['Former member']);
    await expectJson(await h.handler(request('GET', `/groups/${world.groupId}/members`, { cookie: world.owner })), 200, {
      members: [expect.objectContaining({ displayName: 'Olivia', role: 'owner' })],
    });

    expect((await h.handler(request('DELETE', '/me', { cookie: world.owner, body: { confirm: true } }))).status).toBe(204);
    await expectJson(await h.handler(request('GET', `/groups/${world.groupId}/preview`, { cookie: world.outsider })), 404);
    await expectJson(await h.handler(request('GET', '/groups')), 200, { groups: [expect.objectContaining({ id: 'devtalk' })], nextCursor: null });
  });
});

const groupSummary = 'Weekly English practice about Go and cloud tools.';
