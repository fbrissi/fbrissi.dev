import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';

import { createFakeIdp } from '@/workers/local/fake-idp';
import { openD1Sqlite } from '@/workers/local/d1-sqlite';
import { createHandler, type StudyGroupHandlerDeps } from '@/workers/study-group/handler';
import type { D1Like } from '@/workers/study-group/repository';

export const migrationsDir = fileURLToPath(new URL('../../../workers/study-group/migrations', import.meta.url));
export const appOrigin = 'https://fbrissi.dev';
export const base = `${appOrigin}/api/study-group`;
export const issuer = 'https://idp.test';
export const clientId = 'client-id';
export const clientSecret = 'client-secret';
export const sessionSecret = 'test-session-secret';

export type FakeIdp = Awaited<ReturnType<typeof createFakeIdp>>;

export interface Harness {
  db: D1Like;
  idp: FakeIdp;
  clock: { now: number };
  handler: (request: Request) => Promise<Response>;
  deps: StudyGroupHandlerDeps;
}

let sharedIdp: FakeIdp | undefined;
const idpClock = { now: Date.UTC(2026, 10, 16, 12) };

/** The RSA key is generated once per test file; it is the slow part. */
export async function getIdp(): Promise<FakeIdp> {
  sharedIdp ??= await createFakeIdp({ issuer, clientId, clientSecret, now: () => idpClock.now });
  return sharedIdp;
}

export async function createHarness(overrides: Partial<StudyGroupHandlerDeps> = {}): Promise<Harness> {
  const idp = await getIdp();
  const db = openD1Sqlite(':memory:', migrationsDir);
  const clock = idpClock;
  clock.now = Date.UTC(2026, 10, 16, 12);
  const deps: StudyGroupHandlerDeps = {
    db,
    allowedOrigins: [appOrigin],
    appOrigin,
    oidc: {
      provider: { issuers: [issuer], authorizationEndpoint: `${issuer}/authorize`, tokenEndpoint: `${issuer}/token`, jwksUri: `${issuer}/jwks` },
      clientId,
      clientSecret,
    },
    sessionSecret,
    platformAdminEmails: ['admin@example.test'],
    fetch: (input, init) => idp(new Request(input, init)),
    now: () => new Date((clock.now += 1000)),
    randomInt: () => 0,
    ...overrides,
  };
  return { db, idp, clock, handler: createHandler(deps), deps };
}

export function request(method: string, path: string, options: { body?: unknown; cookie?: string; origin?: string | null; contentType?: string | null; headers?: Record<string, string> } = {}): Request {
  const headers: Record<string, string> = { ...options.headers };
  if (options.cookie) headers.Cookie = options.cookie;
  if (method !== 'GET') {
    if (options.origin !== null) headers.Origin = options.origin ?? appOrigin;
    if (options.contentType !== null) headers['Content-Type'] = options.contentType ?? 'application/json';
  }
  const body = method === 'GET' ? undefined : typeof options.body === 'string' ? options.body : JSON.stringify(options.body ?? {});
  return new Request(path.startsWith('http') ? path : `${base}${path}`, { method, headers, body });
}

export function cookieValue(response: Response, name: string): string | undefined {
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(';');
    const index = pair.indexOf('=');
    if (pair.slice(0, index) === name) return pair.slice(index + 1);
  }
  return undefined;
}

export async function expectJson(response: Response, status: number, body?: unknown) {
  expect(response.status).toBe(status);
  const json = await response.json();
  if (body !== undefined) expect(json).toEqual(body);
  return json;
}

/** Starts a sign-in and returns the flow cookie plus the authorize parameters the Worker sent to the IdP. */
export async function startLogin(h: Harness, returnTo = '/study-groups/my') {
  const login = await h.handler(request('GET', `/auth/login?returnTo=${encodeURIComponent(returnTo)}`));
  expect(login.status).toBe(302);
  const location = new URL(login.headers.get('Location')!);
  return { flow: cookieValue(login, '__Host-sg_oauth')!, params: location.searchParams, location };
}

/** Completes the fake IdP step and returns the callback URL with code and state. */
export async function authorizeAt(h: Harness, params: URLSearchParams, user: { sub?: string; email?: string; name?: string }): Promise<URL> {
  const form = new URLSearchParams();
  for (const name of ['client_id', 'redirect_uri', 'state', 'nonce', 'code_challenge']) form.set(name, params.get(name) ?? '');
  for (const [key, value] of Object.entries(user)) form.set(key, value!);
  const response = await h.idp(new Request(`${issuer}/authorize`, { method: 'POST', body: form.toString() }));
  return new URL(response.headers.get('Location')!);
}

/** Full sign-in (and sign-up when new); returns the session cookie header. */
export async function signIn(h: Harness, user: { sub?: string; email?: string; name?: string }): Promise<string> {
  const { flow, params } = await startLogin(h);
  const callbackUrl = await authorizeAt(h, params, user);
  const callback = await h.handler(request('GET', `${base}/auth/callback${callbackUrl.search}`, { cookie: `__Host-sg_oauth=${flow}` }));
  expect(callback.status).toBe(302);
  let session = cookieValue(callback, '__Host-sg_session');
  if (!session) {
    const signup = cookieValue(callback, '__Host-sg_signup')!;
    const created = await h.handler(request('POST', '/auth/signup', { cookie: `__Host-sg_signup=${signup}`, body: { acceptTerms: true, acceptPrivacy: true, confirmAge: true } }));
    expect(created.status).toBe(201);
    session = cookieValue(created, '__Host-sg_session');
  }
  return `__Host-sg_session=${session}`;
}

export const groupInput = {
  name: 'Go Talk',
  summary: 'Weekly English practice about Go and cloud tools.',
  rules: ['Be kind'],
  meetingDay: 'Tuesday',
  meetingStart: '19:00',
  meetingEnd: '20:00',
  timezone: 'America/Sao_Paulo',
  meetingUrl: 'https://meet.example.com/abc',
  moderationMode: 'free' as const,
  listed: true,
};

export interface World {
  owner: string;
  member: string;
  outsider: string;
  admin: string;
  groupId: string;
  accessCode: string;
  memberId: string;
}

/** Owner with a group, an approved member, a signed-in outsider and the platform admin. */
export async function createWorld(h: Harness, input: Partial<typeof groupInput> = {}): Promise<World> {
  const owner = await signIn(h, { sub: 'fake-owner' });
  const member = await signIn(h, { sub: 'fake-member' });
  const outsider = await signIn(h, { sub: 'fake-outsider' });
  const admin = await signIn(h, { sub: 'fake-admin' });
  const { group } = await expectJson(await h.handler(request('POST', '/groups', { cookie: owner, body: { ...groupInput, ...input, acceptContentPolicy: true } })), 201);
  await expectJson(await h.handler(request('POST', `/groups/${group.id}/join`, { cookie: member, body: { code: group.accessCode } })), 201);
  const { requests } = await expectJson(await h.handler(request('GET', `/groups/${group.id}/requests`, { cookie: owner })), 200);
  expect((await h.handler(request('POST', `/groups/${group.id}/requests/${requests[0].id}/approve`, { cookie: owner }))).status).toBe(204);
  const { user } = await (await h.handler(request('GET', '/me', { cookie: member }))).json();
  return { owner, member, outsider, admin, groupId: group.id, accessCode: group.accessCode, memberId: user.id };
}
