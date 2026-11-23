import { expect, test, type Page } from '@playwright/test';

import { answerReasonDialog, api, createGroupViaApi, freshUser, groupInput, sessionFor, suggest, users, type GroupInput } from './support';

test.describe.configure({ mode: 'serial' });

interface LogResponse {
  actions: { id: number; action: string; targetType: string; targetId: string; groupId: string | null; label: string; reason: string; actorName: string | null; createdAt: string }[];
}

/** Platform admin moderation (D7, 5.2–5.5, Q5, Q6, Q14). */
test.describe('platform admin', () => {
  const kept: GroupInput = groupInput('Moderated', { listed: false });
  const doomed: GroupInput = groupInput('Removed by admin');
  let admin: Page;
  let owner: Page;
  let applicant: Page;
  let keptId = '';
  let doomedId = '';
  let materialId = 0;

  const materialReason = 'Spam link that breaks the content policy';
  const messageReason = 'Personal data in the join request message';
  const groupReason = 'Group used for unrelated self-promotion';

  test.beforeAll(async ({ browser }) => {
    admin = await sessionFor(browser, users.admin);
    owner = await sessionFor(browser, freshUser('AdminTarget'));
    applicant = await sessionFor(browser, freshUser('Applicant'));
    const group = await createGroupViaApi(owner, kept);
    keptId = group.id;
    doomedId = (await createGroupViaApi(owner, doomed)).id;
    materialId = (await suggest(owner, keptId, 'Buy cheap followers', 'https://spam.example.test/')).id;
    expect((await api(applicant, 'POST', `/groups/${keptId}/join`, { code: group.accessCode, message: 'Call me at +55 11 99999-9999' })).status).toBe(201);
  });

  test.afterAll(async () => {
    for (const page of [admin, owner, applicant]) await page.context().close();
  });

  test('only the allowlisted admin sees the moderation view, which lists every group including unlisted ones', async () => {
    await owner.goto('/study-groups/admin');
    await expect(owner.getByText('Only the platform admin can open this page.')).toBeVisible();
    await expect(owner.getByRole('link', { name: 'Admin' })).toHaveCount(0);

    await admin.goto('/study-groups/my');
    await admin.getByRole('link', { name: 'Admin', exact: true }).click();
    await expect(admin.getByRole('heading', { name: 'Moderation', exact: true })).toBeVisible();
    const row = admin.getByRole('listitem').filter({ hasText: kept.name });
    await expect(row).toContainText('unlisted');
    await expect(row).toContainText('Owner: AdminTarget');
    await expect(admin.getByRole('listitem').filter({ hasText: 'DevTalk' })).toBeVisible();
  });

  test('the admin opens any group board and settings without being a member', async () => {
    await admin.goto(`/study-groups/g/${keptId}`);
    await expect(admin.getByRole('main').getByRole('heading', { level: 1, name: kept.name })).toBeVisible();
    await expect(admin.getByText('Platform admin', { exact: true })).toBeVisible();
    await expect(admin.getByRole('link', { name: /Join meeting/ })).toBeVisible();

    await admin.getByRole('link', { name: 'Group settings' }).click();
    await expect(admin.getByText('You are moderating this group as the platform admin. Deletions need a reason and are logged.')).toBeVisible();
    await expect(admin.locator('code[aria-label="Access code"]')).toBeVisible();
  });

  test('deleting a material needs a 10–500 character reason (API)', async () => {
    const path = `/groups/${keptId}/materials/${materialId}`;
    expect((await api(admin, 'DELETE', path, {})).status).toBe(400);
    const short = await api<{ error: string }>(admin, 'DELETE', path, { reason: 'too short' });
    expect(short).toMatchObject({ status: 400, body: { error: 'A reason of 10 to 500 characters is required.' } });
    expect((await api(admin, 'DELETE', path, { reason: 'x'.repeat(501) })).status).toBe(400);
    expect((await api(admin, 'DELETE', `/groups/${keptId}/requests/1/message`, {})).status).toBe(400);
    expect((await api(admin, 'DELETE', `/groups/${doomedId}`, { confirmName: doomed.name })).status).toBe(400);
    expect((await api(admin, 'GET', `/groups/${doomedId}`)).status).toBe(200);
  });

  test('the admin deletes a material with a reason from the board', async () => {
    await admin.goto(`/study-groups/g/${keptId}`);
    // Cancelling the reason dialog deletes nothing; a short reason is refused inline.
    await admin.getByRole('button', { name: 'Delete “Buy cheap followers”' }).click();
    const dialog = admin.getByRole('dialog', { name: 'Delete “Buy cheap followers” permanently?' });
    await expect(dialog).toContainText('This can’t be undone.');
    await dialog.getByLabel(/^Reason/).fill('too short');
    await dialog.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('A reason of 10 to 500 characters is required.');
    await answerReasonDialog(admin, null);
    await expect(admin.getByRole('heading', { name: 'Buy cheap followers' })).toBeVisible();

    await admin.getByRole('button', { name: 'Delete “Buy cheap followers”' }).click();
    await answerReasonDialog(admin, materialReason);
    await expect(admin.getByRole('heading', { name: 'Buy cheap followers' })).toHaveCount(0);
    await expect(admin.getByRole('status').filter({ hasText: '“Buy cheap followers” was deleted permanently.' })).toBeVisible();
  });

  test('the admin deletes a join request message with a reason', async () => {
    await admin.goto(`/study-groups/g/${keptId}/settings`);
    const name = (await api<{ user: { displayName: string } }>(applicant, 'GET', '/me')).body.user.displayName;
    await admin.getByRole('button', { name: `Delete message from ${name}` }).click();
    await answerReasonDialog(admin, messageReason);
    await expect(admin.getByText('Message deleted.')).toBeVisible();
    await expect(admin.getByText('Call me at +55 11 99999-9999')).toHaveCount(0);

    // The owner can't delete join request messages.
    await owner.goto(`/study-groups/g/${keptId}/settings`);
    await expect(owner.getByRole('button', { name: /Delete message from/ })).toHaveCount(0);
  });

  test('the admin deletes a whole group with a reason', async ({ browser }) => {
    await admin.goto(`/study-groups/g/${doomedId}/settings`);
    await admin.getByLabel(`Type “${doomed.name}” to confirm`).fill(doomed.name);
    await admin.getByRole('button', { name: 'Delete group permanently' }).click();
    await answerReasonDialog(admin, groupReason);
    await admin.waitForURL(/\/study-groups\/admin$/);
    await expect(admin.getByRole('status').filter({ hasText: `“${doomed.name}” was deleted permanently.` })).toBeVisible();
    await expect(admin.getByRole('region', { name: 'All groups' }).getByRole('listitem').filter({ hasText: doomed.name })).toHaveCount(0);

    expect((await api(owner, 'GET', `/groups/${doomedId}`)).status).toBe(404);
    const visitor = await browser.newPage();
    await visitor.goto('/study-groups');
    await expect(visitor.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    await expect(visitor.getByText(doomed.name)).toHaveCount(0);
    await visitor.close();
  });

  test('the moderation log lists every deletion newest first with actor, target, label and reason', async () => {
    const log = await api<LogResponse>(admin, 'GET', '/admin/moderation-log');
    expect(log.status).toBe(200);
    const mine = log.body.actions.filter((action) => action.groupId === keptId || action.groupId === doomedId);
    expect(mine.map((action) => action.action)).toEqual(['delete_group', 'delete_join_message', 'delete_material']);
    expect(mine[0]).toMatchObject({ targetType: 'group', targetId: doomedId, label: doomed.name, reason: groupReason, actorName: users.admin.givenName });
    // The log keeps a neutral label, never the removed message (Q6).
    expect(mine[1]).toMatchObject({ targetType: 'join_request', label: `Join request #${mine[1].targetId}`, reason: messageReason });
    expect(JSON.stringify(log.body)).not.toContain('99999-9999');
    expect(mine[2]).toMatchObject({ targetType: 'material', targetId: String(materialId), label: 'Buy cheap followers', reason: materialReason });
    const times = log.body.actions.map((action) => action.createdAt);
    expect([...times].sort().reverse()).toEqual(times);

    await admin.goto('/study-groups/admin');
    const entries = admin.locator('section[aria-labelledby="log-title"] li');
    await expect(entries.first()).toContainText(groupReason);
    await expect(admin.getByText(`Reason: ${materialReason}`)).toBeVisible();

    expect((await api(owner, 'GET', '/admin/moderation-log')).status).toBe(403);
  });

  test('the owner sees the admin deletions and reasons in My groups and in the settings (Q5)', async () => {
    await owner.goto('/study-groups/my');
    const notices = owner.locator('section[aria-labelledby="notices-title"]');
    await expect(notices.getByRole('heading', { name: 'Moderation notices' })).toBeVisible();
    await expect(notices).toContainText(`Group deleted: “${doomed.name}”`);
    await expect(notices).toContainText(`Reason: ${groupReason}`);
    await expect(notices).toContainText('Material deleted: “Buy cheap followers”');
    await expect(notices).toContainText(`Reason: ${materialReason}`);

    await owner.goto(`/study-groups/g/${keptId}/settings`);
    await expect(owner.locator('section[aria-labelledby="notices-title"]')).toContainText(`Reason: ${materialReason}`);
  });

  test('deletions are permanent: there is nothing to restore (no soft delete)', async () => {
    await owner.goto(`/study-groups/g/${keptId}/settings`);
    await expect(owner.getByRole('heading', { name: 'Deleted materials' })).toHaveCount(0);
    expect((await api(admin, 'POST', `/groups/${keptId}/materials/${materialId}/restore`)).status).toBe(404);
    expect((await api(owner, 'GET', `/groups/${keptId}/materials/deleted`)).status).toBe(404);
    expect((await api<{ materials: { id: number }[] }>(owner, 'GET', `/groups/${keptId}/materials`)).body.materials.map((item) => item.id)).not.toContain(materialId);
    expect((await api(admin, 'GET', `/groups/${doomedId}/settings`)).status).toBe(404);
  });

  test("the admin's own group needs no reason (owner role wins)", async () => {
    const own = await createGroupViaApi(admin, groupInput('Admin own'));
    const material = await suggest(admin, own.id, 'Own material');
    expect((await api(admin, 'DELETE', `/groups/${own.id}/materials/${material.id}`, {})).status).toBe(204);
    expect((await api(admin, 'DELETE', `/groups/${own.id}`, { confirmName: (await api<{ group: { name: string } }>(admin, 'GET', `/groups/${own.id}`)).body.group.name })).status).toBe(204);
  });
});
