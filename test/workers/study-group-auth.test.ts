// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { createHmac, pbkdf2Sync } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_TOKEN_TTL_MS,
  createAdminToken,
  timingSafeEqual,
  verifyAdminLogin,
  verifyAdminToken,
  verifyPassword,
} from '@/workers/study-group/auth';

const script = fileURLToPath(new URL('../../scripts/hash-study-group-password.mjs', import.meta.url));
const salt = Buffer.from('0123456789abcdef');

function hash(password: string, iterations = 1000) {
  return `pbkdf2-sha256$${iterations}$${salt.toString('base64')}$${pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64')}`;
}

function signed(payload: unknown, secret = 'secret') {
  const encoded = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${createHmac('sha256', secret).update(encoded).digest('base64url')}`;
}

describe('study group auth', () => {
  it('compares strings without short-circuiting', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true);
    expect(timingSafeEqual('abc', 'abd')).toBe(false);
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('', '')).toBe(true);
  });

  it('verifies PBKDF2 password hashes', async () => {
    expect(await verifyPassword('secret', hash('secret'))).toBe(true);
    expect(await verifyPassword('Secret', hash('secret'))).toBe(false);
  });

  it.each([
    ['an empty hash', ''],
    ['another scheme', hash('secret').replace('pbkdf2-sha256', 'bcrypt')],
    ['extra segments', `${hash('secret')}$x`],
    ['non-integer iterations', hash('secret').replace('$1000$', '$1.5$')],
    ['zero iterations', hash('secret').replace('$1000$', '$0$')],
    ['too many iterations', hash('secret').replace('$1000$', '$100001$')],
    ['invalid base64', hash('secret').replace(salt.toString('base64'), '***')],
    ['an empty salt', hash('secret').replace(salt.toString('base64'), '')],
    ['an empty digest', `${hash('secret').split('$').slice(0, 3).join('$')}$`],
  ])('rejects %s', async (_description, stored) => {
    expect(await verifyPassword('secret', stored)).toBe(false);
  });

  it('checks the admin email case-insensitively together with the password', async () => {
    const admin = { email: ' Admin@Example.test', passwordHash: hash('secret'), sessionSecret: 's' };
    expect(await verifyAdminLogin('admin@example.TEST ', 'secret', admin)).toBe(true);
    expect(await verifyAdminLogin('other@example.test', 'secret', admin)).toBe(false);
    expect(await verifyAdminLogin('admin@example.test', 'nope', admin)).toBe(false);
    expect(await verifyAdminLogin('', 'secret', { ...admin, email: '' })).toBe(false);
    expect(await verifyAdminLogin('', '', undefined)).toBe(false);
  });

  it('creates and verifies expiring admin tokens', async () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const { token, expiresAt } = await createAdminToken('secret', now);
    expect(expiresAt).toBe(new Date(now.getTime() + ADMIN_TOKEN_TTL_MS).toISOString());
    expect(token).toBe(signed({ sub: 'admin', exp: (now.getTime() + ADMIN_TOKEN_TTL_MS) / 1000 }));

    expect(await verifyAdminToken(token, 'secret', now)).toBe(true);
    expect(await verifyAdminToken(token, 'secret', new Date(expiresAt))).toBe(false);
    expect(await verifyAdminToken(token, 'other', now)).toBe(false);
    expect(await verifyAdminToken(token, '', now)).toBe(false);
  });

  it.each([
    ['no signature', 'payload'],
    ['an empty payload', '.signature'],
    ['extra segments', `${signed({ sub: 'admin', exp: 9e9 })}.x`],
    ['a payload that is not JSON', signed('not json')],
    ['another subject', signed({ sub: 'member', exp: 9e9 })],
    ['a non-numeric expiry', signed({ sub: 'admin', exp: '9999999999' })],
  ])('rejects a token with %s', async (_description, token) => {
    expect(await verifyAdminToken(token, 'secret', new Date('2026-01-01T00:00:00.000Z'))).toBe(false);
  });
});

describe('hash-study-group-password script', () => {
  const run = (input: string, args: string[] = []) => spawnSync(process.execPath, [script, ...args], { input, encoding: 'utf8' });

  it('hashes the password read from stdin in the format the worker verifies', async () => {
    const result = run('correct horse\n');
    expect(result.status).toBe(0);
    const stored = result.stdout.trim();
    expect(stored).toMatch(/^pbkdf2-sha256\$10000\$[\w+/=]+\$[\w+/=]+$/);
    expect(await verifyPassword('correct horse', stored)).toBe(true);
    expect(await verifyPassword('correct horse\n', stored)).toBe(false);

    const custom = run('pw', ['--iterations=2000']);
    expect(custom.stdout).toMatch(/^pbkdf2-sha256\$2000\$/);
  });

  it.each([
    ['an empty password', '', [], /password on stdin/],
    ['invalid iterations', 'pw', ['--iterations=0'], /--iterations/],
    ['too many iterations', 'pw', ['--iterations=100001'], /--iterations/],
  ])('fails for %s', (_description, input, args, message) => {
    const result = run(input, args as string[]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(message);
    expect(result.stdout).toBe('');
  });
});
