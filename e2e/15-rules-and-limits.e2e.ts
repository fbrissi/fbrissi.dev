import { expect, test, type Page } from '@playwright/test';

import { api, createGroupViaApi, freshUser, groupInput, joinAndApprove, sessionFor, suggest, users, type TestUser } from './support';

// Scenarios from groups.feature, board.feature, auth.feature, admin.feature and account.feature that the earlier specs
// don't cover: URL-like names, the pending and suggestion caps, round rules, sign-out, ban renewal and the export.
const groupBody = (name: string) => ({
  name,
  summary: 'A friendly group to practice English with other developers.',
  rules: [],
  meetingDay: 'Monday',
  meetingStart: '20:00',
  meetingEnd: '21:00',
  timezone: 'America/Sao_Paulo',
  meetingUrl: null,
  moderationMode: 'free',
  listed: false,
  acceptContentPolicy: true
});

test.describe('group names', () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    page = await sessionFor(browser, freshUser('NameOwner'));
  });
  test.afterAll(async () => {
    await page.context().close();
  });

  for (const name of ['My Group EXAMPLE.COM', 'Join WWW.club now', 'HTTPS://x', 'see bit.LY', 'Meet at chat.example.museum', 'Join 10.0.0.1 now', 'mailto:owner', 'Go.Talk']) {
    test(`the group name "${name}" is refused as a link`, async () => {
      const result = await api<{ error: string; details?: { message: string }[] }>(page, 'POST', '/groups', groupBody(name));
      expect(result.status).toBe(400);
      expect(JSON.stringify(result.body)).toContain("Group names can't contain links or web addresses.");
    });
  }

  for (const name of ['Node.js devs', 'ASP.NET Core', '.NET devs', 'Socket.IO chat']) {
    test(`the tech name "${name}" stays allowed`, async () => {
      const result = await api<{ group: { id: string; name: string } }>(page, 'POST', '/groups', groupBody(name));
      expect(result.status).toBe(201);
      expect(result.body.group.name).toBe(name);
      expect((await api(page, 'DELETE', `/groups/${result.body.group.id}`, { confirmName: name })).status).toBe(204);
    });
  }

  test('names, summaries and display names with invisible or text-direction characters or an email address are refused', async () => {
    const invisible = 'Remove invisible or text-direction characters.';
    const email = "Don't include an email address.";
    for (const [body, error] of [
      [groupBody('Go\u200BTalk'), invisible],
      [groupBody('Go\u202ETalk'), invisible],
      [{ ...groupBody('Plain name'), summary: 'Weekly practice \u2066hidden\u2069 here.' }, invisible],
      [{ ...groupBody('Plain name'), summary: 'Weekly practice, write to owner@example.test.' }, email],
    ] as const) {
      expect(await api(page, 'POST', '/groups', body)).toMatchObject({ status: 400, body: { error } });
    }
    for (const [displayName, error] of [['\u200B\u200C', invisible], ['Ana\u202Eevil', invisible], ['ana@example.test', email]]) {
      expect(await api(page, 'PATCH', '/me', { displayName })).toMatchObject({ status: 400, body: { error } });
    }
  });
});

test('a user can have at most 10 pending join requests', async ({ browser }) => {
  const requester = await sessionFor(browser, freshUser('PendingCap'));
  const owners: Page[] = [];
  const statuses: number[] = [];
  for (let index = 0; index < 11; index += 1) {
    if (index % 3 === 0) owners.push(await sessionFor(browser, freshUser('PendingCapOwner')));
    const group = await createGroupViaApi(owners.at(-1)!, groupInput('Pending cap', { listed: false }));
    statuses.push((await api(requester, 'POST', `/groups/${group.id}/join`, { code: group.accessCode })).status);
  }
  expect(statuses.slice(0, 10)).toEqual(Array(10).fill(201));
  expect(statuses[10]).toBe(409);
  for (const page of [requester, ...owners]) await page.context().close();
});

test.describe('rounds and suggestion limits', () => {
  test.describe.configure({ mode: 'serial' });
  let owner: Page;
  let member: Page;
  let groupId = '';

  test.beforeAll(async ({ browser }) => {
    owner = await sessionFor(browser, freshUser('RoundOwner'));
    member = await sessionFor(browser, freshUser('RoundMember'));
    const group = await createGroupViaApi(owner, groupInput('Rounds', { listed: false }));
    groupId = group.id;
    await joinAndApprove(member, owner, groupId, group.accessCode);
  });
  test.afterAll(async () => {
    for (const page of [owner, member]) await page.context().close();
  });

  test('a draw closes at once with a winner, and only one round is open at a time', async () => {
    const only = await suggest(member, groupId, 'Only material');
    const draw = await api<{ round: { status: string; winnerMaterialId: number } }>(owner, 'POST', `/groups/${groupId}/rounds`, { mode: 'draw' });
    expect(draw.status).toBe(201);
    expect(draw.body.round).toMatchObject({ status: 'closed', winnerMaterialId: only.id });
    await suggest(member, groupId, 'Second material');
    await suggest(member, groupId, 'Third material');
    expect((await api(owner, 'POST', `/groups/${groupId}/rounds`, { mode: 'vote' })).status).toBe(201);
    const second = await api<{ error: string }>(owner, 'POST', `/groups/${groupId}/rounds`, { mode: 'draw' });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('A round is already open');
  });

  test('the owner cancels an open vote round and no material wins', async () => {
    const current = await api<{ round: { id: number; status: string } }>(owner, 'GET', `/groups/${groupId}/rounds/current`);
    expect(current.body.round.status).toBe('open');
    const cancel = await api<{ round: { status: string; winnerMaterialId: number | null } }>(owner, 'POST', `/groups/${groupId}/rounds/${current.body.round.id}/cancel`);
    expect(cancel.status).toBe(200);
    expect(cancel.body.round).toMatchObject({ status: 'closed', winnerMaterialId: null });
    expect((await api(owner, 'POST', `/groups/${groupId}/rounds/${current.body.round.id}/cancel`)).status).toBe(409);
  });

  test('a member can suggest at most 20 materials per day in a group', async () => {
    const already = (await api<{ materials: { mine: boolean }[] }>(member, 'GET', `/groups/${groupId}/materials`)).body.materials.filter((material) => material.mine).length;
    for (let index = already; index < 20; index += 1) await suggest(member, groupId, `Daily ${index}`);
    const over = await api<{ error: string }>(member, 'POST', `/groups/${groupId}/materials`, { type: 'other', title: 'One too many' });
    expect(over.status).toBe(429);
    expect(over.body.error).toBe('You can suggest at most 20 materials per day in a group');
  });
});

test('signing out ends the session on the server, so the old cookie stops working', async ({ browser }) => {
  const page = await sessionFor(browser, freshUser('SignOut'));
  const cookie = (await page.context().cookies()).find((item) => item.name === '__Host-sg_session')!;
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect.poll(async () => (await page.context().cookies()).some((item) => item.name === '__Host-sg_session')).toBe(false);
  const replay = await browser.newContext();
  await replay.addCookies([{ ...cookie }]);
  const replayPage = await replay.newPage();
  await replayPage.goto('/study-groups');
  expect((await api<{ user: unknown }>(replayPage, 'GET', '/me')).body.user).toBeNull();
  expect((await api(replayPage, 'PATCH', '/me', { displayName: 'Replayed' })).status).toBe(401);
  await replay.close();
  await page.context().close();
});

test.describe('bans', () => {
  let admin: Page;
  test.beforeAll(async ({ browser }) => {
    admin = await sessionFor(browser, users.admin);
  });
  test.afterAll(async () => {
    await admin.context().close();
  });

  test('renewing a ban keeps the user banned for 2 more years and logs the renewal', async ({ browser }) => {
    const person = freshUser('Renewed');
    const page = await sessionFor(browser, person);
    const id = (await api<{ user: { id: string } }>(page, 'GET', '/me')).body.user.id;
    await page.context().close();
    expect((await api(admin, 'POST', `/admin/users/${id}/ban`, { reason: 'First ban for the renewal check' })).status).toBe(204);
    expect((await api(admin, 'POST', `/admin/users/${id}/ban/renew`, { reason: 'short' })).status).toBe(400);
    expect((await api(admin, 'POST', `/admin/users/${id}/ban/renew`, { reason: 'Renewed after reviewing the appeal' })).status).toBe(204);
    const { users: found } = (await api<{ users: { id: string; ban: { reason: string; expiresAt: string } | null }[] }>(admin, 'GET', `/admin/users?q=${id}`)).body;
    expect(found[0].ban?.reason).toBe('Renewed after reviewing the appeal');
    const years = (Date.parse(found[0].ban!.expiresAt) - Date.now()) / (365.25 * 86_400_000);
    expect(years).toBeGreaterThan(1.99);
    expect(years).toBeLessThan(2.01);
    const log = (await api<{ actions: { action: string; targetId: string; reason: string }[] }>(admin, 'GET', '/admin/moderation-log')).body.actions;
    expect(log.find((entry) => entry.action === 'renew_ban' && entry.targetId === id)?.reason).toBe('Renewed after reviewing the appeal');
  });

  test('a platform admin cannot be banned', async () => {
    const id = (await api<{ user: { id: string } }>(admin, 'GET', '/me')).body.user.id;
    const result = await api<{ error: string }>(admin, 'POST', `/admin/users/${id}/ban`, { reason: 'Trying to ban the platform admin' });
    expect(result.status).toBe(409);
  });
});

test('the data export includes the email preference and the emails sent', async ({ browser }) => {
  const owner = await sessionFor(browser, freshUser('ExportOwner'));
  const person: TestUser = freshUser('ExportMember');
  const member = await sessionFor(browser, person);
  const group = await createGroupViaApi(owner, groupInput('Export emails', { listed: false }));
  await joinAndApprove(member, owner, group.id, group.accessCode);
  expect((await api(member, 'PUT', '/me/notifications', { emailEnabled: false })).status).toBe(200);
  const data = (await api<{ emailPreferences: { emailEnabled: boolean }; emails: { kind: string; groupId: string; status: string }[] }>(member, 'GET', '/me/export')).body;
  expect(data.emailPreferences).toEqual({ emailEnabled: false });
  expect(data.emails).toEqual([expect.objectContaining({ kind: 'join_approved', groupId: group.id, status: 'sent' })]);
  expect(JSON.stringify(data)).not.toContain('ExportOwner');
  for (const page of [owner, member]) await page.context().close();
});
