import { expect, test, type Page } from '@playwright/test';

import { api, chooseFakeGoogleUser, finishSignIn, groupInput, sessionFor, users } from './support';

test.describe.configure({ mode: 'serial' });

/** Create a group (3.1) → card on the landing (1.2) → join with a wrong then right code (3.2) → approval (3.3) → board (3.4). */
test.describe('group lifecycle', () => {
  const input = groupInput('Lifecycle');
  let owner: Page;
  let groupId = '';
  let accessCode = '';

  test.beforeAll(async ({ browser }) => {
    owner = await sessionFor(browser, users.owner);
  });

  test.afterAll(async () => {
    await owner.context().close();
  });

  test('the owner creates a group after confirming the content policy', async () => {
    await owner.goto('/study-groups/new');
    await expect(owner.getByRole('heading', { name: 'Create a group' })).toBeVisible();

    await owner.getByRole('button', { name: 'Create group' }).click();
    await expect(owner.getByText('Please fix the highlighted fields.')).toBeVisible();

    await owner.getByLabel('Group name').fill(input.name);
    await owner.getByLabel('Public summary').fill(input.summary);
    await owner.getByLabel('Rules').fill((input.rules ?? []).join('\n'));
    await owner.getByLabel('Meeting link (optional)').fill(input.meetingUrl ?? '');
    await owner.getByRole('button', { name: 'Create group' }).click();
    await expect(owner.getByText('Confirm that the group follows the content policy.')).toBeVisible();

    await owner.getByRole('checkbox', { name: /content policy/ }).check();
    await owner.getByRole('button', { name: 'Create group' }).click();

    await owner.waitForURL(/\/study-groups\/g\/[a-z0-9]+\/settings$/);
    groupId = owner.url().split('/g/')[1].split('/')[0];
    await expect(owner.getByRole('heading', { name: 'Group settings' })).toBeVisible();

    // The server generated the access code (Q13): random, at least 10 characters.
    accessCode = (await owner.locator('code[aria-label="Access code"]').textContent())?.trim() ?? '';
    expect(accessCode).toMatch(/^[A-Za-z0-9]{10,}$/);

    await owner.goto('/study-groups/my');
    const card = owner.getByRole('listitem').filter({ hasText: input.name });
    await expect(card.getByText('Owner', { exact: true })).toBeVisible();
    await expect(card.getByRole('link', { name: 'Settings' })).toBeVisible();
  });

  test('the landing page card shows only the name and summary (D3)', async ({ page }) => {
    await page.goto('/study-groups');
    const card = page.getByRole('listitem').filter({ hasText: input.name });
    await expect(card).toBeVisible();
    await expect(card).toContainText(input.summary);
    const text = (await card.textContent()) ?? '';
    for (const secret of [accessCode, input.meetingUrl ?? '', users.owner.givenName, users.owner.email, 'member']) {
      expect(text.toLowerCase()).not.toContain(secret.toLowerCase());
    }

    const publicList = await page.request.get('/api/study-group/groups');
    const listed = ((await publicList.json()) as { groups: Record<string, unknown>[] }).groups.find((group) => group.id === groupId);
    expect(Object.keys(listed ?? {}).sort()).toEqual(['id', 'name', 'summary']);
  });

  test('signed-out users clicking a card sign in first and land on the join screen (1.2, 3.2)', async ({ browser }) => {
    const context = await browser.newContext();
    const member = await context.newPage();
    await member.goto('/study-groups');
    await member.getByRole('link', { name: new RegExp(`: ${input.name}$`) }).click();
    await chooseFakeGoogleUser(member, users.member);
    await finishSignIn(member, `/study-groups/g/${groupId}`);
    await expect(member.getByRole('heading', { name: 'Ask to join' })).toBeVisible();
    await expect(member.getByRole('main')).not.toContainText(input.meetingUrl ?? '');

    // A wrong code fails with a generic error.
    await member.getByLabel('Group code').fill('wrong-code-123');
    await member.getByRole('button', { name: 'Send request' }).click();
    await expect(member.locator('#join-error')).toHaveText("That code didn't work. Check the latest code with the group.");

    // The right code creates a pending request with an optional message.
    await member.getByLabel('Group code').fill(accessCode);
    await member.getByLabel(/Message to the owner/).fill('Hi! I am Max from the meetup.');
    await member.getByRole('button', { name: 'Send request' }).click();
    await expect(member.getByText('Your request was sent.')).toBeVisible();

    // No duplicate request.
    const again = await api(member, 'POST', `/groups/${groupId}/join`, { code: accessCode });
    expect(again.status).toBe(409);

    // Still not a member: every group API answers 403 and the page keeps the pending state.
    expect((await api(member, 'GET', `/groups/${groupId}`)).status).toBe(403);
    expect((await api(member, 'GET', `/groups/${groupId}/materials`)).status).toBe(403);
    await member.reload();
    await expect(member.getByText('Your request was sent.')).toBeVisible();

    await member.goto('/study-groups/my');
    await expect(member.getByRole('heading', { name: 'Waiting for approval' })).toBeVisible();
    await expect(member.getByText(input.name)).toBeVisible();
    await context.close();
  });

  test('signed-out users can never submit a code', async ({ page }) => {
    await page.goto('/study-groups');
    const result = await api(page, 'POST', `/groups/${groupId}/join`, { code: accessCode });
    expect(result.status).toBe(401);
  });

  test('the owner sees the request with the name and message but never the email, and approves it', async () => {
    await owner.goto(`/study-groups/g/${groupId}/settings`);
    const requests = owner.locator('section[aria-labelledby="requests-title"]');
    await expect(requests.getByRole('button', { name: `Approve ${users.member.givenName}` })).toBeVisible();
    await expect(requests.getByText('Hi! I am Max from the meetup.')).toBeVisible();
    await expect(owner.locator('body')).not.toContainText(users.member.email);
    const raw = await api(owner, 'GET', `/groups/${groupId}/requests`);
    expect(JSON.stringify(raw.body)).not.toContain(users.member.email);

    await owner.getByRole('button', { name: `Approve ${users.member.givenName}` }).click();
    await expect(owner.getByText(`${users.member.givenName} is now a member.`)).toBeVisible();
    const members = owner.locator('section[aria-labelledby="members-settings-title"]');
    await expect(members.getByRole('listitem').filter({ hasText: users.member.givenName })).toBeVisible();
  });

  test('the approved member opens the board without the code (3.4)', async ({ browser }) => {
    const member = await sessionFor(browser, users.member, `/study-groups/g/${groupId}`);
    await expect(member.getByRole('main').getByRole('heading', { level: 1, name: input.name })).toBeVisible();
    await expect(member.getByText('Member', { exact: true })).toBeVisible();
    // The meeting link is visible to members only (Q9).
    await expect(member.getByRole('link', { name: /Join meeting/ })).toHaveAttribute('href', input.meetingUrl ?? '');
    for (const rule of input.rules ?? []) await expect(member.getByText(rule)).toBeVisible();

    const membersPanel = member.locator('section[aria-labelledby="members-title"]');
    await expect(membersPanel.getByText(users.owner.givenName)).toBeVisible();
    await expect(membersPanel.getByText(users.member.givenName)).toBeVisible();
    await expect(member.locator('body')).not.toContainText(users.owner.email);

    await member.goto('/study-groups/my');
    const card = member.getByRole('listitem').filter({ hasText: input.name });
    await expect(card.getByText('Member', { exact: true })).toBeVisible();
    await expect(card.getByRole('link', { name: 'Settings' })).toHaveCount(0);

    // A rejected user waits 7 days before asking the same group again.
    const outsider = await sessionFor(browser, users.outsider, `/study-groups/g/${groupId}`);
    expect((await api(outsider, 'POST', `/groups/${groupId}/join`, { code: accessCode })).status).toBe(201);
    const pending = await api<{ requests: { id: number }[] }>(owner, 'GET', `/groups/${groupId}/requests`);
    await owner.reload();
    await owner.getByRole('button', { name: `Reject ${users.outsider.givenName}` }).click();
    await expect(owner.getByText(`Rejected the request from ${users.outsider.givenName}.`)).toBeVisible();
    expect(pending.body.requests).toHaveLength(1);
    expect((await api(outsider, 'GET', `/groups/${groupId}`)).status).toBe(403);
    const again = await api<{ error: string }>(outsider, 'POST', `/groups/${groupId}/join`, { code: accessCode });
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/^Your request to join this group was not approved\. You can ask again after [A-Z][a-z]+ \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M \(Brasília time\)\.$/);

    await member.context().close();
    await outsider.context().close();
  });

  test('the owner can delete the group after confirming its name (4.5)', async ({ browser }) => {
    const doomed = groupInput('Doomed');
    const created = await api<{ group: { id: string } }>(owner, 'POST', '/groups', {
      ...doomed, meetingDay: 'Friday', meetingStart: '19:00', meetingEnd: '20:00', timezone: 'UTC', rules: [], acceptContentPolicy: true
    });
    expect(created.status).toBe(201);
    const id = created.body.group.id;

    await owner.goto(`/study-groups/g/${id}/settings`);
    const remove = owner.getByRole('button', { name: 'Delete group permanently' });
    await expect(remove).toBeDisabled();
    await owner.getByLabel(`Type “${doomed.name}” to confirm`).fill(doomed.name);
    await expect(owner.getByLabel(/^Reason/)).toHaveCount(0);
    await remove.click();
    await owner.waitForURL(/\/study-groups\/my$/);
    await expect(owner.getByText(doomed.name)).toHaveCount(0);

    expect((await api(owner, 'GET', `/groups/${id}`)).status).toBe(404);
    const visitor = await browser.newPage();
    await visitor.goto('/study-groups');
    await expect(visitor.getByRole('main')).toBeVisible();
    await expect(visitor.getByText(doomed.name)).toHaveCount(0);
    await visitor.close();
  });
});
