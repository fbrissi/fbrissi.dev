import { expect, test, type Page } from '@playwright/test';

import { ascii, jpeg, jpegSegment, png, sof } from '../test/workers/study-group/fixtures/images';
import { api, createGroupViaApi, freshUser, groupInput, sessionFor, users } from './support';

// e2e/features/icons.feature: content checks, metadata stripping and signed links, end to end through the local API
// and its icon folder. The images are hand-built like the unit-test fixtures: only the structure the parser reads is real.
const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

async function upload(page: Page, groupId: string, bytes: Uint8Array, contentType: string): Promise<{ status: number; body: { iconUrl?: string; error?: string } }> {
  const response = await page.request.put(`/api/study-group/groups/${groupId}/icon`, {
    headers: { 'Content-Type': contentType, Origin: new URL(baseUrl).origin },
    data: Buffer.from(bytes)
  });
  return { status: response.status(), body: await response.json().catch(() => ({})) };
}

async function fetchIcon(url: string): Promise<{ status: number; bytes: Uint8Array }> {
  const response = await fetch(new URL(url, baseUrl));
  return { status: response.status, bytes: new Uint8Array(await response.arrayBuffer()) };
}

const gif = Uint8Array.from([...Buffer.from('GIF89a'), 1, 0, 1, 0, 0, 0, 0, 0x3b]);
const fakePng = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')]);
const huge = png(64, 64, [], Array(300 * 1024).fill(0));
const invalid: [string, Uint8Array, string, number][] = [
  ['a GIF', gif, 'image/png', 422],
  ['text behind PNG magic bytes', fakePng, 'image/png', 422],
  ['sent as SVG', png(64, 64), 'image/svg+xml', 415],
  ['larger than 512 × 512', png(600, 600), 'image/png', 422],
  ['larger than 256 KB', huge, 'image/png', 413]
];

test.describe('icon security', () => {
  test.describe.configure({ mode: 'serial' });
  let owner: Page;
  let groupId = '';

  test.beforeAll(async ({ browser }) => {
    owner = await sessionFor(browser, freshUser('IconSecurity'));
    groupId = (await createGroupViaApi(owner, groupInput('Icon security', { listed: false }))).id;
  });
  test.afterAll(async () => {
    await owner.context().close();
  });

  for (const [kind, bytes, contentType, status] of invalid) {
    test(`an icon that is ${kind} is refused with ${status}`, async () => {
      expect((await upload(owner, groupId, bytes, contentType)).status).toBe(status);
    });
  }

  let firstUrl = '';
  test('EXIF, GPS and data after the JPEG end are stripped from an uploaded icon', async () => {
    const file = Uint8Array.from([...jpeg(64, 64), ...Buffer.from('secret-trailer')]);
    const result = await upload(owner, groupId, file, 'image/jpeg');
    expect(result.status).toBe(200);
    firstUrl = result.body.iconUrl!;
    const served = await fetchIcon(firstUrl);
    expect(served.status).toBe(200);
    expect(ascii(served.bytes)).toContain('JFIF');
    expect(ascii(served.bytes)).not.toMatch(/Exif|GPS|Photoshop|comment|secret-trailer/);
  });

  test('metadata between progressive JPEG scans is stripped', async () => {
    const scan = Array.from(jpegSegment(0xda, [1, 1, 0, 0, 0x3f, 0]));
    const file = Uint8Array.from([0xff, 0xd8, ...jpegSegment(0xe0, 'JFIF\0'), ...sof(64, 32), ...scan, 0x12, 0x34, ...jpegSegment(0xfe, 'between scans'),
      ...jpegSegment(0xe1, 'Exif\0\0GPS'), ...jpegSegment(0xc4, [1]), ...scan, 0x78, 0xff, 0xd9]);
    const result = await upload(owner, groupId, file, 'image/jpeg');
    expect(result.status).toBe(200);
    const served = await fetchIcon(result.body.iconUrl!);
    expect(ascii(served.bytes)).not.toMatch(/between scans|Exif|GPS/);
    expect(Array.from(served.bytes.slice(-3))).toEqual([0x78, 0xff, 0xd9]);
  });

  test('replacing the icon deletes the old file at once', async () => {
    expect((await fetchIcon(firstUrl)).status).toBe(404);
  });

  test('tampered, expired, too-long-lived and unsigned icon links are refused; extra query parameters are harmless', async () => {
    const result = await upload(owner, groupId, png(64, 64), 'image/png');
    expect(result.status).toBe(200);
    const url = new URL(result.body.iconUrl!, baseUrl);
    const variant = (change: (copy: URL) => void) => {
      const copy = new URL(url);
      change(copy);
      return copy.toString();
    };
    const sig = url.searchParams.get('sig')!;
    const now = Math.floor(Date.now() / 1000);
    expect((await fetchIcon(url.toString())).status).toBe(200);
    expect((await fetchIcon(variant((copy) => copy.searchParams.set('sig', `${sig.slice(0, -1)}${sig.endsWith('A') ? 'B' : 'A'}`)))).status).toBe(403);
    expect((await fetchIcon(variant((copy) => copy.searchParams.set('exp', String(now - 10))))).status).toBe(403);
    expect((await fetchIcon(variant((copy) => copy.searchParams.set('exp', String(now + 30 * 86_400))))).status).toBe(403);
    expect((await fetchIcon(variant((copy) => copy.searchParams.delete('sig')))).status).toBe(403);
    expect((await fetchIcon(variant((copy) => { copy.pathname = copy.pathname.replace(groupId, 'othergroup1'); }))).status).toBe(403);
    expect((await fetchIcon(variant((copy) => copy.searchParams.set('extra', '1')))).status).toBe(200);
  });

  test('a group can change its icon at most 5 times a day', async () => {
    // Three uploads so far today (JPEG, progressive JPEG, PNG); rejected uploads don't count.
    expect((await upload(owner, groupId, png(32, 32), 'image/png')).status).toBe(200);
    expect((await upload(owner, groupId, png(48, 48), 'image/png')).status).toBe(200);
    const over = await upload(owner, groupId, png(16, 16), 'image/png');
    expect(over.status).toBe(429);
    expect(over.body.error).toBe('Too many icon uploads today. Try again tomorrow.');
  });

  test('a platform admin cannot upload an icon to a group they do not own', async ({ browser }) => {
    const admin = await sessionFor(browser, users.admin);
    const result = await upload(admin, groupId, png(64, 64), 'image/png');
    expect(result.status).toBe(403);
    expect((await api(admin, 'GET', `/groups/${groupId}/settings`)).status).toBe(200);
    await admin.context().close();
  });
});
