import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { api, sessionFor, users } from './support';

// docker-compose.yml builds the local stack with STUDY_GROUP_SLUG=local.
const legacySlug = process.env.E2E_LEGACY_SLUG ?? 'local';

test.describe('old secret-slug URL (Q21)', () => {
  test('the old board URL redirects permanently to the DevTalk group page', async ({ request }) => {
    const response = await request.get(`/study-group/${legacySlug}`, { maxRedirects: 0 });
    expect([301, 308]).toContain(response.status());
    expect(response.headers().location).toBe('/study-groups/g/devtalk');
  });

  test('the old settings URL redirects permanently to the DevTalk settings page', async ({ request }) => {
    const response = await request.get(`/study-group/${legacySlug}/settings`, { maxRedirects: 0 });
    expect([301, 308]).toContain(response.status());
    expect(response.headers().location).toBe('/study-groups/g/devtalk/settings');
  });

  test('a browser following the old URL lands on the DevTalk page', async ({ page }) => {
    await page.goto(`/study-group/${legacySlug}`);
    await expect(page).toHaveURL(/\/study-groups\/g\/devtalk$/);
    await expect(page.getByRole('link', { name: 'Sign in with Google' }).first()).toBeVisible();
  });

  test('the generated Cloudflare _redirects uses 301 for the old URLs and 200 rewrites for groups', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'redirects-'));
    mkdirSync(path.join(root, 'public'));
    execFileSync(process.execPath, [path.resolve('scripts/build-redirects.mjs')], { cwd: root, env: { ...process.env, STUDY_GROUP_SLUG: legacySlug } });
    const redirects = readFileSync(path.join(root, 'public', '_redirects'), 'utf8');
    expect(redirects).toContain(`/study-group/${legacySlug}  /study-groups/g/devtalk  301`);
    expect(redirects).toContain(`/study-group/${legacySlug}/settings  /study-groups/g/devtalk/settings  301`);
    expect(redirects).toContain('/study-groups/g/:id  /study-groups/group  200');
    expect(redirects).toContain('/study-groups/g/:id/settings  /study-groups/group/settings  200');
    // The settings rule must come before the generic group rule, or Cloudflare would never reach it.
    expect(redirects.indexOf('/study-groups/g/:id/settings')).toBeLessThan(redirects.indexOf('/study-groups/g/:id  '));
  });
});

test.describe('DevTalk migration (D11, Q20)', () => {
  test('DevTalk starts unowned and the first allowlisted admin sign-in claims it', async ({ browser }) => {
    // A regular user signing in claims nothing and can't open DevTalk without joining.
    const owner = await sessionFor(browser, users.owner);
    const beforeClaim = await api(owner, 'GET', '/groups/devtalk');
    expect(beforeClaim.status).toBe(403);
    const preview = await api<{ group: { name: string }; membership: string }>(owner, 'GET', '/groups/devtalk/preview');
    expect(preview.status).toBe(200);
    expect(preview.body.group.name).toBe('DevTalk');
    expect(preview.body.membership).toBe('none');

    const admin = await sessionFor(browser, users.admin);
    const group = await api<{ group: { name: string; summary: string }; role: string }>(admin, 'GET', '/groups/devtalk');
    expect(group.status).toBe(200);
    expect(group.body.role).toBe('owner');
    expect(group.body.group.summary.length).toBeGreaterThanOrEqual(20);

    const all = await api<{ groups: { id: string; ownerName: string | null }[] }>(admin, 'GET', '/admin/groups');
    expect(all.body.groups.find((item) => item.id === 'devtalk')?.ownerName).toBe(users.admin.givenName);

    // The old access code still lets existing members ask to join (Q20).
    const settings = await api<{ settings: { accessCode: string } }>(admin, 'GET', '/groups/devtalk/settings');
    expect(settings.status).toBe(200);
    expect(settings.body.settings.accessCode.length).toBeGreaterThan(0);

    await admin.goto('/study-groups/g/devtalk');
    await expect(admin.getByRole('main').getByRole('heading', { level: 1, name: 'DevTalk' })).toBeVisible();
    await expect(admin.getByText('Owner', { exact: true }).first()).toBeVisible();

    await owner.context().close();
    await admin.context().close();
  });
});
