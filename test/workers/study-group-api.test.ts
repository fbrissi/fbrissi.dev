// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import studyGroupApi from '@/workers/study-group-api';
import { pbkdf2Sync } from 'node:crypto';
import { STUDY_GROUP_ACCESS_CODE_HEADER } from '@/workers/study-group/contract';
import { createHandler, cryptoRandomInt } from '@/workers/study-group/handler';
import { createRepository, type D1Like, type D1StatementLike } from '@/workers/study-group/repository';
import { openD1Sqlite } from '@/workers/local/d1-sqlite';

const migrationsDir = fileURLToPath(new URL('../../workers/study-group/migrations', import.meta.url));
const base = 'https://fbrissi.dev/api/study-group';
const origins = ['https://fbrissi.dev', 'https://sandbox.fbrissi.dev'];
const MEMBER_CODE = 'member-code-123';
const salt = Buffer.from('fixed-test-salt!');
const admin = {
  email: 'Admin@Example.test',
  passwordHash: `pbkdf2-sha256$1000$${salt.toString('base64')}$${pbkdf2Sync('correct horse', salt, 1000, 32, 'sha256').toString('base64')}`,
  sessionSecret: 'test-session-secret',
};

let db: D1Like;
let clock: number;
let randomInt: ReturnType<typeof vi.fn<(max: number) => number>>;

function handler(overrides: Partial<Parameters<typeof createHandler>[0]> = {}) {
  return createHandler({
    db,
    allowedOrigins: origins,
    now: () => new Date((clock += 1000)),
    randomInt,
    admin,
    ...overrides,
  });
}

function call(method: string, path: string, body?: unknown, h = handler(), headers: Record<string, string> = {}) {
  return h(new Request(`${base}${path}`, {
    method,
    headers: { [STUDY_GROUP_ACCESS_CODE_HEADER]: MEMBER_CODE, ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  }));
}

async function expectJson(response: Response, status: number, body?: unknown) {
  expect(response.status).toBe(status);
  const json = await response.json();
  if (body !== undefined) expect(json).toEqual(body);
  return json;
}

function intercept(target: D1Like, pattern: RegExp, first: () => Promise<unknown>): D1Like {
  const wrap = (query: string, statement: D1StatementLike): D1StatementLike => ({
    bind: (...values) => wrap(query, statement.bind(...values)),
    first: (() => (pattern.test(query) ? first() : statement.first())) as D1StatementLike['first'],
    all: () => statement.all(),
    run: () => statement.run(),
  });
  return { prepare: (query) => wrap(query, target.prepare(query)), batch: (statements) => target.batch(statements) };
}

async function createMaterial(title: string, extra: object = {}) {
  const json = await expectJson(await call('POST', '/materials', { suggestedBy: 'Ada', type: 'article', title, ...extra }), 201);
  return json.material.id as number;
}

beforeEach(async () => {
  db = openD1Sqlite(':memory:', migrationsDir);
  await db.prepare('UPDATE group_info SET access_code = ?').bind(MEMBER_CODE).run();
  clock = Date.UTC(2026, 0, 1);
  randomInt = vi.fn(() => 0);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('study group API handler', () => {
  it('answers preflight requests and sets CORS, cache, and robots headers', async () => {
    const preflight = await call('OPTIONS', '/materials', undefined, handler(), { Origin: 'https://sandbox.fbrissi.dev' });
    expect(preflight.status).toBe(204);
    expect(Object.fromEntries(preflight.headers)).toEqual({
      'access-control-allow-origin': 'https://sandbox.fbrissi.dev',
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers': 'Content-Type, Authorization, X-Study-Group-Code',
      'cache-control': 'no-store',
      vary: 'Origin',
      'x-robots-tag': 'noindex, nofollow',
    });

    const response = await call('GET', '/materials', undefined, handler(), { Origin: 'https://evil.example' });
    expect(response.headers.get('access-control-allow-origin')).toBe('https://fbrissi.dev');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it.each([
    ['GET', 'https://fbrissi.dev/api/contact'],
    ['GET', `${base}`],
    ['GET', `${base}/unknown`],
    ['PATCH', `${base}/materials/abc`],
    ['PATCH', `${base}/materials/0`],
    ['PATCH', `${base}/materials/1/extra`],
    ['POST', `${base}/rounds/1`],
    ['POST', `${base}/rounds/1/unknown`],
    ['POST', `${base}/rounds/1/close/extra`],
    ['GET', `${base}/rounds/current/extra`],
  ])('returns 404 for %s %s', async (method, url) => {
    await expectJson(await handler()(new Request(url, { method })), 404, { error: 'Not found' });
  });

  it.each([
    ['DELETE', '/materials'],
    ['GET', '/materials/1'],
    ['GET', '/rounds'],
    ['POST', '/rounds/current'],
    ['GET', '/rounds/1/votes'],
    ['GET', '/rounds/1/close'],
    ['GET', '/rounds/1/cancel'],
    ['POST', '/group'],
  ])('returns 405 for %s %s', async (method, path) => {
    await expectJson(await call(method, path), 405, { error: 'Method not allowed' });
  });

  it('applies the read and write rate limits', async () => {
    const rateLimit = vi.fn().mockResolvedValue(false);
    await expectJson(await call('GET', '/materials', undefined, handler({ rateLimit })), 429, { error: 'Too many requests' });
    await expectJson(await call('POST', '/materials', {}, handler({ rateLimit })), 429);
    expect(rateLimit.mock.calls.map(([kind]) => kind)).toEqual(['read', 'write']);

    rateLimit.mockResolvedValue(true);
    await expectJson(await call('GET', '/materials', undefined, handler({ rateLimit })), 200, { materials: [] });
  });

  it('returns the seeded group info without a meeting link', async () => {
    const json = await expectJson(await call('GET', '/group'), 200);
    expect(json.group).toMatchObject({
      name: 'DevTalk',
      meetingDay: 'Monday',
      meetingStart: '20:00',
      meetingEnd: '21:00',
      timezone: 'America/Sao_Paulo',
      meetingUrl: null,
    });
    expect(json.group.rules).toHaveLength(5);
    expect(json.group.rules[0]).toBe("Don't speak in Portuguese");
  });

  it('parses stored group rules defensively and exposes the meeting link', async () => {
    const update = (rules: string, url: string | null) =>
      db.prepare('UPDATE group_info SET rules = ?, meeting_url = ?').bind(rules, url).run();

    await update('["One", 2, "Three"]', 'https://meet.example/abc');
    expect((await expectJson(await call('GET', '/group'), 200)).group).toMatchObject({
      rules: ['One', 'Three'],
      meetingUrl: 'https://meet.example/abc',
    });

    await update('{"not":"array"}', '');
    expect((await expectJson(await call('GET', '/group'), 200)).group).toMatchObject({ rules: [], meetingUrl: null });

    await update('not json', null);
    expect((await expectJson(await call('GET', '/group'), 200)).group.rules).toEqual([]);

    await db.prepare('DELETE FROM group_info').run();
    const repository = createRepository(db);
    expect(await repository.getGroupInfo()).toBeNull();
    expect(await repository.getGroupSettings()).toBeNull();
  });

  it('creates, lists, filters, updates, and deletes materials', async () => {
    const first = await expectJson(await call('POST', '/materials', {
      suggestedBy: '  Ada  ',
      type: 'video',
      title: ' Talk ',
      url: 'https://example.com/talk',
      notes: ' Watch it ',
    }), 201);
    expect(first.material).toEqual({
      id: 1,
      suggestedBy: 'Ada',
      type: 'video',
      title: 'Talk',
      url: 'https://example.com/talk',
      notes: 'Watch it',
      status: 'open',
      createdAt: '2026-01-01T00:00:01.000Z',
      discussedAt: null,
    });
    const secondId = await createMaterial('Book', { notes: '   ' });

    const list = await expectJson(await call('GET', '/materials'), 200);
    expect(list.materials.map((material: { id: number }) => material.id)).toEqual([secondId, 1]);
    expect(list.materials[0]).toMatchObject({ url: null, notes: null });

    const discussed = await expectJson(await call('PATCH', '/materials/1', { status: 'discussed' }), 200);
    expect(discussed.material).toMatchObject({ status: 'discussed', discussedAt: '2026-01-01T00:00:03.000Z' });

    expect((await expectJson(await call('GET', '/materials?status=discussed'), 200)).materials).toHaveLength(1);
    expect((await expectJson(await call('GET', '/materials?status=open'), 200)).materials[0].id).toBe(secondId);
    await expectJson(await call('GET', '/materials?status=bogus'), 400);

    const reopened = await expectJson(await call('PATCH', '/materials/1', { status: 'open' }), 200);
    expect(reopened.material).toMatchObject({ status: 'open', discussedAt: null });

    const deleted = await call('DELETE', '/materials/1');
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe('');
    await expectJson(await call('DELETE', '/materials/1'), 404, { error: 'Material not found' });
    await expectJson(await call('PATCH', '/materials/1', { status: 'open' }), 404, { error: 'Material not found' });
  });

  it('validates request bodies', async () => {
    await expectJson(await call('POST', '/materials', '{'), 400, { error: 'Invalid JSON body' });
    const invalid = await expectJson(await call('POST', '/materials', { suggestedBy: 'Ada', type: 'movie', title: 'X', url: 'ftp://x' }), 400);
    expect(invalid.error).toBe('Invalid request');
    expect(invalid.issues.length).toBeGreaterThan(0);
    await expectJson(await call('PATCH', '/materials/1', { status: 'done' }), 400);
    await expectJson(await call('POST', '/rounds', { mode: 'lottery' }), 400);
    await expectJson(await call('POST', '/rounds/1/votes', { materialId: 0, voterName: '' }), 400);
  });

  it('rejects a duplicate URL among open materials only', async () => {
    const url = 'https://example.com/a';
    const id = await createMaterial('A', { url });
    await expectJson(await call('POST', '/materials', { suggestedBy: 'Bob', type: 'article', title: 'Again', url }), 409, {
      error: 'This URL was already suggested',
    });

    await call('PATCH', `/materials/${id}`, { status: 'discussed' });
    await createMaterial('Again', { url });
    await expectJson(await call('PATCH', `/materials/${id}`, { status: 'open' }), 409, {
      error: 'This URL is already open in another suggestion',
    });
  });

  it('returns 500 for unexpected database failures', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = (pattern: RegExp) => handler({ db: intercept(db, pattern, () => Promise.reject(new Error('boom'))) });
    await createMaterial('A');

    await expectJson(await call('POST', '/materials', { suggestedBy: 'A', type: 'book', title: 'B' }, failing(/INSERT INTO materials/)), 500, {
      error: 'Internal server error',
    });
    await expectJson(await call('PATCH', '/materials/1', { status: 'open' }, failing(/UPDATE materials/)), 500);
    await expectJson(await call('POST', '/rounds', { mode: 'vote' }, failing(/INSERT INTO rounds/)), 500);
    const nonError = handler({ db: intercept(db, /INSERT INTO rounds/, () => Promise.reject('offline')) });
    await expectJson(await call('POST', '/rounds', { mode: 'vote' }, nonError), 500);
    expect(consoleError).toHaveBeenCalledWith('Unable to handle study group request:', expect.anything());
  });

  it('reports no current round before any round exists', async () => {
    await expectJson(await call('GET', '/rounds/current'), 200, { round: null, tally: [] });
  });

  it('requires open materials to start a round and allows a single open round', async () => {
    await expectJson(await call('POST', '/rounds', { mode: 'vote' }), 422, { error: 'There are no open materials' });

    await createMaterial('A');
    await expectJson(await call('POST', '/rounds', { mode: 'vote' }), 201);
    await expectJson(await call('POST', '/rounds', { mode: 'draw' }), 409, { error: 'A round is already open' });

    const racing = handler({
      db: intercept(db, /INSERT INTO rounds/, () => Promise.reject(new Error('UNIQUE constraint failed: rounds.status'))),
    });
    await call('POST', '/rounds/1/cancel');
    await expectJson(await call('POST', '/rounds', { mode: 'vote' }, racing), 409, { error: 'A round is already open' });
  });

  it('draws a random open material and closes the round immediately', async () => {
    const a = await createMaterial('A');
    const b = await createMaterial('B');
    await call('PATCH', `/materials/${a}`, { status: 'discussed' });
    await createMaterial('C');
    randomInt.mockReturnValue(1);

    const json = await expectJson(await call('POST', '/rounds', { mode: 'draw' }), 201);
    expect(randomInt).toHaveBeenCalledWith(2);
    expect(json.round).toMatchObject({ mode: 'draw', status: 'closed', winnerMaterialId: 3 });
    expect(json.round.closedAt).toBe(json.round.createdAt);
    expect(json.winner).toMatchObject({ id: 3, title: 'C', status: 'open' });
    expect(json.tally).toEqual([]);
    expect(b).toBe(2);

    expect(await expectJson(await call('GET', '/rounds/current'), 200)).toEqual({ round: json.round, tally: [] });
  });

  it('records votes, replaces a voter previous vote, and closes with the most voted material', async () => {
    const a = await createMaterial('A');
    const b = await createMaterial('B');
    const round = (await expectJson(await call('POST', '/rounds', { mode: 'vote' }), 201)).round;
    expect(round).toMatchObject({ status: 'open', winnerMaterialId: null, closedAt: null });

    await expectJson(await call('POST', `/rounds/${round.id}/votes`, { materialId: a, voterName: ' Ada ' }), 201);
    await expectJson(await call('POST', `/rounds/${round.id}/votes`, { materialId: b, voterName: 'Bob' }), 201);
    const replaced = await expectJson(await call('POST', `/rounds/${round.id}/votes`, { materialId: b, voterName: 'ADA' }), 201);
    expect(replaced.tally).toEqual([{ materialId: b, votes: 2, voters: ['Bob', 'ADA'] }]);
    expect(replaced.winner).toBeNull();

    expect((await expectJson(await call('GET', '/rounds/current'), 200)).tally).toEqual(replaced.tally);

    const closed = await expectJson(await call('POST', `/rounds/${round.id}/close`), 200);
    expect(closed.round).toMatchObject({ status: 'closed', winnerMaterialId: b });
    expect(closed.winner).toMatchObject({ id: b, status: 'open' });
    expect(randomInt).toHaveBeenCalledWith(1);

    await expectJson(await call('POST', `/rounds/${round.id}/votes`, { materialId: a, voterName: 'Cy' }), 422, { error: 'This round is closed' });
    await expectJson(await call('POST', `/rounds/${round.id}/close`), 409, { error: 'This round is already closed' });
    await expectJson(await call('POST', `/rounds/${round.id}/cancel`), 409);
  });

  it('breaks ties randomly and sorts the tally', async () => {
    const a = await createMaterial('A');
    const b = await createMaterial('B');
    const c = await createMaterial('C');
    await call('POST', '/rounds', { mode: 'vote' });
    await call('POST', '/rounds/1/votes', { materialId: b, voterName: 'One' });
    await call('POST', '/rounds/1/votes', { materialId: a, voterName: 'Two' });
    await call('POST', '/rounds/1/votes', { materialId: c, voterName: 'Three' });
    await call('POST', '/rounds/1/votes', { materialId: c, voterName: 'Four' });
    await call('POST', '/rounds/1/votes', { materialId: b, voterName: 'Five' });
    await call('POST', '/rounds/1/votes', { materialId: a, voterName: 'Six' });
    await call('POST', '/rounds/1/votes', { materialId: c, voterName: 'Seven' });
    await call('PATCH', `/materials/${c}`, { status: 'discussed' });
    randomInt.mockReturnValue(1);

    const closed = await expectJson(await call('POST', '/rounds/1/close'), 200);
    expect(closed.tally.map((entry: { materialId: number }) => entry.materialId)).toEqual([c, a, b]);
    expect(randomInt).toHaveBeenCalledWith(2);
    expect(closed.round.winnerMaterialId).toBe(b);
  });

  it('falls back to a random open material created before the round when nobody voted', async () => {
    await createMaterial('A');
    await createMaterial('B');
    await call('POST', '/rounds', { mode: 'vote' });
    await createMaterial('Late');
    randomInt.mockReturnValue(1);

    const closed = await expectJson(await call('POST', '/rounds/1/close'), 200);
    expect(randomInt).toHaveBeenCalledWith(2);
    expect(closed.round.winnerMaterialId).toBe(2);
  });

  it('closes without a winner when no eligible material remains', async () => {
    const a = await createMaterial('A');
    await call('POST', '/rounds', { mode: 'vote' });
    await call('PATCH', `/materials/${a}`, { status: 'discussed' });

    const closed = await expectJson(await call('POST', '/rounds/1/close'), 200);
    expect(closed).toMatchObject({ round: { status: 'closed', winnerMaterialId: null }, winner: null, tally: [] });
  });

  it('cancels an open round without a winner and keeps the latest round current', async () => {
    const a = await createMaterial('A');
    await call('POST', '/rounds', { mode: 'vote' });
    await call('POST', '/rounds/1/votes', { materialId: a, voterName: 'Ada' });

    const cancelled = await expectJson(await call('POST', '/rounds/1/cancel'), 200);
    expect(cancelled.round).toMatchObject({ status: 'closed', winnerMaterialId: null });
    expect(cancelled.tally).toEqual([{ materialId: a, votes: 1, voters: ['Ada'] }]);

    await call('POST', '/rounds', { mode: 'vote' });
    expect((await expectJson(await call('GET', '/rounds/current'), 200)).round).toMatchObject({ id: 2, status: 'open' });
  });

  it('rejects votes for unknown rounds and unavailable materials', async () => {
    const a = await createMaterial('A');
    const b = await createMaterial('B');
    await expectJson(await call('POST', '/rounds/9/votes', { materialId: a, voterName: 'Ada' }), 404, { error: 'Round not found' });
    await expectJson(await call('POST', '/rounds/9/close'), 404, { error: 'Round not found' });

    await call('POST', '/rounds', { mode: 'vote' });
    await expectJson(await call('POST', '/rounds/1/votes', { materialId: 99, voterName: 'Ada' }), 404, { error: 'Material not found' });
    await call('PATCH', `/materials/${b}`, { status: 'discussed' });
    await expectJson(await call('POST', '/rounds/1/votes', { materialId: b, voterName: 'Ada' }), 422, {
      error: 'This material is not open for voting',
    });
  });

  it('detects a round closed concurrently', async () => {
    await createMaterial('A');
    await call('POST', '/rounds', { mode: 'vote' });
    const racing = handler({ db: intercept(db, /UPDATE rounds SET status/, () => Promise.resolve(null)) });

    await expectJson(await call('POST', '/rounds/1/cancel', undefined, racing), 409, { error: 'This round is already closed' });
  });

  it('soft-deletes materials, withdrawing their votes only from open rounds', async () => {
    const a = await createMaterial('A');
    const b = await createMaterial('B');
    await call('POST', '/rounds', { mode: 'vote' });
    await call('POST', '/rounds/1/votes', { materialId: a, voterName: 'Ada' });
    await call('POST', '/rounds/1/close');
    await call('POST', '/rounds', { mode: 'vote' });
    await call('POST', '/rounds/2/votes', { materialId: a, voterName: 'Ada' });
    await call('POST', '/rounds/2/votes', { materialId: b, voterName: 'Bob' });

    expect((await call('DELETE', `/materials/${a}`)).status).toBe(204);

    expect((await expectJson(await call('GET', '/rounds/current'), 200)).tally).toEqual([{ materialId: b, votes: 1, voters: ['Bob'] }]);
    expect((await expectJson(await call('GET', '/materials'), 200)).materials.map((m: { id: number }) => m.id)).toEqual([b]);
    await expectJson(await call('POST', '/rounds/2/votes', { materialId: a, voterName: 'Cy' }), 404, { error: 'Material not found' });
    await expectJson(await call('PATCH', `/materials/${a}`, { status: 'discussed' }), 404);

    const votes = await db.prepare('SELECT round_id FROM votes WHERE material_id = ? ORDER BY round_id').bind(a).all();
    expect(votes.results).toEqual([{ round_id: 1 }]);
    const repository = createRepository(db);
    expect(await repository.getTally(1)).toEqual([]);
    expect((await repository.getRound(1))?.winnerMaterialId).toBe(a);

    await call('POST', '/rounds/2/cancel');
    await call('DELETE', `/materials/${b}`);
    await expectJson(await call('POST', '/rounds', { mode: 'draw' }), 422, { error: 'There are no open materials' });
  });

  it('requires the member access code on every member endpoint', async () => {
    const memberRoutes = [
      ['GET', '/group'], ['GET', '/materials'], ['POST', '/materials'], ['PATCH', '/materials/1'], ['DELETE', '/materials/1'],
      ['GET', '/rounds/current'], ['POST', '/rounds'], ['POST', '/rounds/1/votes'], ['POST', '/rounds/1/close'], ['POST', '/rounds/1/cancel'],
    ];
    for (const [method, path] of memberRoutes) {
      await expectJson(await call(method, path, undefined, handler(), { [STUDY_GROUP_ACCESS_CODE_HEADER]: 'wrong-code' }), 401, {
        error: 'access_code_required',
      });
    }
    await expectJson(await handler()(new Request(`${base}/group`)), 401, { error: 'access_code_required' });

    for (const code of [null, '']) {
      await db.prepare('UPDATE group_info SET access_code = ?').bind(code).run();
      await expectJson(await call('GET', '/group'), 401, { error: 'access_code_required' });
      await expectJson(await handler()(new Request(`${base}/group`)), 401);
    }

    await db.prepare('DELETE FROM group_info').run();
    await expectJson(await call('GET', '/materials'), 401);
  });

  it('uses the system clock and crypto randomness by default', async () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      (array as Uint32Array)[0] = 7;
      return array;
    });
    expect(cryptoRandomInt(5)).toBe(2);

    const defaults = createHandler({ db, allowedOrigins: origins });
    const before = Date.now();
    const material = (await expectJson(await call('POST', '/materials', { suggestedBy: 'A', type: 'other', title: 'T' }, defaults), 201)).material;
    expect(Date.parse(material.createdAt)).toBeGreaterThanOrEqual(before);
    const round = (await expectJson(await call('POST', '/rounds', { mode: 'draw' }, defaults), 201)).round;
    expect(round.winnerMaterialId).toBe(material.id);
  });
});

describe('study group admin API', () => {
  const login = (h = handler(), email = ' ADMIN@example.test ', password = 'correct horse') =>
    h(new Request(`${base}/admin/login`, { method: 'POST', body: JSON.stringify({ email, password }) }));
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function token(h = handler()) {
    return (await expectJson(await login(h), 200)).token as string;
  }

  const settings = {
    name: 'Book Club',
    description: '',
    rules: ['Be kind', 'Read the book'],
    meetingDay: 'Friday',
    meetingStart: '19:00',
    meetingEnd: '20:30',
    timezone: 'Europe/Lisbon',
    meetingUrl: null,
    accessCode: 'new-member-code',
  };

  it('issues a 12 hour token for valid credentials', async () => {
    const json = await expectJson(await login(), 200);
    expect(json.expiresAt).toBe(new Date(Date.UTC(2026, 0, 1) + 1000 + 12 * 60 * 60 * 1000).toISOString());
    expect(json.token).toMatch(/^[\w-]+\.[\w-]+$/);
  });

  it('rejects wrong credentials with the same generic error', async () => {
    await expectJson(await login(handler(), 'admin@example.test', 'wrong'), 401, { error: 'invalid_credentials' });
    await expectJson(await login(handler(), 'other@example.test', 'correct horse'), 401, { error: 'invalid_credentials' });
    await expectJson(await login(handler({ admin: undefined })), 401, { error: 'invalid_credentials' });
    await expectJson(await login(handler({ admin: { ...admin, sessionSecret: '' } })), 401, { error: 'invalid_credentials' });
    await expectJson(await call('POST', '/admin/login', { email: 'not-an-email', password: '' }), 400);
  });

  it('applies the login rate limit', async () => {
    const rateLimit = vi.fn().mockResolvedValue(false);
    await expectJson(await login(handler({ rateLimit })), 429, { error: 'Too many requests' });
    expect(rateLimit).toHaveBeenCalledWith('login', expect.any(Request));
  });

  it('requires a valid, unexpired bearer token on admin endpoints', async () => {
    const valid = await token();
    const unauthorized = { error: 'unauthorized' };
    await expectJson(await call('GET', '/admin/settings'), 401, unauthorized);
    await expectJson(await call('GET', '/admin/settings', undefined, handler(), { Authorization: `Basic ${valid}` }), 401, unauthorized);
    await expectJson(await call('GET', '/admin/settings', undefined, handler(), { Authorization: 'Bearer' }), 401, unauthorized);
    await expectJson(await call('GET', '/admin/settings', undefined, handler(), bearer(`${valid}x`)), 401, unauthorized);
    await expectJson(await call('GET', '/admin/materials/deleted', undefined, handler({ admin: undefined }), bearer(valid)), 401);
    await expectJson(await call('POST', '/admin/materials/1/restore', undefined, handler({ admin: { ...admin, sessionSecret: 'rotated' } }), bearer(valid)), 401);

    clock += 12 * 60 * 60 * 1000;
    await expectJson(await call('GET', '/admin/settings', undefined, handler(), bearer(valid)), 401, unauthorized);
  });

  it('reads and updates the group settings without the member code', async () => {
    const valid = await token();
    await db.prepare('UPDATE group_info SET access_code = NULL').run();
    const noCode = { [STUDY_GROUP_ACCESS_CODE_HEADER]: '', ...bearer(valid) };

    const current = await expectJson(await call('GET', '/admin/settings', undefined, handler(), noCode), 200);
    expect(current.settings).toMatchObject({ name: 'DevTalk', accessCode: null, meetingUrl: null });
    expect(current.settings.rules).toHaveLength(5);

    const updated = await expectJson(await call('PUT', '/admin/settings', { ...settings, meetingUrl: 'https://meet.example/x' }, handler(), noCode), 200);
    expect(updated).toEqual({ settings: { ...settings, meetingUrl: 'https://meet.example/x' } });

    await expectJson(await call('GET', '/group', undefined, handler(), { [STUDY_GROUP_ACCESS_CODE_HEADER]: 'new-member-code' }), 200);
    await expectJson(await call('GET', '/group'), 401);

    await expectJson(await call('PUT', '/admin/settings', { ...settings, meetingStart: '25:00' }, handler(), bearer(valid)), 400);
  });

  it('recreates the settings row when it is missing', async () => {
    const valid = await token();
    await db.prepare('DELETE FROM group_info').run();
    await expectJson(await call('GET', '/admin/settings', undefined, handler(), bearer(valid)), 404, { error: 'Group settings not found' });

    await expectJson(await call('PUT', '/admin/settings', settings, handler(), bearer(valid)), 200, { settings });
    expect((await expectJson(await call('GET', '/group', undefined, handler(), { [STUDY_GROUP_ACCESS_CODE_HEADER]: 'new-member-code' }), 200)).group)
      .toMatchObject({ name: 'Book Club', rules: ['Be kind', 'Read the book'] });
  });

  it('lists and restores deleted materials', async () => {
    const valid = await token();
    const url = 'https://example.com/a';
    const a = await createMaterial('A', { url });
    await createMaterial('B');
    await call('DELETE', `/materials/${a}`);

    const deleted = await expectJson(await call('GET', '/admin/materials/deleted', undefined, handler(), bearer(valid)), 200);
    expect(deleted.materials).toEqual([expect.objectContaining({ id: a, title: 'A', deletedAt: expect.any(String) })]);

    const duplicate = await createMaterial('A again', { url });
    await expectJson(await call('POST', `/admin/materials/${a}/restore`, undefined, handler(), bearer(valid)), 409, {
      error: 'This URL is already open in another suggestion',
    });
    await call('DELETE', `/materials/${duplicate}`);

    const restored = await expectJson(await call('POST', `/admin/materials/${a}/restore`, undefined, handler(), bearer(valid)), 200);
    expect(restored.material).toMatchObject({ id: a, status: 'open' });
    expect(restored.material).not.toHaveProperty('deletedAt');
    await expectJson(await call('POST', `/admin/materials/${a}/restore`, undefined, handler(), bearer(valid)), 404, {
      error: 'Deleted material not found',
    });

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = handler({ db: intercept(db, /deleted_at = NULL/, () => Promise.reject(new Error('boom'))) });
    await expectJson(await call('POST', `/admin/materials/${duplicate}/restore`, undefined, failing, bearer(valid)), 500);
  });

  it.each([
    ['GET', '/admin'],
    ['GET', '/admin/unknown'],
    ['GET', '/admin/login/extra'],
    ['GET', '/admin/materials'],
    ['GET', '/admin/materials/1'],
    ['POST', '/admin/materials/abc/restore'],
    ['POST', '/admin/materials/1/restore/extra'],
  ])('returns 404 for %s %s', async (method, path) => {
    await expectJson(await call(method, path), 404, { error: 'Not found' });
  });

  it.each([
    ['GET', '/admin/login'],
    ['DELETE', '/admin/settings'],
    ['POST', '/admin/materials/deleted'],
    ['GET', '/admin/materials/1/restore'],
  ])('returns 405 for %s %s', async (method, path) => {
    await expectJson(await call(method, path), 405, { error: 'Method not allowed' });
  });
});

describe('study group API worker', () => {
  function createEnv() {
    return {
      STUDY_GROUP_DB: openD1Sqlite(':memory:', migrationsDir),
      STUDY_GROUP_SANDBOX_DB: openD1Sqlite(':memory:', migrationsDir),
      STUDY_GROUP_READ_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
      STUDY_GROUP_WRITE_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
      STUDY_GROUP_LOGIN_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: true }) },
      STUDY_GROUP_ADMIN_EMAIL: admin.email as string | undefined,
      STUDY_GROUP_ADMIN_PASSWORD_HASH: admin.passwordHash as string | undefined,
      STUDY_GROUP_SESSION_SECRET: admin.sessionSecret as string | undefined,
    };
  }

  async function unlock(env: ReturnType<typeof createEnv>) {
    for (const database of [env.STUDY_GROUP_DB, env.STUDY_GROUP_SANDBOX_DB]) {
      await database.prepare('UPDATE group_info SET access_code = ?').bind(MEMBER_CODE).run();
    }
  }

  const member = { [STUDY_GROUP_ACCESS_CODE_HEADER]: MEMBER_CODE };

  it('routes production and sandbox hosts to separate databases', async () => {
    const env = createEnv();
    await unlock(env);
    const body = JSON.stringify({ suggestedBy: 'Ada', type: 'book', title: 'Sandbox only' });
    const created = await studyGroupApi.fetch(new Request('https://sandbox.fbrissi.dev/api/study-group/materials', {
      method: 'POST',
      headers: { ...member, 'CF-Connecting-IP': '203.0.113.1', Origin: 'https://www.fbrissi.dev' },
      body,
    }), env);
    expect(created.status).toBe(201);
    expect(created.headers.get('access-control-allow-origin')).toBe('https://www.fbrissi.dev');
    expect(env.STUDY_GROUP_WRITE_RATE_LIMITER.limit).toHaveBeenCalledWith({ key: '203.0.113.1' });

    const production = await studyGroupApi.fetch(new Request('https://fbrissi.dev/api/study-group/materials', { headers: member }), env);
    expect(await production.json()).toEqual({ materials: [] });
    expect(env.STUDY_GROUP_READ_RATE_LIMITER.limit).toHaveBeenCalledWith({ key: 'unknown' });

    const sandbox = await studyGroupApi.fetch(new Request('https://sandbox.fbrissi.dev/api/study-group/materials', { headers: member }), env);
    expect((await sandbox.json()).materials).toHaveLength(1);
  });

  it('logs the admin in with the worker secrets and the login rate limiter', async () => {
    const request = () => new Request('https://fbrissi.dev/api/study-group/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@example.test', password: 'correct horse' }),
    });
    const env = createEnv();
    expect((await studyGroupApi.fetch(request(), env)).status).toBe(200);
    expect(env.STUDY_GROUP_LOGIN_RATE_LIMITER.limit).toHaveBeenCalledWith({ key: 'unknown' });
    expect(env.STUDY_GROUP_WRITE_RATE_LIMITER.limit).not.toHaveBeenCalled();

    const unconfigured = {
      ...createEnv(),
      STUDY_GROUP_ADMIN_EMAIL: undefined,
      STUDY_GROUP_ADMIN_PASSWORD_HASH: undefined,
      STUDY_GROUP_SESSION_SECRET: undefined,
    };
    expect((await studyGroupApi.fetch(request(), unconfigured)).status).toBe(401);
  });

  it('rejects requests over the rate limit', async () => {
    const env = createEnv();
    env.STUDY_GROUP_WRITE_RATE_LIMITER.limit.mockResolvedValue({ success: false });

    const response = await studyGroupApi.fetch(new Request('https://fbrissi.dev/api/study-group/rounds', { method: 'POST' }), env);
    expect(response.status).toBe(429);
  });
});
