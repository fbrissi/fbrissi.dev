// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import studyGroupApi, { environmentOrigins, type Env } from '@/workers/study-group-api';
import { openD1Sqlite } from '@/workers/local/d1-sqlite';
import type { D1Like } from '@/workers/study-group/repository';

import { migrationsDir } from './study-group/harness';

const workersDir = path.resolve(__dirname, '../../workers');

function limiter(success = true) {
  return { limit: vi.fn(async () => ({ success })) };
}

let production: D1Like;
let env: Env & Record<string, unknown>;

function createEnv(db: D1Like, environment?: string): Env & Record<string, unknown> {
  return {
    STUDY_GROUP_DB: db,
    STUDY_GROUP_ENVIRONMENT: environment,
    STUDY_GROUP_READ_RATE_LIMITER: limiter(),
    STUDY_GROUP_WRITE_RATE_LIMITER: limiter(),
    STUDY_GROUP_LOGIN_RATE_LIMITER: limiter(),
    STUDY_GROUP_JOIN_RATE_LIMITER: limiter(),
    STUDY_GROUP_SESSION_SECRET: 'secret',
    GOOGLE_OAUTH_CLIENT_ID: 'google-client',
    GOOGLE_OAUTH_CLIENT_SECRET: 'google-secret',
    STUDY_GROUP_PLATFORM_ADMIN_EMAILS: 'admin@example.test',
    // Settings the local stack uses; the production Worker must ignore all of them.
    FAKE_IDP_PUBLIC_URL: 'http://localhost:8790',
    FAKE_IDP_INTERNAL_URL: 'http://fake-idp:8790',
    OIDC_ISSUER: 'http://localhost:8790',
    OIDC_AUTHORIZATION_ENDPOINT: 'http://localhost:8790/authorize',
    OIDC_TOKEN_ENDPOINT: 'http://localhost:8790/token',
    OIDC_JWKS_URI: 'http://localhost:8790/jwks',
  };
}

beforeEach(() => {
  production = openD1Sqlite(':memory:', migrationsDir);
  env = createEnv(production, 'production');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Resolves the relative imports reachable from a Worker entry point. */
function importGraph(entry: string, seen = new Set<string>()): Set<string> {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const source = readFileSync(entry, 'utf8');
  for (const [, specifier] of source.matchAll(/from '(\.[^']+)'/g)) {
    importGraph(path.resolve(path.dirname(entry), `${specifier}.ts`), seen);
  }
  return seen;
}

describe('production study group Worker', () => {
  it('always signs in with Google’s fixed endpoints, whatever the environment says (D14)', async () => {
    const response = await studyGroupApi.fetch(new Request('https://fbrissi.dev/api/study-group/auth/login'), env);
    const location = new URL(response.headers.get('Location')!);
    expect(`${location.origin}${location.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location.searchParams.get('client_id')).toBe('google-client');
    expect(location.searchParams.get('redirect_uri')).toBe('https://fbrissi.dev/api/study-group/auth/callback');
  });

  it('has no code path to the local fake IdP', () => {
    const files = [...importGraph(path.join(workersDir, 'study-group-api.ts'))].map((file) => path.relative(workersDir, file));
    expect(files).toContain('study-group/oidc.ts');
    expect(files.some((file) => file.startsWith('local/'))).toBe(false);
    const source = readFileSync(path.join(workersDir, 'study-group-api.ts'), 'utf8');
    expect(source).toMatch(/provider: GOOGLE_OIDC,/);
    expect(source).not.toMatch(/env\.(OIDC|FAKE_IDP)/);
    const config = readFileSync(path.join(workersDir, 'study-group-api/wrangler.toml'), 'utf8');
    expect(config).not.toMatch(/OIDC|FAKE_IDP|8790/);
    expect(config.match(/STUDY_GROUP_ENVIRONMENT = "(\w+)"/g)).toEqual(['STUDY_GROUP_ENVIRONMENT = "production"', 'STUDY_GROUP_ENVIRONMENT = "sandbox"']);
  });

  it('runs the sandbox as its own environment, with its own database, redirect URI and origins (decision 1)', async () => {
    const sandboxDb = openD1Sqlite(':memory:', migrationsDir);
    await sandboxDb.prepare("UPDATE groups SET name = 'Sandbox DevTalk'").run();
    const sandbox = createEnv(sandboxDb, 'sandbox');
    const list = await (await studyGroupApi.fetch(new Request('https://sandbox.fbrissi.dev/api/study-group/groups'), sandbox)).json();
    expect(list.groups[0].name).toBe('Sandbox DevTalk');
    expect((await (await studyGroupApi.fetch(new Request('https://fbrissi.dev/api/study-group/groups'), env)).json()).groups[0].name).toBe('DevTalk');

    const login = await studyGroupApi.fetch(new Request('https://sandbox.fbrissi.dev/api/study-group/auth/login'), sandbox);
    expect(new URL(login.headers.get('Location')!).searchParams.get('redirect_uri')).toBe('https://sandbox.fbrissi.dev/api/study-group/auth/callback');

    const logout = (url: string, origin: string, target: Env) => studyGroupApi.fetch(new Request(url, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' }), target);
    expect((await logout('https://fbrissi.dev/api/study-group/auth/logout', 'https://sandbox.fbrissi.dev', env)).status).toBe(403);
    expect((await logout('https://sandbox.fbrissi.dev/api/study-group/auth/logout', 'https://fbrissi.dev', sandbox)).status).toBe(403);
    expect((await logout('https://sandbox.fbrissi.dev/api/study-group/auth/logout', 'https://sandbox.fbrissi.dev', sandbox)).status).toBe(204);
  });

  it('trusts only each environment’s own origins and defaults to production', () => {
    expect(environmentOrigins({ STUDY_GROUP_ENVIRONMENT: 'sandbox' })).toEqual({ appOrigin: 'https://sandbox.fbrissi.dev', allowedOrigins: ['https://sandbox.fbrissi.dev'] });
    expect(environmentOrigins({})).toEqual({ appOrigin: 'https://fbrissi.dev', allowedOrigins: ['https://fbrissi.dev', 'https://www.fbrissi.dev'] });
  });

  it('binds each Worker only to its own routes and database', async () => {
    const config = readFileSync(path.join(workersDir, 'study-group-api/wrangler.toml'), 'utf8');
    const [production, sandbox] = config.split('\n[env.sandbox]\n');
    expect(production).toContain('database_name = "fbrissi-dev-study-group"');
    expect(production).not.toMatch(/sandbox\.fbrissi\.dev|sandbox-study-group/);
    expect(sandbox).toContain('name = "fbrissi-dev-study-group-api-sandbox"');
    expect(sandbox).toContain('pattern = "sandbox.fbrissi.dev/api/study-group/*"');
    expect(sandbox).toContain('database_name = "fbrissi-dev-sandbox-study-group"');
    expect(sandbox).not.toMatch(/"fbrissi\.dev\/|"www\.|database_name = "fbrissi-dev-study-group"/);
  });

  it('moves sign-in from www to the canonical host', async () => {
    const response = await studyGroupApi.fetch(new Request('https://www.fbrissi.dev/api/study-group/auth/login?returnTo=/study-groups'), env);
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://fbrissi.dev/api/study-group/auth/login?returnTo=/study-groups');
  });

  it('fails sign-in safely when the Google secrets are missing', async () => {
    const rest = { ...env };
    for (const key of ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'STUDY_GROUP_SESSION_SECRET', 'STUDY_GROUP_PLATFORM_ADMIN_EMAILS'] as const) delete rest[key];
    const response = await studyGroupApi.fetch(new Request('https://fbrissi.dev/api/study-group/auth/login'), rest as Env);
    expect(response.headers.get('Location')).toBe('https://fbrissi.dev/study-groups?signin=failed');
  });

  it('maps each rate limit kind to its binding, keyed by IP for visitors', async () => {
    await studyGroupApi.fetch(new Request('https://fbrissi.dev/api/study-group/groups', { headers: { 'CF-Connecting-IP': '198.51.100.7' } }), env);
    expect(env.STUDY_GROUP_READ_RATE_LIMITER.limit).toHaveBeenCalledWith({ key: 'ip:198.51.100.7' });
    await studyGroupApi.fetch(new Request('https://fbrissi.dev/api/study-group/auth/login'), env);
    expect(env.STUDY_GROUP_LOGIN_RATE_LIMITER.limit).toHaveBeenCalled();
    await studyGroupApi.fetch(new Request('https://fbrissi.dev/api/study-group/auth/logout', { method: 'POST', headers: { Origin: 'https://www.fbrissi.dev', 'Content-Type': 'application/json' }, body: '{}' }), env);
    expect(env.STUDY_GROUP_WRITE_RATE_LIMITER.limit).toHaveBeenCalled();

    env.STUDY_GROUP_JOIN_RATE_LIMITER = limiter(false);
    const session = 'token';
    const response = await studyGroupApi.fetch(new Request('https://fbrissi.dev/api/study-group/groups/devtalk/join', {
      method: 'POST', headers: { Origin: 'https://fbrissi.dev', 'Content-Type': 'application/json', Cookie: `__Host-sg_session=${session}` }, body: '{}',
    }), env);
    expect(response.status).toBe(429);
  });

  it('caches the public list with the Cache API when it is available', async () => {
    const store = new Map<string, Response>();
    vi.stubGlobal('caches', { default: { match: async (request: Request) => store.get(request.url), put: async (request: Request, response: Response) => void store.set(request.url, response), delete: async () => true } });
    await studyGroupApi.fetch(new Request('https://fbrissi.dev/api/study-group/groups'), env);
    expect([...store.keys()]).toEqual(['https://fbrissi.dev/api/study-group/groups']);
  });

  it('purges expired data in its database on the daily cron (Q6)', async () => {
    await production.prepare("INSERT INTO moderation_actions (action, target_type, target_id, label, reason, created_at) VALUES ('delete_group', 'group', 'g', 'G', 'Reason text here', '2020-01-01T00:00:00.000Z')").run();
    await studyGroupApi.scheduled({}, env);
    expect(await production.prepare('SELECT COUNT(*) AS count FROM moderation_actions').first()).toEqual({ count: 0 });
  });
});
