import { expect, test, type Page } from '@playwright/test';

import { api, createGroupViaApi, freshUser, groupInput, joinAndApprove, sessionFor, suggest, users } from './support';

test.describe.configure({ mode: 'serial' });

/** Member vs owner (D6, 4.1, D10): hidden in the UI and rejected by the API. */
test.describe('member and owner permissions', () => {
  let owner: Page;
  let member: Page;
  let outsider: Page;
  let groupId = '';
  let ownerMaterial = 0;
  let memberMaterial = 0;
  let memberUserId = '';

  test.beforeAll(async ({ browser }) => {
    owner = await sessionFor(browser, freshUser('PermOwner'));
    member = await sessionFor(browser, users.member);
    outsider = await sessionFor(browser, users.outsider);
    const group = await createGroupViaApi(owner, groupInput('Permissions'));
    groupId = group.id;
    await joinAndApprove(member, owner, groupId, group.accessCode);
    ownerMaterial = (await suggest(owner, groupId, 'Owner article', 'https://example.test/owner')).id;
    memberMaterial = (await suggest(member, groupId, 'Member article', 'https://example.test/member')).id;
    memberUserId = ((await api<{ user: { id: string } }>(member, 'GET', '/me')).body.user.id);
  });

  test.afterAll(async () => {
    for (const page of [owner, member, outsider]) await page.context().close();
  });

  test('members see the board without owner controls', async () => {
    await member.goto(`/study-groups/g/${groupId}`);
    await expect(member.getByRole('heading', { name: 'Open materials' })).toBeVisible();
    await expect(member.getByRole('heading', { name: 'Owner article' })).toBeVisible();
    await expect(member.getByRole('button', { name: /Draw at random/ })).toHaveCount(0);
    await expect(member.getByRole('button', { name: 'Start vote' })).toHaveCount(0);
    await expect(member.getByRole('button', { name: 'Mark discussed' })).toHaveCount(0);
    await expect(member.getByRole('button', { name: /^Delete “/ })).toHaveCount(0);
    await expect(member.getByRole('link', { name: 'Group settings' })).toHaveCount(0);
    await expect(member.getByRole('button', { name: 'Leave group' })).toBeVisible();
    await expect(member.getByRole('button', { name: 'Add suggestion' })).toBeVisible();

    await member.goto(`/study-groups/g/${groupId}/settings`);
    await expect(member.getByText('Only the group owner can open the settings.')).toBeVisible();
    await expect(member.locator('code[aria-label="Access code"]')).toHaveCount(0);
  });

  test('owners see the moderation controls', async () => {
    await owner.goto(`/study-groups/g/${groupId}`);
    await expect(owner.getByRole('button', { name: /Draw at random/ })).toBeVisible();
    await expect(owner.getByRole('button', { name: 'Start vote' })).toBeEnabled();
    await expect(owner.getByRole('button', { name: 'Delete “Member article”' })).toBeVisible();
    await expect(owner.getByRole('link', { name: 'Group settings' })).toBeVisible();
    await expect(owner.getByRole('button', { name: 'Leave group' })).toHaveCount(0);
  });

  test('the API rejects every owner-only action from a member with 403', async () => {
    const g = `/groups/${groupId}`;
    const calls: [string, string, unknown?][] = [
      ['GET', `${g}/settings`],
      ['PUT', `${g}/settings`, { ...groupInput('Hijack'), meetingDay: 'Monday', meetingStart: '20:00', meetingEnd: '21:00', timezone: 'UTC', rules: [], meetingUrl: null, moderationMode: 'free', listed: true }],
      ['POST', `${g}/access-code`],
      ['GET', `${g}/requests`],
      ['POST', `${g}/requests/1/approve`],
      ['POST', `${g}/requests/1/reject`],
      ['DELETE', `${g}/members/${memberUserId}`],
      ['DELETE', g, { confirmName: 'x' }],
      ['POST', `${g}/rounds`, { mode: 'draw' }],
      ['POST', `${g}/rounds`, { mode: 'vote' }],
      ['POST', `${g}/rounds/1/close`],
      ['POST', `${g}/rounds/1/cancel`],
      ['PATCH', `${g}/materials/${ownerMaterial}`, { status: 'discussed' }],
      ['DELETE', `${g}/materials/${ownerMaterial}`, {}],
      ['DELETE', `${g}/materials/${memberMaterial}`, {}],
      ['POST', `${g}/materials/${memberMaterial}/approve`],
      ['POST', `${g}/materials/${memberMaterial}/restore`],
      ['GET', `${g}/materials/deleted`],
      ['GET', '/admin/groups'],
      ['GET', '/admin/moderation-log']
    ];
    for (const [method, path, body] of calls) {
      const result = await api(member, method, path, body);
      expect(result.status, `${method} ${path}`).toBe(403);
    }
  });

  test('a signed-in non-member gets 403 from every group API and the join screen in the UI (3.4)', async () => {
    const g = `/groups/${groupId}`;
    for (const [method, path, body] of [
      ['GET', g], ['GET', `${g}/members`], ['GET', `${g}/materials`], ['GET', `${g}/rounds/current`],
      ['POST', `${g}/materials`, { type: 'article', title: 'Sneaky' }], ['POST', `${g}/rounds/1/votes`, { materialId: ownerMaterial }],
      ['POST', `${g}/leave`], ['GET', `${g}/settings`]
    ] as [string, string, unknown?][]) {
      expect((await api(outsider, method, path, body)).status, `${method} ${path}`).toBe(403);
    }
    await outsider.goto(`/study-groups/g/${groupId}`);
    await expect(outsider.getByRole('heading', { name: 'Ask to join' })).toBeVisible();
    await expect(outsider.getByText('Owner article')).toHaveCount(0);
  });

  test('a visitor gets 401 from the group APIs', async ({ page }) => {
    await page.goto('/study-groups');
    for (const path of [`/groups/${groupId}`, `/groups/${groupId}/materials`, '/me/groups', '/me/export']) {
      expect((await api(page, 'GET', path)).status, path).toBe(401);
    }
    expect((await api(page, 'POST', '/groups', groupInput('Anon'))).status).toBe(401);
  });

  test('state-changing requests need an allowed Origin and a JSON body (CSRF)', async () => {
    const wrongType = await api(member, 'POST', `/groups/${groupId}/materials`, { type: 'article', title: 'Form post' }, 'text/plain');
    expect(wrongType.status).toBe(415);

    const cookies = await member.context().cookies();
    const session = cookies.find((cookie) => cookie.name === '__Host-sg_session');
    const forged = await member.request.post(`/api/study-group/groups/${groupId}/materials`, {
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json', Cookie: `__Host-sg_session=${session?.value}` },
      data: { type: 'article', title: 'Cross-site' }
    });
    expect(forged.status()).toBe(403);
  });

  test('members suggest and vote once per round; the owner runs the round', async () => {
    const start = await api<{ round: { id: number } }>(owner, 'POST', `/groups/${groupId}/rounds`, { mode: 'vote' });
    expect(start.status).toBe(201);
    const roundId = start.body.round.id;

    await member.goto(`/study-groups/g/${groupId}`);
    await expect(member.getByRole('heading', { name: "Vote for this week's topic" })).toBeVisible();
    await expect(member.getByRole('button', { name: 'Close vote' })).toHaveCount(0);
    await member.getByRole('button', { name: /^Vote for: Owner article/ }).click();
    await expect(member.getByRole('button', { name: /^Your vote: Owner article/ })).toBeVisible();

    // Changing the vote replaces it: still one vote per user per round.
    const second = await api<{ tally: { materialId: number; votes: number }[] }>(member, 'POST', `/groups/${groupId}/rounds/${roundId}/votes`, { materialId: memberMaterial });
    expect(second.status).toBe(201);
    const total = second.body.tally.reduce((sum, entry) => sum + entry.votes, 0);
    expect(total).toBe(1);

    // Only one open round per group.
    expect((await api(owner, 'POST', `/groups/${groupId}/rounds`, { mode: 'draw' })).status).toBe(409);
    expect((await api(member, 'POST', `/groups/${groupId}/rounds/${roundId}/close`)).status).toBe(403);
    const closed = await api<{ round: { status: string; winnerMaterialId: number } }>(owner, 'POST', `/groups/${groupId}/rounds/${roundId}/close`);
    expect(closed.status).toBe(200);
    expect(closed.body.round).toMatchObject({ status: 'closed', winnerMaterialId: memberMaterial });

    // Members' suggestions are tied to their display name (3.6).
    await member.reload();
    await expect(member.getByText(`Suggested by ${users.member.givenName}`).first()).toBeVisible();
  });

  test('the owner deletes content; the member cannot', async () => {
    await owner.goto(`/study-groups/g/${groupId}`);
    owner.once('dialog', (dialog) => void dialog.accept());
    await owner.getByRole('button', { name: 'Delete “Owner article”' }).click();
    await expect(owner.getByRole('heading', { name: 'Owner article' })).toHaveCount(0);
    expect((await api(member, 'DELETE', `/groups/${groupId}/materials/${memberMaterial}`, {})).status).toBe(403);
  });
});

/** Content rules (Security: plain text, http(s) URLs) and abuse caps (Q12). */
test.describe('content and limits', () => {
  test('user text renders as plain text and only http(s) links are accepted', async ({ browser }) => {
    const owner = await sessionFor(browser, freshUser('Content'));
    const group = await createGroupViaApi(owner, groupInput('Content'));
    const g = `/groups/${group.id}`;

    for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://example.test/file']) {
      expect((await api(owner, 'POST', `${g}/materials`, { type: 'article', title: 'Bad link', url })).status, url).toBe(400);
    }
    const settings = (await api<{ settings: Record<string, unknown> }>(owner, 'GET', `${g}/settings`)).body.settings;
    const profile = Object.fromEntries(Object.entries(settings).filter(([key]) => key !== 'id' && key !== 'accessCode'));
    expect((await api(owner, 'PUT', `${g}/settings`, { ...profile, meetingUrl: 'javascript:alert(1)' })).status).toBe(400);

    let dialogs = 0;
    owner.on('dialog', (dialog) => { dialogs += 1; void dialog.dismiss(); });
    const payload = '<img src=x onerror="alert(1)"><b>bold</b>';
    await suggest(owner, group.id, payload);
    await owner.goto(`/study-groups/g/${group.id}`);
    await expect(owner.getByRole('heading', { name: payload })).toBeVisible();
    await expect(owner.locator('article img[src="x"]')).toHaveCount(0);
    expect(dialogs).toBe(0);
    await owner.context().close();
  });

  test('a user owns at most 3 groups and names and summaries respect their limits', async ({ browser }) => {
    const owner = await sessionFor(browser, freshUser('Capped'));
    for (let index = 0; index < 3; index += 1) await createGroupViaApi(owner, groupInput(`Cap ${index}`));
    const base = { meetingDay: 'Monday', meetingStart: '20:00', meetingEnd: '21:00', timezone: 'UTC', rules: [], meetingUrl: null, moderationMode: 'free', listed: true, acceptContentPolicy: true };
    expect((await api(owner, 'POST', '/groups', { ...base, ...groupInput('Cap 4') })).status).toBe(409);
    await owner.context().close();

    const other = await sessionFor(browser, freshUser('Limits'));
    expect((await api(other, 'POST', '/groups', { ...base, name: 'ab', summary: 'A long enough summary for the group.' })).status).toBe(400);
    expect((await api(other, 'POST', '/groups', { ...base, name: 'x'.repeat(61), summary: 'A long enough summary for the group.' })).status).toBe(400);
    expect((await api(other, 'POST', '/groups', { ...base, name: 'Short summary', summary: 'Too short.' })).status).toBe(400);
    expect((await api(other, 'POST', '/groups', { ...base, name: 'Long summary', summary: 'y'.repeat(281) })).status).toBe(400);
    expect((await api(other, 'POST', '/groups', { ...base, ...groupInput('No policy'), acceptContentPolicy: false })).status).toBe(400);
    await other.context().close();
  });
});
