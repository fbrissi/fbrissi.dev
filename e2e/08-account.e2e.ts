import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { api, chooseFakeGoogleUser, createGroupViaApi, freshUser, groupInput, joinAndApprove, sessionFor, signInUrl, suggest, type TestUser } from './support';

test.describe.configure({ mode: 'serial' });

interface AccountExport {
  exportedAt: string;
  profile: { id: string; email: string; displayName: string };
  consents: { document: string; version: string; acceptedAt: string }[];
  ownedGroups: { id: string; name: string }[];
  memberships: { groupId: string }[];
  joinRequests: { groupId: string; status: string; message: string | null }[];
  suggestions: { groupId: string; title: string }[];
  votes: { groupId: string; materialId: number }[];
}

/** Profile, data export (2.4) and account deletion with anonymization (2.5, Q7, Q8). */
test.describe('account', () => {
  const user: TestUser = freshUser('Leaving');
  const ownedInput = groupInput('Owned by leaver');
  let host: Page;
  let leaving: Page;
  let peer: Page;
  let hostGroup = '';
  let ownedGroup = '';
  let materialId = 0;

  test.beforeAll(async ({ browser }) => {
    host = await sessionFor(browser, freshUser('Host'));
    leaving = await sessionFor(browser, user);
    peer = await sessionFor(browser, freshUser('OwnedPeer'));
    const group = await createGroupViaApi(host, groupInput('Hosted'));
    hostGroup = group.id;
    await joinAndApprove(leaving, host, hostGroup, group.accessCode);
    materialId = (await suggest(leaving, hostGroup, 'Leaver suggestion', 'https://example.test/leaver')).id;
    await suggest(host, hostGroup, 'Host suggestion', 'https://example.test/host');
    const round = await api<{ round: { id: number } }>(host, 'POST', `/groups/${hostGroup}/rounds`, { mode: 'vote' });
    expect((await api(leaving, 'POST', `/groups/${hostGroup}/rounds/${round.body.round.id}/votes`, { materialId })).status).toBe(201);

    const owned = await createGroupViaApi(leaving, ownedInput);
    ownedGroup = owned.id;
    await joinAndApprove(peer, leaving, ownedGroup, owned.accessCode);
  });

  test.afterAll(async () => {
    for (const page of [host, leaving, peer]) await page.context().close();
  });

  test('the user edits the display name (1–40 characters)', async () => {
    await leaving.goto('/study-groups/account');
    const field = leaving.getByLabel('Display name');
    await expect(field).toHaveValue(user.givenName);
    await field.fill('   ');
    await leaving.getByRole('button', { name: 'Save name' }).click();
    await expect(leaving.getByText('Use 1 to 40 characters.')).toBeVisible();
    expect((await api(leaving, 'PATCH', '/me', { displayName: 'x'.repeat(41) })).status).toBe(400);

    user.givenName = `Renamed ${user.givenName.split(' ')[1]}`;
    await field.fill(user.givenName);
    await leaving.getByRole('button', { name: 'Save name' }).click();
    await expect(leaving.getByText('Name saved.')).toBeVisible();
    expect((await api<{ user: { displayName: string } }>(leaving, 'GET', '/me')).body.user.displayName).toBe(user.givenName);
  });

  test('the user downloads a JSON export of their data (LGPD art. 18)', async () => {
    await leaving.goto('/study-groups/account');
    const downloadPromise = leaving.waitForEvent('download');
    await leaving.getByRole('link', { name: 'Download my data' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('study-groups-data.json');
    const data = JSON.parse(readFileSync(await download.path(), 'utf8')) as AccountExport;

    expect(data.profile).toMatchObject({ email: user.email, displayName: user.givenName });
    expect(data.consents.map((consent) => consent.document).sort()).toEqual(['privacy', 'terms']);
    expect(data.ownedGroups.map((group) => group.id)).toEqual([ownedGroup]);
    expect(data.memberships.map((membership) => membership.groupId)).toContain(hostGroup);
    expect(data.joinRequests.find((request) => request.groupId === hostGroup)?.status).toBe('approved');
    expect(data.suggestions.map((suggestion) => suggestion.title)).toEqual(['Leaver suggestion']);
    expect(data.votes).toEqual([expect.objectContaining({ groupId: hostGroup, materialId })]);
    // Only the user's own data: nothing about the other people in the group.
    expect(JSON.stringify(data)).not.toContain('Host suggestion');
    expect(JSON.stringify(data)).not.toMatch(/host-.*@example\.test/);
  });

  test('deleting the account warns about owned groups and needs an explicit confirmation (Q8)', async () => {
    await leaving.goto('/study-groups/account');
    await expect(leaving.getByText('These groups you own will be deleted too:')).toBeVisible();
    await expect(leaving.getByRole('listitem').filter({ hasText: ownedInput.name })).toBeVisible();
    const remove = leaving.getByRole('button', { name: 'Delete my account' });
    await expect(remove).toBeDisabled();
    expect((await api(leaving, 'DELETE', '/me', {})).status).toBe(400);

    await leaving.getByRole('checkbox', { name: /can't be undone|can’t be undone/ }).check();
    await remove.click();
    await leaving.waitForURL(/\/study-groups$/);
    expect((await api<{ user: unknown }>(leaving, 'GET', '/me')).body.user).toBeNull();
  });

  test('after deletion the owned groups are gone and memberships end', async () => {
    expect((await api(peer, 'GET', `/groups/${ownedGroup}`)).status).toBe(404);
    const myGroups = await api<{ groups: { id: string }[] }>(peer, 'GET', '/me/groups');
    expect(myGroups.body.groups.map((group) => group.id)).not.toContain(ownedGroup);
    expect((await (await peer.request.get('/api/study-group/groups')).json() as { groups: { id: string }[] }).groups.map((group) => group.id)).not.toContain(ownedGroup);

    const members = await api<{ members: { displayName: string }[] }>(host, 'GET', `/groups/${hostGroup}/members`);
    expect(members.body.members.map((member) => member.displayName)).not.toContain(user.givenName);
  });

  test('suggestions and votes left in other groups stay, shown as "Former member" (Q7)', async () => {
    await host.goto(`/study-groups/g/${hostGroup}`);
    const card = host.locator('article').filter({ hasText: 'Leaver suggestion' });
    await expect(card.getByText('Suggested by Former member')).toBeVisible();
    await expect(card).toContainText('Voted: Former member');
    await expect(host.locator('body')).not.toContainText(user.givenName);

    const round = await api<{ tally: { voters: string[] }[] }>(host, 'GET', `/groups/${hostGroup}/rounds/current`);
    expect(round.body.tally.flatMap((entry) => entry.voters)).toEqual(['Former member']);
  });

  test('signing in again with the same Google account starts a new account', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(signInUrl('/study-groups/my'));
    await chooseFakeGoogleUser(page, user);
    await expect(page).toHaveURL(/\/study-groups\/welcome$/);
    await context.close();
  });
});
