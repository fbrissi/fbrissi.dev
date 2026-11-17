import { expect, test, type Page } from '@playwright/test';

import { acceptNextDialog, api, createGroupViaApi, freshUser, groupInput, joinAndApprove, sessionFor, suggest, type GroupInput } from './support';

test.describe.configure({ mode: 'serial' });

/** Code rotation (4.3, Q13), leaving and removing members (3.5, Q7, Q16) and the unlisted toggle (Q3). */
test.describe('access code and membership', () => {
  const input: GroupInput = groupInput('Membership');
  let owner: Page;
  let leaver: Page;
  let removed: Page;
  let pending: Page;
  let groupId = '';
  let oldCode = '';
  let newCode = '';

  test.beforeAll(async ({ browser }) => {
    owner = await sessionFor(browser, freshUser('MemOwner'));
    leaver = await sessionFor(browser, freshUser('Leaver'));
    removed = await sessionFor(browser, freshUser('Removed'));
    pending = await sessionFor(browser, freshUser('Pending'));
    const group = await createGroupViaApi(owner, input);
    groupId = group.id;
    oldCode = group.accessCode;
    await joinAndApprove(leaver, owner, groupId, oldCode);
    await joinAndApprove(removed, owner, groupId, oldCode);
    expect((await api(pending, 'POST', `/groups/${groupId}/join`, { code: oldCode, message: 'Before rotation' })).status).toBe(201);
  });

  test.afterAll(async () => {
    for (const page of [owner, leaver, removed, pending]) await page.context().close();
  });

  test('the owner rotates the code; the old code stops working, members and pending requests stay', async ({ browser }) => {
    await owner.goto(`/study-groups/g/${groupId}/settings`);
    const code = owner.locator('code[aria-label="Access code"]');
    await expect(code).toHaveText(oldCode);

    // Cancelling the confirmation keeps the code.
    owner.once('dialog', (dialog) => void dialog.dismiss());
    await owner.getByRole('button', { name: 'Create a new code' }).click();
    await expect(code).toHaveText(oldCode);

    acceptNextDialog(owner);
    await owner.getByRole('button', { name: 'Create a new code' }).click();
    await expect(owner.getByText('New code created.')).toBeVisible();
    newCode = (await code.textContent())?.trim() ?? '';
    expect(newCode).not.toBe(oldCode);
    expect(newCode).toMatch(/^[A-Za-z0-9]{10,}$/);

    const latecomer = await sessionFor(browser, freshUser('Latecomer'));
    expect((await api(latecomer, 'POST', `/groups/${groupId}/join`, { code: oldCode })).status).toBe(403);
    expect((await api(latecomer, 'POST', `/groups/${groupId}/join`, { code: newCode })).status).toBe(201);
    await latecomer.context().close();

    expect((await api(leaver, 'GET', `/groups/${groupId}`)).status).toBe(200);
    const requests = await api<{ requests: { message: string | null }[] }>(owner, 'GET', `/groups/${groupId}/requests`);
    expect(requests.body.requests.map((request) => request.message)).toContain('Before rotation');
  });

  test('a member leaves the group and loses access', async () => {
    await leaver.goto(`/study-groups/g/${groupId}`);
    acceptNextDialog(leaver);
    await leaver.getByRole('button', { name: 'Leave group' }).click();
    await leaver.waitForURL(/\/study-groups\/my$/);
    await expect(leaver.getByText(input.name)).toHaveCount(0);
    expect((await api(leaver, 'GET', `/groups/${groupId}`)).status).toBe(403);
    await leaver.goto(`/study-groups/g/${groupId}`);
    await expect(leaver.getByRole('heading', { name: 'Ask to join' })).toBeVisible();
  });

  test('the owner cannot leave, only delete the group (Q16)', async () => {
    expect((await api(owner, 'POST', `/groups/${groupId}/leave`)).status).toBe(409);
  });

  test('the owner removes a member: access ends at once and the content keeps their name (Q7)', async () => {
    const removedName = (await api<{ user: { displayName: string } }>(removed, 'GET', '/me')).body.user.displayName;
    await suggest(removed, groupId, 'Kept after removal');

    await owner.goto(`/study-groups/g/${groupId}/settings`);
    const members = owner.locator('section[aria-labelledby="members-settings-title"]');
    acceptNextDialog(owner);
    await members.getByRole('button', { name: `Remove ${removedName}` }).click();
    await expect(members.getByText(removedName)).toHaveCount(0);

    expect((await api(removed, 'GET', `/groups/${groupId}`)).status).toBe(403);
    expect((await api(removed, 'GET', `/groups/${groupId}/materials`)).status).toBe(403);

    await owner.goto(`/study-groups/g/${groupId}`);
    const card = owner.locator('article').filter({ hasText: 'Kept after removal' });
    await expect(card.getByText(`Suggested by ${removedName}`)).toBeVisible();
  });

  test('an unlisted group disappears from the landing page and comes back when listed again', async ({ browser }) => {
    const visitor = await browser.newPage();
    await visitor.goto('/study-groups');
    await expect(visitor.getByRole('heading', { name: input.name })).toBeVisible();

    await owner.goto(`/study-groups/g/${groupId}/settings`);
    const listed = owner.getByRole('checkbox', { name: /List this group on the public study groups page/ });
    await expect(listed).toBeChecked();
    await listed.uncheck();
    await owner.getByRole('button', { name: 'Save settings' }).click();
    await expect(owner.getByText('Settings saved.')).toBeVisible();

    const publicGroups = async () => ((await (await visitor.request.get('/api/study-group/groups')).json()) as { groups: { id: string }[] }).groups.map((group) => group.id);
    expect(await publicGroups()).not.toContain(groupId);
    await visitor.reload();
    await expect(visitor.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    await expect(visitor.getByRole('heading', { name: input.name })).toHaveCount(0);

    // Unlisted groups still work for members and for joining by link + code.
    expect((await api(owner, 'GET', `/groups/${groupId}`)).status).toBe(200);
    expect((await api(pending, 'GET', `/groups/${groupId}/preview`)).status).toBe(200);

    await listed.check();
    await owner.getByRole('button', { name: 'Save settings' }).click();
    await expect(owner.getByText('Settings saved.')).toBeVisible();
    expect(await publicGroups()).toContain(groupId);
    await visitor.reload();
    await expect(visitor.getByRole('heading', { name: input.name })).toBeVisible();
    await visitor.close();
  });
});
