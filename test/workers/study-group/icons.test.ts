// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteIconObjects, deleteOrphanIcons, signIconUrl, verifyIconUrl } from '@/workers/study-group/icons';
import type { CacheLike } from '@/workers/study-group/oidc';

import { jpeg, png, pngChunk } from './fixtures/images';
import { appOrigin, base, createHarness, createWorld, expectJson, memoryBucket, request, signIn, type Harness, type World } from './harness';

const HOUR = 3_600_000;
let h: Harness;
let w: World;
let bucket: ReturnType<typeof memoryBucket>;

beforeEach(async () => {
  bucket = memoryBucket();
  h = await createHarness({ icons: bucket, notify: vi.fn(async () => undefined) });
  w = await createWorld(h);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function upload(cookie: string | undefined, data: Uint8Array<ArrayBuffer> | null, type = 'image/png', groupId = w.groupId, headers: Record<string, string> = {}) {
  return h.handler(new Request(`${base}/groups/${groupId}/icon`, {
    method: 'PUT',
    headers: { Origin: appOrigin, 'Content-Type': type, ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: data,
  }));
}

/** The editable profile fields of a settings response. */
const profileOf = ({ settings }: { settings: Record<string, unknown> }) =>
  Object.fromEntries(Object.entries(settings).filter(([key]) => !['id', 'accessCode', 'iconUrl'].includes(key)));
const call = (method: string, path: string, cookie?: string, body?: unknown) => h.handler(request(method, path, { cookie, body }));
const iconUrlOf = async (cookie: string) => (await (await call('GET', `/groups/${w.groupId}`, cookie)).json()).group.iconUrl as string | null;
const fetchIcon = (url: string, handler = h.handler) => handler(new Request(`${appOrigin}${url}`));

describe('group icon upload', () => {
  it('stores a checked, metadata-free image under a new key and serves it through a signed, cacheable URL', async () => {
    const uploaded = await expectJson(await upload(w.owner, png(64, 64, [pngChunk('tEXt', 'Author\0Secret')])), 200);
    expect(uploaded.iconUrl).toMatch(new RegExp(`^/api/study-group/icons/${w.groupId}/[a-z0-9]{16}\\.png\\?exp=\\d+&sig=[\\w-]+$`));
    const [[key, object]] = [...bucket.objects];
    expect(key).toMatch(new RegExp(`^groups/${w.groupId}/[a-z0-9]{16}\\.png$`));
    expect(object.contentType).toBe('image/png');
    expect(String.fromCharCode(...object.data)).not.toContain('Secret');

    // Members get the same signed URL in the board, the settings and their group list, and so does the public list of
    // listed groups.
    const url = await iconUrlOf(w.member);
    expect(url).toBe(uploaded.iconUrl);
    expect((await (await call('GET', `/groups/${w.groupId}/settings`, w.owner)).json()).settings.iconUrl).toBe(url);
    expect((await (await call('GET', '/me/groups', w.member)).json()).groups[0].iconUrl).toBe(url);
    expect((await (await call('GET', `/groups/${w.groupId}/preview`, w.outsider)).json()).group.iconUrl).toBe(url);
    const listed = (await (await call('GET', '/groups')).json()).groups as { id: string; iconUrl: string | null }[];
    expect(listed.find((item) => item.id === w.groupId)!.iconUrl).toBe(url);
    expect(listed.find((item) => item.id === 'devtalk')!.iconUrl).toBeNull();

    const served = await fetchIcon(url!);
    expect(served.status).toBe(200);
    expect(served.headers.get('Content-Type')).toBe('image/png');
    expect(served.headers.get('Cache-Control')).toMatch(/^public, max-age=\d+, immutable$/);
    expect(served.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(served.headers.get('Content-Security-Policy')).toBe("default-src 'none'; sandbox");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(object.data);
  });

  it('never lists an unlisted group, icon or not, and refreshes the public list when a listed icon changes', async () => {
    await expectJson(await upload(w.owner, png(8, 8)), 200);
    await expectJson(await call('PUT', `/groups/${w.groupId}/settings`, w.owner, { ...profileOf(await (await call('GET', `/groups/${w.groupId}/settings`, w.owner)).json()), listed: false }), 200);
    const body = JSON.stringify(await (await call('GET', '/groups')).json());
    expect(body).not.toContain(w.groupId);
    expect(body).not.toContain('/icons/');

    const purged: string[] = [];
    const cached = await createHarness({ icons: memoryBucket(), cache: { match: async () => undefined, put: async () => undefined, delete: async (key) => { purged.push(new URL(key.url).pathname); return true; } } });
    const world = await createWorld(cached);
    const put = () => cached.handler(new Request(`${base}/groups/${world.groupId}/icon`, { method: 'PUT', headers: { Origin: appOrigin, 'Content-Type': 'image/png', Cookie: world.owner }, body: png(8, 8) }));
    expect((await put()).status).toBe(200);
    expect(purged).toContain('/api/study-group/groups');
    purged.length = 0;
    expect((await cached.handler(request('DELETE', `/groups/${world.groupId}/icon`, { cookie: world.owner, body: {} }))).status).toBe(204);
    expect(purged).toContain('/api/study-group/groups');
    // An unlisted group's icon never touches the public list.
    const current = await (await cached.handler(request('GET', `/groups/${world.groupId}/settings`, { cookie: world.owner }))).json();
    await expectJson(await cached.handler(request('PUT', `/groups/${world.groupId}/settings`, { cookie: world.owner, body: { ...profileOf(current), listed: false } })), 200);
    purged.length = 0;
    expect((await put()).status).toBe(200);
    expect((await cached.handler(request('DELETE', `/groups/${world.groupId}/icon`, { cookie: world.owner, body: {} }))).status).toBe(204);
    expect(purged).not.toContain('/api/study-group/groups');
  });

  it('replaces the icon and deletes the old object right away', async () => {
    await expectJson(await upload(w.owner, png(8, 8)), 200);
    const [first] = bucket.objects.keys();
    await expectJson(await upload(w.owner, jpeg(16, 16), 'image/jpeg'), 200);
    expect([...bucket.objects.keys()]).toEqual([expect.stringMatching(/\.jpg$/)]);
    expect(bucket.objects.has(first)).toBe(false);
  });

  it('lets only the owner upload, with an allowed Origin and an image content type', async () => {
    await expectJson(await upload(w.member, png(8, 8)), 403, { error: 'Forbidden' });
    await expectJson(await upload(w.admin, png(8, 8)), 403, { error: 'Only the group owner can change the icon' });
    await expectJson(await upload(undefined, png(8, 8)), 401);
    await expectJson(await upload(w.owner, png(8, 8), 'image/gif'), 415, { error: 'Use a PNG, JPEG or WebP image' });
    await expectJson(await upload(w.owner, png(8, 8), 'image/png', w.groupId, { Origin: 'https://evil.test' }), 403);
  });

  it('refuses large bodies before reading them in full, and invalid images', async () => {
    await expectJson(await upload(w.owner, new Uint8Array(10), 'image/png', w.groupId, { 'Content-Length': String(300 * 1024) }), 413, { error: 'Use an image of at most 256 KB.' });
    await expectJson(await upload(w.owner, new Uint8Array(300 * 1024)), 413);
    await expectJson(await upload(w.owner, png(600, 600)), 422, { error: 'Use an image of at most 512 × 512 pixels.' });
    await expectJson(await upload(w.owner, null), 422, { error: 'Use a PNG, JPEG or WebP image.' });
    expect(bucket.objects.size).toBe(0);
  });

  it('caps uploads per group and per user per day', async () => {
    for (let index = 0; index < 5; index += 1) await expectJson(await upload(w.owner, png(8, 8)), 200);
    await expectJson(await upload(w.owner, png(8, 8)), 429, { error: 'Too many icon uploads today. Try again tomorrow.' });
    h.clock.now += 25 * HOUR;
    await expectJson(await upload(w.owner, png(8, 8)), 200);

    await h.db.prepare("INSERT INTO icon_uploads (user_id, group_id, created_at) SELECT owner_id, 'elsewhere', ? FROM groups WHERE id = ?").bind(new Date(h.clock.now).toISOString(), w.groupId).run();
    for (let index = 0; index < 8; index += 1) {
      await h.db.prepare("INSERT INTO icon_uploads (user_id, group_id, created_at) SELECT owner_id, 'elsewhere', ? FROM groups WHERE id = ?").bind(new Date(h.clock.now).toISOString(), w.groupId).run();
    }
    await expectJson(await upload(w.owner, png(8, 8)), 429);
  });

  it('turns icons off without a bucket or session secret', async () => {
    const off = await createHarness();
    const world = await createWorld(off);
    const response = await off.handler(new Request(`${base}/groups/${world.groupId}/icon`, { method: 'PUT', headers: { Origin: appOrigin, 'Content-Type': 'image/png', Cookie: world.owner }, body: png(8, 8) }));
    await expectJson(response, 503, { error: 'Group icons are not available right now' });
    await expectJson(await off.handler(request('DELETE', `/groups/${world.groupId}/icon`, { cookie: world.owner, body: {} })), 503);
    await expectJson(await off.handler(new Request(`${base}/icons/${world.groupId}/abcdefghjkmnpqrs.png?exp=1&sig=x`)), 503);
    await off.db.prepare("UPDATE groups SET icon_key = 'groups/x/abcdefghjkmnpqrs.png', icon_content_type = 'image/png', icon_updated_at = 'x' WHERE id = ?").bind(world.groupId).run();
    expect((await (await off.handler(request('GET', `/groups/${world.groupId}`, { cookie: world.member }))).json()).group.iconUrl).toBeNull();
  });
});

describe('group icon links', () => {
  it('rejects forged, expired and malformed links, and missing objects', async () => {
    const { iconUrl } = await expectJson(await upload(w.owner, png(8, 8)), 200);
    const url = new URL(iconUrl, appOrigin);
    const tampered = new URL(url);
    tampered.searchParams.set('sig', `${url.searchParams.get('sig')}x`);
    await expectJson(await fetchIcon(`${tampered.pathname}${tampered.search}`), 403, { error: 'This icon link is invalid or has expired' });
    await expectJson(await fetchIcon(url.pathname), 403);
    await expectJson(await fetchIcon(`${url.pathname}?exp=abc&sig=x`), 403);
    // Another group's path with this signature doesn't match.
    await expectJson(await fetchIcon(`/api/study-group/icons/devtalk/${url.pathname.split('/').pop()}${url.search}`), 403);
    h.clock.now += 3 * HOUR;
    await expectJson(await fetchIcon(iconUrl), 403);
    h.clock.now -= 3 * HOUR;

    bucket.objects.clear();
    await expectJson(await fetchIcon(iconUrl), 404, { error: 'Icon not found' });
  });

  it('answers repeats from the edge cache', async () => {
    const store = new Map<string, Response>();
    const cache: CacheLike = {
      match: async (key) => store.get(key.url)?.clone(),
      put: async (key, response) => void store.set(key.url, response),
      delete: async (key) => store.delete(key.url),
    };
    const cached = await createHarness({ icons: bucket, cache });
    const world = await createWorld(cached);
    const { iconUrl } = await expectJson(await cached.handler(new Request(`${base}/groups/${world.groupId}/icon`, { method: 'PUT', headers: { Origin: appOrigin, 'Content-Type': 'image/png', Cookie: world.owner }, body: png(8, 8) })), 200);
    expect((await fetchIcon(iconUrl, cached.handler)).status).toBe(200);
    // Extra query parameters don't make new cache entries.
    expect((await fetchIcon(`${iconUrl}&v=1`, cached.handler)).status).toBe(200);
    expect([...store.keys()].filter((key) => key.includes('/icons/'))).toEqual([`${appOrigin}${iconUrl}`]);
    bucket.objects.clear();
    expect((await fetchIcon(iconUrl, cached.handler)).status).toBe(200);
  });

  it('purges every still-valid link of an icon from the edge cache when it is replaced, removed or its group deleted', async () => {
    const store = new Map<string, Response>();
    const cache: CacheLike = {
      match: async (key) => store.get(key.url)?.clone(),
      put: async (key, response) => void store.set(key.url, response),
      delete: async (key) => store.delete(key.url),
    };
    const icons = () => [...store.keys()].filter((key) => key.includes('/icons/')).length;
    const cached = await createHarness({ icons: bucket, cache });
    const world = await createWorld(cached);
    const put = async () =>
      (await expectJson(await cached.handler(new Request(`${base}/groups/${world.groupId}/icon`, { method: 'PUT', headers: { Origin: appOrigin, 'Content-Type': 'image/png', Cookie: world.owner }, body: png(8, 8) })), 200)).iconUrl as string;
    // A link issued in the previous hour and one issued now are both cached, then the icon is replaced.
    const earlier = await put();
    await fetchIcon(earlier, cached.handler);
    cached.clock.now += HOUR;
    const [key] = bucket.objects.keys();
    const later = (await (await cached.handler(request('GET', `/groups/${world.groupId}`, { cookie: world.member }))).json()).group.iconUrl as string;
    expect(later).not.toBe(earlier);
    await fetchIcon(later, cached.handler);
    expect(icons()).toBe(2);
    await put();
    expect(bucket.objects.has(key)).toBe(false);
    expect(icons()).toBe(0);

    await fetchIcon(await put(), cached.handler);
    expect(icons()).toBe(1);
    expect((await cached.handler(request('DELETE', `/groups/${world.groupId}/icon`, { cookie: world.owner, body: {} }))).status).toBe(204);
    expect(icons()).toBe(0);

    await fetchIcon(await put(), cached.handler);
    expect(icons()).toBe(1);
    const name = (await (await cached.handler(request('GET', `/groups/${world.groupId}`, { cookie: world.owner }))).json()).group.name as string;
    expect((await cached.handler(request('DELETE', `/groups/${world.groupId}`, { cookie: world.owner, body: { confirmName: name } }))).status).toBe(204);
    expect(icons()).toBe(0);
  });

  it('falls back to a generic content type when the object has no metadata', async () => {
    const { iconUrl } = await expectJson(await upload(w.owner, png(8, 8)), 200);
    const bare = await createHarness({ icons: { ...bucket, get: async () => ({ arrayBuffer: async () => new ArrayBuffer(1) }) } });
    const served = await bare.handler(new Request(`${appOrigin}${iconUrl}`));
    expect(served.headers.get('Content-Type')).toBe('application/octet-stream');
  });

  it('signs URLs that stay the same within the hour and expire within 2 hours', async () => {
    const at = new Date('2026-11-22T10:15:00Z');
    const url = await signIconUrl('secret', 'groups/g1/abcdefghjkmnpqrs.png', at);
    expect(url).toBe(await signIconUrl('secret', 'groups/g1/abcdefghjkmnpqrs.png', new Date('2026-11-22T10:59:59Z')));
    const exp = new URL(url, appOrigin).searchParams.get('exp');
    expect(Number(exp) * 1000).toBe(Date.parse('2026-11-22T12:00:00Z'));
    const sig = new URL(url, appOrigin).searchParams.get('sig');
    expect(await verifyIconUrl('secret', 'groups/g1/abcdefghjkmnpqrs.png', exp, sig, at)).toBe(6300);
    expect(await verifyIconUrl('', 'groups/g1/abcdefghjkmnpqrs.png', exp, sig, at)).toBeNull();
    expect(await verifyIconUrl('secret', 'groups/g1/abcdefghjkmnpqrs.png', null, sig, at)).toBeNull();
    expect(await verifyIconUrl('secret', 'groups/g1/abcdefghjkmnpqrs.png', exp, null, at)).toBeNull();
    expect(await verifyIconUrl('secret', 'groups/g1/abcdefghjkmnpqrs.png', String(Number(exp) + 7200), sig, at)).toBeNull();
    expect(await verifyIconUrl('other', 'groups/g1/abcdefghjkmnpqrs.png', exp, sig, at)).toBeNull();
  });
});

describe('group icon removal and cleanup', () => {
  it('lets the owner remove the icon permanently, without a log', async () => {
    await expectJson(await upload(w.owner, png(8, 8)), 200);
    expect((await call('DELETE', `/groups/${w.groupId}/icon`, w.owner, {})).status).toBe(204);
    expect(bucket.objects.size).toBe(0);
    expect(await iconUrlOf(w.member)).toBeNull();
    await expectJson(await call('DELETE', `/groups/${w.groupId}/icon`, w.owner, {}), 404, { error: 'This group has no icon' });
    await expectJson(await call('DELETE', `/groups/${w.groupId}/icon`, w.member, {}), 403);
    expect((await (await call('GET', '/admin/moderation-log', w.admin)).json()).actions).toEqual([]);
  });

  it('lets the platform admin remove it with a reason: logged, a notice and an email to the owner', async () => {
    await expectJson(await upload(w.owner, png(8, 8)), 200);
    const [key] = bucket.objects.keys();
    await expectJson(await call('DELETE', `/groups/${w.groupId}/icon`, w.admin, {}), 400);
    expect((await call('DELETE', `/groups/${w.groupId}/icon`, w.admin, { reason: 'Political propaganda image' })).status).toBe(204);
    expect(bucket.objects.size).toBe(0);
    const { notices } = await (await call('GET', '/me/groups', w.owner)).json();
    expect(notices).toEqual([expect.objectContaining({ action: 'delete_icon', label: 'Go Talk', reason: 'Political propaganda image' })]);
    const row = await h.db.prepare("SELECT kind, dedupe_key, payload FROM notifications WHERE kind = 'icon_removed'").first();
    expect(row).toEqual({ kind: 'icon_removed', dedupe_key: `icon_removed:${key}`, payload: JSON.stringify({ groupName: 'Go Talk', reason: 'Political propaganda image' }) });
  });

  it('deletes the objects with the group and the account, and exports the owner’s icons', async () => {
    await expectJson(await upload(w.owner, png(8, 8)), 200);
    const data = await (await call('GET', '/me/export', w.owner)).json();
    const [[, object]] = [...bucket.objects];
    expect(data.ownedGroups).toEqual([expect.objectContaining({ id: w.groupId, icon: { contentType: 'image/png', updatedAt: expect.any(String), base64: Buffer.from(object.data).toString('base64') } })]);
    expect((await call('DELETE', `/groups/${w.groupId}`, w.owner, { confirmName: 'Go Talk' })).status).toBe(204);
    expect(bucket.objects.size).toBe(0);

    const owner = await signIn(h, { email: 'second@example.test', name: 'Second' });
    const { group } = await expectJson(await call('POST', '/groups', owner, { name: 'Second Group', summary: 'Weekly English practice about other topics.', rules: [], meetingDay: 'Mon', meetingStart: '19:00', meetingEnd: '20:00', timezone: 'UTC', meetingUrl: null, moderationMode: 'free', listed: true, acceptContentPolicy: true }), 201);
    await expectJson(await upload(owner, png(8, 8), 'image/png', group.id), 200);
    expect((await call('DELETE', '/me', owner, { confirm: true })).status).toBe(204);
    expect(bucket.objects.size).toBe(0);
  });

  it('exports no icon data when the object is gone', async () => {
    await expectJson(await upload(w.owner, png(8, 8)), 200);
    bucket.objects.clear();
    expect((await (await call('GET', '/me/export', w.owner)).json()).ownedGroups[0].icon).toBeNull();
  });

  it('logs a failed object delete and leaves it to the orphan cleanup', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await deleteIconObjects(undefined, ['groups/x/a.png']);
    await deleteIconObjects(bucket, []);
    await deleteIconObjects({ ...bucket, delete: async () => { throw new Error('R2 down'); } }, ['groups/x/a.png']);
    await deleteIconObjects({ ...bucket, delete: async () => { throw 'offline'; } }, ['groups/x/b.png']);
    expect(error.mock.calls).toEqual([
      ['Unable to delete study group icons:', ['groups/x/a.png'], 'R2 down'],
      ['Unable to delete study group icons:', ['groups/x/b.png'], 'offline'],
    ]);
  });

  it('deletes orphaned objects older than the cutoff, across list pages', async () => {
    const old = new Date('2026-11-01T00:00:00Z');
    for (const key of ['groups/a/1.png', 'groups/a/2.png', 'groups/b/3.png', 'groups/c/4.png']) bucket.objects.set(key, { data: new Uint8Array(1), uploaded: old });
    bucket.objects.set('groups/d/5.png', { data: new Uint8Array(1), uploaded: new Date('2026-11-22T00:00:00Z') });
    bucket.objects.set('other/6.png', { data: new Uint8Array(1), uploaded: old });
    const deleted = await deleteOrphanIcons(bucket, new Set(['groups/a/2.png']), new Date('2026-11-21T00:00:00Z'));
    expect(deleted).toBe(3);
    expect([...bucket.objects.keys()].sort()).toEqual(['groups/a/2.png', 'groups/d/5.png', 'other/6.png']);
    expect(await deleteOrphanIcons(bucket, new Set(), new Date('2026-11-01T00:00:00Z'))).toBe(0);
  });
});
