// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeIdp, defaultUsers, startFakeIdp } from '@/workers/local/fake-idp';
import { sha256, toBase64Url } from '@/workers/study-group/crypto';

const mocks = vi.hoisted(() => ({
  handler: undefined as undefined | ((request: AsyncIterable<Buffer> & { method?: string; url?: string }, response: { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }) => Promise<void>),
  listen: vi.fn(),
}));

vi.mock('node:http', () => {
  const createServer = vi.fn((handler) => {
    mocks.handler = handler;
    return { listen: mocks.listen.mockImplementation((_port, callback) => callback()) };
  });
  return { createServer, default: { createServer } };
});

const options = { issuer: 'http://idp.test', clientId: 'client', clientSecret: 'secret', now: () => Date.UTC(2026, 10, 16) };
const idp = await createFakeIdp(options);
const verifier = 'verifier-verifier-verifier-verifier-verifier';
const challenge = toBase64Url(await sha256(verifier));
const authorizeForm = { client_id: 'client', redirect_uri: 'http://app.test/cb', state: 'st', nonce: 'no', code_challenge: challenge };

async function authorize(extra: Record<string, string>, form: Record<string, string> = authorizeForm) {
  return idp(new Request('http://idp.test/authorize', { method: 'POST', body: new URLSearchParams({ ...form, ...extra }).toString() }));
}

async function token(code: string, extra: Record<string, string> = {}) {
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: 'http://app.test/cb', client_id: 'client', client_secret: 'secret', ...extra });
  return idp(new Request('http://idp.test/token', { method: 'POST', body: body.toString() }));
}

async function codeFor(extra: Record<string, string> = { sub: 'fake-owner' }) {
  return new URL((await authorize(extra)).headers.get('Location')!).searchParams.get('code')!;
}

describe('fake Google IdP (local only)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  it('renders a test user picker for valid authorize requests', async () => {
    const page = await idp(new Request(`http://idp.test/authorize?response_type=code&code_challenge_method=S256&${new URLSearchParams(authorizeForm)}`));
    const html = await page.text();
    expect(page.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    for (const user of defaultUsers) expect(html).toContain(`Sign in as ${user.name} (${user.email})`);
    expect(html).toContain('name="state" value="st"');

    const escaped = await idp(new Request('http://idp.test/authorize?response_type=code&code_challenge_method=S256&state=%22%3E%3Cscript%3E'));
    expect(await escaped.text()).toContain('value="&#34;&#62;&#60;script&#62;"');
    expect((await idp(new Request('http://idp.test/authorize?response_type=token'))).status).toBe(400);
    expect((await idp(new Request('http://idp.test/authorize?response_type=code&code_challenge_method=plain'))).status).toBe(400);
  });

  it('issues a code for a listed or custom user and validates the authorize form', async () => {
    const response = await authorize({ sub: 'fake-owner' });
    const location = new URL(response.headers.get('Location')!);
    expect(location.origin + location.pathname).toBe('http://app.test/cb');
    expect(location.searchParams.get('state')).toBe('st');
    expect(location.searchParams.get('code')).toMatch(/^[a-z0-9]{24}$/);

    expect(await (await authorize({ sub: 'nobody' })).json()).toEqual({ error: 'unknown_user' });
    expect(await (await authorize({ sub: 'fake-owner', client_id: 'other' })).json()).toEqual({ error: 'unauthorized_client' });
    expect(await (await authorize({ sub: 'fake-owner', state: '' })).json()).toEqual({ error: 'invalid_request' });
  });

  it('exchanges the code once, checking PKCE, client and redirect URI, for an RS256 ID token', async () => {
    const body = await (await token(await codeFor({ email: ' New@Example.test ', name: ' New Person ' }))).json();
    expect(body).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'openid email profile' });
    const [header, payload] = body.id_token.split('.').slice(0, 2).map((part: string) => JSON.parse(Buffer.from(part, 'base64url').toString()));
    const { keys } = await (await idp(new Request('http://idp.test/jwks'))).json();
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT', kid: keys[0].kid });
    expect(keys[0]).toMatchObject({ kty: 'RSA', alg: 'RS256', use: 'sig' });
    expect(payload).toMatchObject({ iss: 'http://idp.test', aud: 'client', sub: 'fake-new@example.test', email: 'new@example.test', email_verified: true, name: 'New Person', given_name: 'New Person', nonce: 'no' });

    const anonymous = await (await token(await codeFor({ email: 'x@example.test' }))).json();
    expect(JSON.parse(Buffer.from(anonymous.id_token.split('.')[1], 'base64url').toString()).name).toBe('x@example.test');

    const code = await codeFor();
    await token(code);
    expect(await (await token(code)).json()).toEqual({ error: 'invalid_grant' });
    expect(await (await token(await codeFor(), { grant_type: 'password' })).json()).toEqual({ error: 'invalid_grant' });
    expect((await token(await codeFor(), { client_secret: 'wrong' })).status).toBe(401);
    expect((await token(await codeFor(), { client_id: 'other' })).status).toBe(401);
    expect(await (await token(await codeFor(), { redirect_uri: 'http://evil.test' })).json()).toEqual({ error: 'invalid_grant' });
    expect(await (await token(await codeFor(), { code_verifier: 'wrong' })).json()).toEqual({ error: 'invalid_grant' });
    expect(await (await idp(new Request('http://idp.test/token', { method: 'POST', body: '' }))).json()).toEqual({ error: 'invalid_grant' });
    const withoutVerifier = new URLSearchParams({ grant_type: 'authorization_code', code: await codeFor(), redirect_uri: 'http://app.test/cb', client_id: 'client', client_secret: 'secret' });
    expect(await (await idp(new Request('http://idp.test/token', { method: 'POST', body: withoutVerifier.toString() }))).json()).toEqual({ error: 'invalid_grant' });
  });

  it('expires codes after a minute', async () => {
    let now = Date.UTC(2026, 10, 16);
    const clocked = await createFakeIdp({ ...options, now: () => now });
    const response = await clocked(new Request('http://idp.test/authorize', { method: 'POST', body: new URLSearchParams({ ...authorizeForm, sub: 'fake-owner' }).toString() }));
    const code = new URL(response.headers.get('Location')!).searchParams.get('code')!;
    now += 61_000;
    const body = new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: 'http://app.test/cb', client_id: 'client', client_secret: 'secret' });
    expect(await (await clocked(new Request('http://idp.test/token', { method: 'POST', body: body.toString() }))).json()).toEqual({ error: 'invalid_grant' });
  });

  it('answers 404 elsewhere', async () => {
    expect((await idp(new Request('http://idp.test/other'))).status).toBe(404);
  });

  it('serves the provider over node:http with defaults and overrides', async () => {
    await startFakeIdp({});
    expect(mocks.listen).toHaveBeenCalledWith(8790, expect.any(Function));
    const response = { writeHead: vi.fn(), end: vi.fn() };
    await mocks.handler!({ method: 'GET', url: '/jwks', async *[Symbol.asyncIterator]() {} }, response);
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'content-type': 'application/json' }));
    expect(JSON.parse(response.end.mock.calls[0][0]).keys).toHaveLength(1);

    const post = { writeHead: vi.fn(), end: vi.fn() };
    await mocks.handler!({ method: 'POST', url: '/authorize', async *[Symbol.asyncIterator]() { yield Buffer.from(new URLSearchParams({ ...authorizeForm, client_id: 'local-study-groups', sub: 'fake-admin' }).toString()); } }, post);
    expect(post.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({ location: expect.stringContaining('http://app.test/cb?code=') }));

    await startFakeIdp({ FAKE_IDP_PORT: '9000', FAKE_IDP_PUBLIC_URL: 'http://x', FAKE_IDP_CLIENT_ID: 'a', FAKE_IDP_CLIENT_SECRET: 'b' });
    expect(mocks.listen).toHaveBeenLastCalledWith(9000, expect.any(Function));
  });

  it('starts from the server entry point', async () => {
    vi.resetModules();
    const start = vi.fn();
    vi.doMock('@/workers/local/fake-idp', () => ({ startFakeIdp: start }));
    await import('@/workers/local/fake-idp-server');
    expect(start).toHaveBeenCalled();
    vi.doUnmock('@/workers/local/fake-idp');
  });
});
