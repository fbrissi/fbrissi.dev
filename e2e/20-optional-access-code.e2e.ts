import { expect, test } from '@playwright/test';

import { api, createGroupViaApi, freshUser, groupInput, groupUrl, sessionFor } from './support';

// e2e/features/groups.feature: the owner chooses whether a join request needs the access code; the owner approves every request.
test.describe('optional access code', () => {
  test('a signed-in user asks to join an open group without an access code', async ({ browser }) => {
    const owner = await sessionFor(browser, freshUser('OpenOwner'));
    const { id } = await createGroupViaApi(owner, groupInput('Open group', { requiresAccessCode: false }));
    const requester = await sessionFor(browser, freshUser('OpenRequester'), groupUrl(id));

    await expect(requester.getByRole('heading', { name: 'Ask to join' })).toBeVisible();
    await expect(requester.getByLabel('Access code')).toHaveCount(0);
    await expect(requester.getByText(/only accepts requests with an access code/)).toHaveCount(0);
    await requester.getByLabel(/Message to the owner/).fill('Hi! I found you on the landing page.');
    await requester.getByRole('button', { name: 'Send request' }).click();
    await expect(requester.getByText('Your request was sent.')).toBeVisible();
    expect((await api(requester, 'GET', `/groups/${id}`)).status).toBe(403);

    const requests = await api<{ requests: { id: number; message: string | null }[] }>(owner, 'GET', `/groups/${id}/requests`);
    expect(requests.body.requests.map((request) => request.message)).toEqual(['Hi! I found you on the landing page.']);
    expect((await api(owner, 'POST', `/groups/${id}/requests/${requests.body.requests[0].id}/approve`)).status).toBe(204);
    expect((await api(requester, 'GET', `/groups/${id}`)).status).toBe(200);

    await owner.context().close();
    await requester.context().close();
  });

  test('a group that requires an access code shows the notice on the join screen and the badge on its landing card', async ({ browser, page }) => {
    const owner = await sessionFor(browser, freshUser('CodeOwner'));
    const closed = groupInput('Code group');
    const open = groupInput('Open card', { requiresAccessCode: false });
    const { id } = await createGroupViaApi(owner, closed);
    await createGroupViaApi(owner, open);
    await owner.context().close();

    await page.goto('/study-groups');
    const closedCard = page.getByRole('listitem').filter({ hasText: closed.name });
    const openCard = page.getByRole('listitem').filter({ hasText: open.name });
    await expect(closedCard.getByText('Access code required')).toBeVisible();
    await expect(openCard).toBeVisible();
    await expect(openCard.getByText('Access code required')).toHaveCount(0);

    const requester = await sessionFor(browser, freshUser('CodeRequester'), groupUrl(id));
    await expect(requester.getByText("This group only accepts requests with an access code, by its creator's choice. Ask the group for it.")).toBeVisible();
    await expect(requester.getByLabel('Access code')).toBeVisible();
    await requester.getByRole('button', { name: 'Send request' }).click();
    await expect(requester.locator('#join-error')).toHaveText('Please enter the access code.');
    expect((await api(requester, 'POST', `/groups/${id}/join`, {})).status).toBe(403);
    await requester.context().close();
  });
});
