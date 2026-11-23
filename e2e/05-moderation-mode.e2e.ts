import { expect, test, type Page } from '@playwright/test';

import { api, createGroupViaApi, freshUser, groupInput, joinAndApprove, sessionFor, suggest } from './support';

test.describe.configure({ mode: 'serial' });

interface MaterialList {
  materials: { id: number; title: string; status: string }[];
}

/** Review-first vs free suggestions (D6, 4.2, Q15). */
test.describe('moderation mode', () => {
  let owner: Page;
  let author: Page;
  let peer: Page;
  let groupId = '';

  const titles = async (page: Page) => (await api<MaterialList>(page, 'GET', `/groups/${groupId}/materials`)).body.materials;

  test.beforeAll(async ({ browser }) => {
    owner = await sessionFor(browser, freshUser('ModOwner'));
    author = await sessionFor(browser, freshUser('Author'));
    peer = await sessionFor(browser, freshUser('Peer'));
    const group = await createGroupViaApi(owner, groupInput('Moderation'));
    groupId = group.id;
    await joinAndApprove(author, owner, groupId, group.accessCode);
    await joinAndApprove(peer, owner, groupId, group.accessCode);
  });

  test.afterAll(async () => {
    for (const page of [owner, author, peer]) await page.context().close();
  });

  test('in free mode a member suggestion appears right away', async () => {
    await author.goto(`/study-groups/g/${groupId}`);
    await author.getByLabel('Title').fill('Free mode talk');
    await author.getByRole('button', { name: 'Add suggestion' }).click();
    await expect(author.getByText('Added to the list.')).toBeVisible();
    expect((await titles(peer)).find((item) => item.title === 'Free mode talk')?.status).toBe('open');
  });

  test('the owner switches to review mode in the settings', async () => {
    await owner.goto(`/study-groups/g/${groupId}/settings`);
    await owner.getByLabel('Suggestions').selectOption('review');
    await owner.getByRole('button', { name: 'Save settings' }).click();
    await expect(owner.getByText('Settings saved.')).toBeVisible();

    await author.goto(`/study-groups/g/${groupId}`);
    await expect(author.getByText('Suggestions are reviewed')).toBeVisible();
  });

  test('in review mode the author sees the suggestion as pending and other members do not see it', async () => {
    await author.getByLabel('Title').fill('Pending podcast');
    await author.getByRole('button', { name: 'Add suggestion' }).click();
    await expect(author.getByText('Sent for review.')).toBeVisible();
    const card = author.locator('article').filter({ hasText: 'Pending podcast' });
    await expect(card.getByText('Pending review')).toBeVisible();

    expect((await titles(author)).find((item) => item.title === 'Pending podcast')?.status).toBe('pending');
    expect((await titles(peer)).map((item) => item.title)).not.toContain('Pending podcast');
    await peer.goto(`/study-groups/g/${groupId}`);
    await expect(peer.getByRole('heading', { name: 'Free mode talk' })).toBeVisible();
    await expect(peer.getByText('Pending podcast')).toHaveCount(0);
  });

  test("the owner's own suggestions skip review", async () => {
    const material = await suggest(owner, groupId, 'Owner pick');
    expect(material.status).toBe('open');
    expect((await titles(peer)).map((item) => item.title)).toContain('Owner pick');
  });

  test('the owner sees pending items and approves them', async () => {
    await owner.goto(`/study-groups/g/${groupId}`);
    const card = owner.locator('article').filter({ hasText: 'Pending podcast' });
    await expect(card.getByText('Pending review')).toBeVisible();
    await card.getByRole('button', { name: 'Approve' }).click();
    await expect(card.getByText('Pending review')).toHaveCount(0);
    expect((await titles(peer)).find((item) => item.title === 'Pending podcast')?.status).toBe('open');
  });

  test('members cannot approve pending items', async () => {
    const pending = await suggest(author, groupId, 'Second pending');
    expect(pending.status).toBe('pending');
    expect((await api(peer, 'POST', `/groups/${groupId}/materials/${pending.id}/approve`)).status).toBe(403);
    expect((await api(author, 'POST', `/groups/${groupId}/materials/${pending.id}/approve`)).status).toBe(403);
  });

  test('switching back to free mode keeps pending items pending and new suggestions go straight in', async () => {
    const { settings } = (await api<{ settings: Record<string, unknown> }>(owner, 'GET', `/groups/${groupId}/settings`)).body;
    const profile = Object.fromEntries(Object.entries(settings).filter(([key]) => key !== 'id' && key !== 'accessCode'));
    const saved = await api(owner, 'PUT', `/groups/${groupId}/settings`, { ...profile, moderationMode: 'free' });
    expect(saved.status).toBe(200);

    expect((await titles(owner)).find((item) => item.title === 'Second pending')?.status).toBe('pending');
    expect((await titles(peer)).map((item) => item.title)).not.toContain('Second pending');
    const fresh = await suggest(author, groupId, 'After free again');
    expect(fresh.status).toBe('open');
  });

  test('the owner can reject a pending item by deleting it', async () => {
    const pending = (await titles(owner)).find((item) => item.title === 'Second pending');
    expect((await api(owner, 'DELETE', `/groups/${groupId}/materials/${pending?.id}`, {})).status).toBe(204);
    expect((await titles(author)).map((item) => item.title)).not.toContain('Second pending');
  });
});
