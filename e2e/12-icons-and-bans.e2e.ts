import { expect, test, type Page } from '@playwright/test';

import { answerReasonDialog, api, createGroupViaApi, freshUser, groupInput, joinAndApprove, sessionFor, signInUrl, chooseFakeGoogleUser, users, type TestUser } from './support';

const mailpitUrl = process.env.E2E_MAILPIT_URL ?? 'http://mailpit:8025';
// A valid 1 × 1 PNG with a text chunk ("Comment: secret-location"), which the upload must strip.
const pngWithText = Buffer.concat([
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ', 'base64'),
  Buffer.from([0, 0, 0, 23]), Buffer.from('tEXtComment\0secret-location'), Buffer.from([0, 0, 0, 0]),
  Buffer.from('AAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
]);

async function waitForSubject(user: TestUser, subject: RegExp): Promise<string> {
  let text = '';
  await expect.poll(async () => {
    const search = await (await fetch(`${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"${user.email}"`)}`)).json() as { messages: { ID: string; Subject: string }[] };
    const found = search.messages.find((message) => subject.test(message.Subject));
    if (found) text = ((await (await fetch(`${mailpitUrl}/api/v1/message/${found.ID}`)).json()) as { Text: string }).Text;
    return Boolean(found);
  }, { timeout: 15_000 }).toBe(true);
  return text;
}

async function iconSrc(page: Page): Promise<string> {
  const image = page.getByRole('main').locator('img[src*="/api/study-group/icons/"]').first();
  await expect(image).toBeVisible();
  return (await image.getAttribute('src'))!;
}

test.describe('group icons', () => {
  test.describe.configure({ mode: 'serial' });
  const owner = freshUser('IconOwner');
  const input = groupInput('Icon group');
  let ownerPage: Page;
  let memberPage: Page;
  let groupId = '';

  test.beforeAll(async ({ browser }) => {
    ownerPage = await sessionFor(browser, owner);
    memberPage = await sessionFor(browser, freshUser('IconMember'));
    const group = await createGroupViaApi(ownerPage, input);
    groupId = group.id;
    await joinAndApprove(memberPage, ownerPage, groupId, group.accessCode);
  });

  test.afterAll(async () => {
    for (const page of [ownerPage, memberPage]) await page.context().close();
  });

  test('the owner uploads an icon; members see it through a signed link, the public page never', async () => {
    await ownerPage.goto(`/study-groups/g/${groupId}/settings`);
    const section = ownerPage.getByRole('region', { name: 'Group icon' });
    await section.locator('input[type="file"]').setInputFiles({ name: 'icon.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') });
    await expect(section.getByText('Use a PNG, JPEG or WebP image.')).toBeVisible();
    await section.locator('input[type="file"]').setInputFiles({ name: 'icon.png', mimeType: 'image/png', buffer: pngWithText });
    await expect(section.getByText('Icon saved.')).toBeVisible();

    await memberPage.goto(`/study-groups/g/${groupId}`);
    const src = await iconSrc(memberPage);
    expect(src).toMatch(/\?exp=\d+&sig=/);
    const served = await memberPage.request.get(src);
    expect(served.status()).toBe(200);
    expect(served.headers()['content-type']).toBe('image/png');
    expect((await served.body()).toString('latin1')).not.toContain('secret-location');
    const forged = await memberPage.request.get(src.replace(/sig=[^&]+/, 'sig=forged'));
    expect(forged.status()).toBe(403);

    await memberPage.goto('/study-groups/my');
    await iconSrc(memberPage);
    const publicList = await memberPage.request.get('/api/study-group/groups');
    expect(JSON.stringify(await publicList.json())).not.toMatch(/iconUrl|\/icons\//);
  });

  test('the platform admin removes the icon with a reason; the owner gets a notice and an email', async ({ browser }) => {
    const admin = await sessionFor(browser, users.admin);
    await admin.goto(`/study-groups/g/${groupId}/settings`);
    await admin.getByRole('region', { name: 'Group icon' }).getByRole('button', { name: 'Remove icon' }).click();
    await answerReasonDialog(admin, 'Political propaganda image');
    await expect(admin.getByText('Icon removed.')).toBeVisible();
    const text = await waitForSubject(owner, new RegExp(`The icon of your group ${input.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} was removed`));
    expect(text).toContain('Reason: Political propaganda image');
    await ownerPage.goto('/study-groups/my');
    await expect(ownerPage.locator('section[aria-labelledby="notices-title"]')).toContainText('Group icon removed');
    await admin.context().close();
  });
});

test.describe('account bans', () => {
  test.describe.configure({ mode: 'serial' });
  const banned = freshUser('Banned');
  let bannedPage: Page;
  let adminPage: Page;
  let bannedId = '';

  test.beforeAll(async ({ browser }) => {
    bannedPage = await sessionFor(browser, banned);
    await createGroupViaApi(bannedPage, groupInput('Doomed by ban'));
    bannedId = (await api<{ user: { id: string } }>(bannedPage, 'GET', '/me')).body.user.id;
    adminPage = await sessionFor(browser, users.admin);
  });

  test.afterAll(async () => {
    for (const page of [bannedPage, adminPage]) await page.context().close();
  });

  test('the admin finds the user and bans them with a reason; their groups go and sign-in is refused', async ({ browser }) => {
    await adminPage.goto('/study-groups/admin');
    const section = adminPage.getByRole('region', { name: 'Users' });
    await section.getByLabel('Search users').fill(banned.email);
    await section.getByRole('button', { name: 'Search' }).click();
    await expect(section.getByText(bannedId)).toBeVisible();
    await expect(section).not.toContainText(banned.email);
    await section.getByRole('button', { name: `Ban ${banned.givenName}` }).click();
    await answerReasonDialog(adminPage, 'Repeated political propaganda');
    await expect(section.getByText(`${banned.givenName} is banned.`)).toBeVisible();
    await expect(section.getByText(/Banned .*, until .*\d{4}: Repeated political propaganda/)).toBeVisible();
    // The new Unban button has the focus, and the moderation log shows the ban without a reload.
    await expect(section.getByRole('button', { name: `Unban ${banned.givenName}` })).toBeFocused();
    await expect(adminPage.getByRole('region', { name: 'Moderation log' }).getByText(/Account banned · user/).first()).toBeVisible();

    expect((await api<{ user: unknown }>(bannedPage, 'GET', '/me')).body.user).toBeNull();
    expect((await api<{ groups: unknown[] }>(adminPage, 'GET', `/admin/users?q=${bannedId}`)).body).toMatchObject({ users: [{ ownedGroups: 0 }] });
    const text = await waitForSubject(banned, /was deleted$/);
    expect(text).toContain('Reason: Repeated political propaganda');
    const notice = await waitForSubject(banned, /Your English Study Groups account was banned$/);
    expect(notice).toContain('Reason: Repeated political propaganda');
    expect(notice).toContain('If you think this is a mistake, reply to this email or write to groups@fbrissi.dev');

    const page = await (await browser.newContext()).newPage();
    await page.goto(signInUrl('/study-groups/my'));
    await chooseFakeGoogleUser(page, banned);
    await page.waitForURL(/\/study-groups\?signin=banned$/);
    await expect(page.getByText(/This Google account is banned from the study groups/)).toBeVisible();
    await page.context().close();
  });

  test('the admin lifts the ban with a reason; the user can sign in again', async ({ browser }) => {
    await adminPage.goto('/study-groups/admin');
    const section = adminPage.getByRole('region', { name: 'Users' });
    await section.getByLabel('Search users').fill(bannedId);
    await section.getByRole('button', { name: 'Search' }).click();
    await section.getByRole('button', { name: `Unban ${banned.givenName}` }).click();
    await answerReasonDialog(adminPage, 'Appeal accepted after review');
    await expect(section.getByText(`${banned.givenName} is no longer banned.`)).toBeVisible();
    const restored = await waitForSubject(banned, /Your English Study Groups account was restored$/);
    expect(restored).toContain('You can sign in again.');
    const page = await sessionFor(browser, banned);
    expect((await api<{ user: { id: string } }>(page, 'GET', '/me')).body.user.id).toBe(bannedId);
    await page.context().close();
  });
});
