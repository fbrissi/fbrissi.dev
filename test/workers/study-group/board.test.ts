// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createHarness, createWorld, expectJson, request, type Harness, type World } from './harness';

let h: Harness;
let w: World;
let pick: ReturnType<typeof vi.fn<(max: number) => number>>;

beforeEach(async () => {
  pick = vi.fn(() => 0);
  h = await createHarness({ randomInt: pick });
  w = await createWorld(h);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const call = (method: string, path: string, cookie?: string, body?: unknown) => h.handler(request(method, `/groups/${w.groupId}${path}`, { cookie, body }));

async function suggest(cookie: string, title: string, extra: object = {}) {
  return (await expectJson(await call('POST', '/materials', cookie, { type: 'article', title, ...extra }), 201)).material;
}

describe('materials', () => {
  it('ties suggestions to the signed-in user and validates them', async () => {
    const material = await suggest(w.member, 'Clean code', { url: 'https://example.com/a', notes: '  Read part one  ' });
    expect(material).toEqual({
      id: expect.any(Number), suggestedBy: 'Max', mine: true, type: 'article', title: 'Clean code', url: 'https://example.com/a',
      notes: 'Read part one', status: 'open', createdAt: expect.any(String), discussedAt: null,
    });
    await expectJson(await call('POST', '/materials', w.member, { type: 'article', title: 'x', url: 'ftp://example.com' }), 400);
    await expectJson(await call('POST', '/materials', w.member, { type: 'meme', title: 'x' }), 400);
    await expectJson(await call('POST', '/materials', w.member, '{not json'), 400, { error: 'Invalid JSON body' });
    await expectJson(await call('POST', '/materials', w.owner, { type: 'video', title: 'Again', url: 'https://example.com/a' }), 409, { error: 'This URL was already suggested' });

    const list = await expectJson(await call('GET', '/materials', w.owner), 200);
    expect(list.materials).toEqual([expect.objectContaining({ id: material.id, mine: false, suggestedBy: 'Max' })]);
    await expectJson(await call('GET', '/materials?status=open', w.member), 200, { materials: [expect.objectContaining({ id: material.id })] });
    await expectJson(await call('GET', '/materials?status=discussed', w.member), 200, { materials: [] });
    await expectJson(await call('GET', '/materials?status=bogus', w.member), 400);
  });

  it('caps suggestions at 20 per user per group per day (Q12)', async () => {
    for (let index = 0; index < 20; index += 1) await suggest(w.member, `Item ${index}`);
    await expectJson(await call('POST', '/materials', w.member, { type: 'article', title: 'One more' }), 429, { error: 'You can suggest at most 20 materials per day in a group' });
    h.clock.now += 24 * 60 * 60 * 1000;
    await suggest(w.member, 'Next day');
  });

  it('keeps members’ suggestions pending in review mode; the owner’s skip review (4.2, Q15)', async () => {
    await call('PUT', '/settings', w.owner, { name: 'Go Talk', summary: 'Weekly English practice about Go and cloud tools.', rules: [], meetingDay: 'Mon', meetingStart: '20:00', meetingEnd: '21:00', timezone: 'UTC', meetingUrl: null, moderationMode: 'review', listed: true });
    const pending = await suggest(w.member, 'Pending talk', { url: 'https://example.com/p' });
    expect(pending.status).toBe('pending');
    expect((await suggest(w.owner, 'Owner talk')).status).toBe('open');
    await expectJson(await call('POST', '/materials', w.owner, { type: 'video', title: 'Dup', url: 'https://example.com/p' }), 409);

    // Another member doesn't see it; the author and the owner do.
    const second = await (await import('./harness')).signIn(h, { email: 'second@example.test', name: 'Second' });
    await call('POST', '/join', second, { code: w.accessCode });
    const { requests } = await (await call('GET', '/requests', w.owner)).json();
    await call('POST', `/requests/${requests[0].id}/approve`, w.owner);
    const titles = async (cookie: string) => (await (await call('GET', '/materials', cookie)).json()).materials.map((item: { title: string }) => item.title);
    expect(await titles(second)).not.toContain('Pending talk');
    expect(await titles(w.member)).toContain('Pending talk');
    expect(await titles(w.owner)).toContain('Pending talk');

    // Pending items can't be voted on, drawn or marked discussed.
    await expectJson(await call('PATCH', `/materials/${pending.id}`, w.owner, { status: 'discussed' }), 404);
    await expectJson(await call('POST', `/materials/${pending.id}/approve`, w.member), 403);
    const approved = await expectJson(await call('POST', `/materials/${pending.id}/approve`, w.owner), 200);
    expect(approved.material.status).toBe('open');
    await expectJson(await call('POST', `/materials/${pending.id}/approve`, w.owner), 404, { error: 'Pending material not found' });
  });

  it('lets a platform admin outside the group manage it but not suggest or vote (decision 3)', async () => {
    await expectJson(await call('POST', '/materials', w.admin, { type: 'article', title: 'Admin talk' }), 403, { error: 'Forbidden' });
    await suggest(w.member, 'A');
    await suggest(w.member, 'B');
    const { round } = await expectJson(await call('POST', '/rounds', w.admin, { mode: 'vote' }), 201);
    const { materials } = await (await call('GET', '/materials', w.admin)).json();
    await expectJson(await call('POST', `/rounds/${round.id}/votes`, w.admin, { materialId: materials[0].id }), 403, { error: 'Forbidden' });
    expect((await expectJson(await call('GET', '', w.admin), 200)).canParticipate).toBe(false);
    expect((await expectJson(await call('GET', '', w.member), 200)).canParticipate).toBe(true);
    expect((await expectJson(await call('GET', '', w.owner), 200)).canParticipate).toBe(true);

    // As a member, the admin participates like anyone else.
    await call('POST', '/join', w.admin, { code: w.accessCode });
    const { requests } = await (await call('GET', '/requests', w.owner)).json();
    await call('POST', `/requests/${requests[0].id}/approve`, w.owner);
    await expectJson(await call('POST', '/materials', w.admin, { type: 'article', title: 'Admin talk' }), 201);
    await expectJson(await call('POST', `/rounds/${round.id}/votes`, w.admin, { materialId: materials[0].id }), 201);
  });

  it('lets only the owner mark and delete materials, and deletes them permanently (D6)', async () => {
    const material = await suggest(w.member, 'Talk', { url: 'https://example.com/t' });
    await expectJson(await call('PATCH', `/materials/${material.id}`, w.member, { status: 'discussed' }), 403);
    await expectJson(await call('DELETE', `/materials/${material.id}`, w.member), 403);

    const discussed = await expectJson(await call('PATCH', `/materials/${material.id}`, w.owner, { status: 'discussed' }), 200);
    expect(discussed.material).toMatchObject({ status: 'discussed', discussedAt: expect.any(String) });
    await expectJson(await call('PATCH', `/materials/${material.id}`, w.owner, { status: 'pending' }), 400);
    await expectJson(await call('PATCH', '/materials/999', w.owner, { status: 'open' }), 404, { error: 'Material not found' });

    await suggest(w.member, 'Same link', { url: 'https://example.com/t' });
    await expectJson(await call('PATCH', `/materials/${material.id}`, w.owner, { status: 'open' }), 409, { error: 'This URL is already open in another suggestion' });

    const { round } = await expectJson(await call('POST', '/rounds', w.owner, { mode: 'draw' }), 201);
    expect((await call('DELETE', `/materials/${material.id}`, w.owner)).status).toBe(204);
    await expectJson(await call('DELETE', `/materials/${material.id}`, w.owner), 404);
    expect(await h.db.prepare('SELECT COUNT(*) AS count FROM materials WHERE id = ?').bind(material.id).first()).toEqual({ count: 0 });
    await expectJson(await call('GET', '/materials/deleted', w.owner), 404);
    await expectJson(await call('POST', `/materials/${material.id}/restore`, w.owner), 404);
    // A round it won keeps no winner; nothing of the suggestion is left.
    expect((await call('DELETE', `/materials/${round.winnerMaterialId}`, w.owner)).status).toBe(204);
    expect(await h.db.prepare('SELECT winner_material_id FROM rounds WHERE id = ?').bind(round.id).first()).toEqual({ winner_material_id: null });
    // Its URL can be suggested again right away.
    await suggest(w.member, 'Again', { url: 'https://example.com/t' });
  });

  it('logs admin deletions with the reason and shows them to the owner, even after the material is gone (Q6)', async () => {
    const material = await suggest(w.member, 'Spam link');
    await expectJson(await call('DELETE', `/materials/${material.id}`, w.admin, {}), 400);
    expect((await call('DELETE', `/materials/${material.id}`, w.admin, { reason: 'Unrelated self-promotion' })).status).toBe(204);
    const { notices } = await (await call('GET', '/settings', w.owner)).json();
    expect(notices).toEqual([expect.objectContaining({ action: 'delete_material', label: 'Spam link', reason: 'Unrelated self-promotion' })]);
    const { actions } = await (await h.handler(request('GET', '/admin/moderation-log', { cookie: w.admin }))).json();
    expect(actions[0]).toMatchObject({ action: 'delete_material', targetType: 'material', targetId: String(material.id), label: 'Spam link', actorName: 'Ada' });
    expect(JSON.stringify(actions)).not.toContain('restore');
  });
});

describe('rounds and votes', () => {
  it('allows only the owner to run rounds and needs open materials', async () => {
    await expectJson(await call('POST', '/rounds', w.owner, { mode: 'draw' }), 422, { error: 'There are no open materials' });
    await expectJson(await call('POST', '/rounds', w.member, { mode: 'draw' }), 403);
    await expectJson(await call('POST', '/rounds', w.owner, { mode: 'lottery' }), 400);
    await expectJson(await call('GET', '/rounds/current', w.member), 200, { round: null, tally: [], myVote: null });
  });

  it('needs at least 2 open materials for a vote (decision 11)', async () => {
    await suggest(w.member, 'Only one');
    await expectJson(await call('POST', '/rounds', w.owner, { mode: 'vote' }), 422, { error: 'A vote needs at least 2 open materials' });
    await expectJson(await call('POST', '/rounds', w.owner, { mode: 'draw' }), 201);
  });

  it('draws a winner immediately', async () => {
    const first = await suggest(w.member, 'First');
    await suggest(w.member, 'Second');
    pick.mockReturnValue(1);
    const drawn = await expectJson(await call('POST', '/rounds', w.owner, { mode: 'draw' }), 201);
    expect(drawn.round).toMatchObject({ mode: 'draw', status: 'closed', winnerMaterialId: first.id + 1 });
    expect(drawn.winner.title).toBe('Second');
  });

  it('runs a vote with one vote per user, per group (3.6)', async () => {
    const a = await suggest(w.member, 'A');
    const b = await suggest(w.member, 'B');
    const { round } = await expectJson(await call('POST', '/rounds', w.owner, { mode: 'vote' }), 201);
    await expectJson(await call('POST', '/rounds', w.owner, { mode: 'vote' }), 409, { error: 'A round is already open' });

    const voted = await expectJson(await call('POST', `/rounds/${round.id}/votes`, w.member, { materialId: a.id }), 201);
    expect(voted).toMatchObject({ myVote: a.id, tally: [{ materialId: a.id, votes: 1, voters: ['Max'] }] });
    const moved = await expectJson(await call('POST', `/rounds/${round.id}/votes`, w.member, { materialId: b.id }), 201);
    expect(moved.tally).toEqual([{ materialId: b.id, votes: 1, voters: ['Max'] }]);
    await call('POST', `/rounds/${round.id}/votes`, w.owner, { materialId: b.id });

    await expectJson(await call('POST', `/rounds/${round.id}/votes`, w.member, { materialId: 999 }), 404, { error: 'Material not found' });
    await expectJson(await call('POST', '/rounds/999/votes', w.member, { materialId: a.id }), 404, { error: 'Round not found' });
    await expectJson(await call('POST', `/rounds/${round.id}/votes`, w.member, { materialId: 'x' }), 400);

    await call('PATCH', `/materials/${a.id}`, w.owner, { status: 'discussed' });
    await expectJson(await call('POST', `/rounds/${round.id}/votes`, w.member, { materialId: a.id }), 422, { error: 'This material is not open for voting' });

    const current = await expectJson(await call('GET', '/rounds/current', w.member), 200);
    expect(current).toMatchObject({ round: { id: round.id, status: 'open' }, myVote: b.id, tally: [{ materialId: b.id, votes: 2 }] });

    await expectJson(await call('POST', `/rounds/${round.id}/close`, w.member), 403);
    const closed = await expectJson(await call('POST', `/rounds/${round.id}/close`, w.owner), 200);
    expect(closed).toMatchObject({ round: { status: 'closed', winnerMaterialId: b.id }, winner: { id: b.id } });
    await expectJson(await call('POST', `/rounds/${round.id}/close`, w.owner), 409, { error: 'This round is already closed' });
    await expectJson(await call('POST', `/rounds/${round.id}/votes`, w.member, { materialId: b.id }), 422, { error: 'This round is closed' });
    await expectJson(await call('POST', `/rounds/${round.id}/cancel`, w.owner), 409);
    await expectJson(await call('POST', '/rounds/999/cancel', w.owner), 404);
  });

  it('breaks ties and empty votes by draw, and cancels rounds', async () => {
    const a = await suggest(w.member, 'A');
    const b = await suggest(w.member, 'B');
    let { round } = (await (await call('POST', '/rounds', w.owner, { mode: 'vote' })).json());
    await call('POST', `/rounds/${round.id}/votes`, w.member, { materialId: a.id });
    await call('POST', `/rounds/${round.id}/votes`, w.owner, { materialId: b.id });
    pick.mockReturnValue(1);
    expect((await (await call('POST', `/rounds/${round.id}/close`, w.owner)).json()).round.winnerMaterialId).toBe(b.id);

    ({ round } = await (await call('POST', '/rounds', w.owner, { mode: 'vote' })).json());
    pick.mockReturnValue(0);
    expect((await (await call('POST', `/rounds/${round.id}/close`, w.owner)).json()).round.winnerMaterialId).toBe(a.id);

    ({ round } = await (await call('POST', '/rounds', w.owner, { mode: 'vote' })).json());
    const cancelled = await expectJson(await call('POST', `/rounds/${round.id}/cancel`, w.owner), 200);
    expect(cancelled).toMatchObject({ round: { status: 'closed', winnerMaterialId: null }, winner: null });
  });

  it('closes without a winner when every eligible item is gone', async () => {
    const a = await suggest(w.member, 'A');
    const b = await suggest(w.member, 'B');
    const { round } = await (await call('POST', '/rounds', w.owner, { mode: 'vote' })).json();
    await call('POST', `/rounds/${round.id}/votes`, w.member, { materialId: a.id });
    await call('DELETE', `/materials/${a.id}`, w.owner);
    await call('DELETE', `/materials/${b.id}`, w.owner);
    await suggest(w.member, 'Late item');
    const closed = await expectJson(await call('POST', `/rounds/${round.id}/close`, w.owner), 200);
    expect(closed.round.winnerMaterialId).toBeNull();
  });

  it('reports a race on the single open round and a round closed concurrently', async () => {
    await suggest(w.member, 'A');
    await suggest(w.member, 'B');
    await h.db.prepare("INSERT INTO rounds (group_id, mode, status, created_at) VALUES (?, 'vote', 'open', '2000-01-01T00:00:00.000Z')").bind(w.groupId).run();
    const racing = await createHarness({ db: hideOpenRound(h.db) });
    await expectJson(await racing.handler(request('POST', `/groups/${w.groupId}/rounds`, { cookie: w.owner, body: { mode: 'vote' } })), 409, { error: 'A round is already open' });

    const { round } = await (await call('GET', '/rounds/current', w.owner)).json();
    const closing = await createHarness({ db: failClose(h.db) });
    await expectJson(await closing.handler(request('POST', `/groups/${w.groupId}/rounds/${round.id}/cancel`, { cookie: w.owner })), 409, { error: 'This round is already closed' });
  });

  it('keeps each group’s board separate', async () => {
    const material = await suggest(w.member, 'Only here');
    await expectJson(await h.handler(request('GET', '/groups/devtalk/materials', { cookie: w.admin })), 200).then((body) => {
      expect(body.materials.map((item: { id: number }) => item.id)).not.toContain(material.id);
    });
    await expectJson(await h.handler(request('PATCH', `/groups/devtalk/materials/${material.id}`, { cookie: w.admin, body: { status: 'discussed' } })), 404);
  });

  it('surfaces unexpected database errors as 500 without details', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await suggest(w.member, 'Existing')).id).toBe(1);
    const broken = await createHarness({ db: failQuery(h.db, /^INSERT INTO materials/, new Error('disk full')) });
    await expectJson(await broken.handler(request('POST', `/groups/${w.groupId}/materials`, { cookie: w.member, body: { type: 'video', title: 'x' } })), 500, { error: 'Internal server error' });
    for (const [pattern, path, body] of [
      [/^UPDATE materials SET status/, '/materials/1', { status: 'open' }],
      [/^INSERT INTO rounds/, '/rounds', { mode: 'draw' }],
    ] as const) {
      const failing = await createHarness({ db: failQuery(h.db, pattern, new Error('boom')) });
      const method = path === '/materials/1' ? 'PATCH' : 'POST';
      await expectJson(await failing.handler(request(method, `/groups/${w.groupId}${path}`, { cookie: w.owner, body })), 500);
    }
    expect(console.error).toHaveBeenCalled();
  });
});

type Db = Harness['db'];

function wrap(db: Db, match: (query: string) => boolean, replace: (statement: ReturnType<Db['prepare']>) => Partial<ReturnType<Db['prepare']>>): Db {
  const decorate = (query: string, inner: ReturnType<Db['prepare']>): ReturnType<Db['prepare']> => ({
    bind: (...values: unknown[]) => decorate(query, inner.bind(...values)),
    first: inner.first.bind(inner),
    all: inner.all.bind(inner),
    run: inner.run.bind(inner),
    ...(match(query) ? replace(inner) : {}),
  } as ReturnType<Db['prepare']>);
  return { prepare: (query) => decorate(query, db.prepare(query)), batch: (statements) => db.batch(statements) };
}

function hideOpenRound(db: Db): Db {
  return wrap(db, (query) => query.includes("CASE status WHEN 'open'"), () => ({ first: async () => null }) as never);
}

function failClose(db: Db): Db {
  return wrap(db, (query) => query.startsWith("UPDATE rounds SET status = 'closed'"), () => ({ first: async () => null }) as never);
}

function failQuery(db: Db, pattern: RegExp, error: Error): Db {
  return wrap(db, (query) => pattern.test(query.trim()), () => ({ first: async () => { throw error; }, all: async () => { throw error; } }) as never);
}
