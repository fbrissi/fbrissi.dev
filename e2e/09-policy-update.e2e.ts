import { DatabaseSync } from 'node:sqlite';

import { expect, test } from '@playwright/test';

import { api, createGroupViaApi, freshUser, groupInput, sessionFor, suggest } from './support';

// The local API's database (docker-compose.yml: STUDY_GROUP_DB_PATH), shared through the bind mount.
const databasePath = process.env.E2E_STUDY_GROUP_DB_PATH ?? 'tmp/study-group/local.sqlite';

/** A new policy version asks for re-acceptance at the next visit and blocks writes until then; reading stays allowed (Q18). */
test('an outdated policy acceptance blocks writes until the user accepts again', async ({ browser }) => {
  const page = await sessionFor(browser, freshUser('Outdated'));
  const group = await createGroupViaApi(page, groupInput('Policy update'));
  const userId = (await api<{ user: { id: string } }>(page, 'GET', '/me')).body.user.id;

  // Simulate a policy version bump by aging this user's acceptance.
  const database = new DatabaseSync(databasePath);
  database.prepare("UPDATE consents SET version = '2000-01-01' WHERE user_id = ?").run(userId);
  database.close();

  expect((await api<{ user: { needsConsent: boolean } }>(page, 'GET', '/me')).body.user.needsConsent).toBe(true);
  expect((await api(page, 'GET', `/groups/${group.id}`)).status).toBe(200);
  const blocked = await api<{ error: string }>(page, 'POST', `/groups/${group.id}/materials`, { type: 'article', title: 'Blocked' });
  expect(blocked).toEqual({ status: 403, body: { error: 'consent_required' } });

  await page.goto(`/study-groups/g/${group.id}`);
  const banner = page.getByRole('form', { name: 'We updated our Terms and Privacy Policy' }).or(page.locator('form[aria-labelledby="consent-title"]'));
  await expect(banner).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Open materials' })).toBeVisible();
  for (const box of await banner.getByRole('checkbox').all()) await expect(box).not.toBeChecked();

  await banner.getByRole('button', { name: 'Accept and continue' }).click();
  await expect(banner.getByText('Check both boxes to continue.')).toBeVisible();
  await banner.getByRole('checkbox', { name: /Terms of Use/ }).check();
  await banner.getByRole('checkbox', { name: /Privacy Policy/ }).check();
  await banner.getByRole('button', { name: 'Accept and continue' }).click();
  await expect(banner).toBeHidden();

  expect((await suggest(page, group.id, 'Allowed again')).status).toBe('open');
  await page.context().close();
});
