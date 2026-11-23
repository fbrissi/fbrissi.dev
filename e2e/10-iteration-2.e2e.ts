import { expect, test, type Page } from '@playwright/test';

import { acceptNextDialog, api, createGroupViaApi, freshUser, groupInput, joinAndApprove, sessionFor, suggest, users, type GroupInput } from './support';

interface LogResponse {
  actions: { action: string; targetType: string; targetId: string; groupId: string | null; label: string; reason: string }[];
}

const publicGroups = async (page: Page) =>
  ((await (await page.request.get('/api/study-group/groups')).json()) as { groups: { id: string; name: string; summary: string }[] }).groups;

const profileOf = async (page: Page, groupId: string) => {
  const { settings } = (await api<{ settings: Record<string, unknown> }>(page, 'GET', `/groups/${groupId}/settings`)).body;
  return Object.fromEntries(Object.entries(settings).filter(([key]) => key !== 'id' && key !== 'accessCode'));
};

// The header (as "English groups"), the footer on every page and a card on home link to the program in the page's locale.
test.describe('study groups links in the header, the footer and on home', () => {
  for (const { path, header, footer, href } of [
    { path: '/', header: 'English groups', footer: 'English groups', href: '/study-groups' },
    { path: '/about', header: 'English groups', footer: 'English groups', href: '/study-groups' },
    { path: '/pt-br', header: 'Grupos de inglês', footer: 'Grupos de inglês', href: '/pt-br/grupos-de-estudo-de-ingles' },
    { path: '/pt-br/about', header: 'Grupos de inglês', footer: 'Grupos de inglês', href: '/pt-br/grupos-de-estudo-de-ingles' }
  ]) {
    test(`${path} links to the program from the header and the footer in its locale`, async ({ page }) => {
      await page.goto(path);
      const footerLink = page.locator('footer').getByRole('link', { name: footer, exact: true });
      await expect(footerLink).toHaveCount(1);
      await expect(footerLink).toHaveAttribute('href', href);
      const headerLink = page.locator('header').getByRole('link', { name: header, exact: true }).filter({ visible: true });
      await expect(headerLink).toHaveCount(1);
      await expect(headerLink).toHaveAttribute('href', href);
      await headerLink.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('header').getByRole('link', { name: header, exact: true }).filter({ visible: true })).toHaveAttribute('aria-current', 'page');
    });
  }

  test('the program terms page marks the header item as the current section', async ({ page }) => {
    await page.goto('/study-groups/terms');
    await expect(page.locator('header').getByRole('link', { name: 'English groups', exact: true }).filter({ visible: true })).toHaveAttribute('aria-current', 'true');
  });

  test('the header nav fits on one row from 1024px', async ({ page }) => {
    for (const width of [1024, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ['/about', '/pt-br/about']) {
        await page.goto(path);
        const tops = await page.locator('header nav[aria-label] a, header nav[aria-label] button').filter({ visible: true }).evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
        expect(new Set(tops).size, `${path} at ${width}px`).toBe(1);
      }
    }
  });

  test('the mobile menu lists the program between Projects and Contact with a 44px row', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/pt-br');
    await page.getByRole('button', { name: 'Menu' }).click();
    const menu = page.locator('#mobile-navigation');
    await expect(menu.getByRole('link')).toHaveText(['Início', 'Sobre', 'Experiência', 'Projetos', 'Grupos de inglês', 'Contato']);
    expect((await menu.getByRole('link', { name: 'Grupos de inglês' }).boundingBox())?.height).toBeGreaterThanOrEqual(44);
  });

  for (const { path, cta, href } of [
    { path: '/', cta: 'Join a free English study group', href: '/study-groups' },
    { path: '/pt-br', cta: 'Entre em um grupo de estudo de inglês grátis', href: '/pt-br/grupos-de-estudo-de-ingles' }
  ]) {
    test(`the ${path} home card opens the program`, async ({ page }) => {
      await page.goto(path);
      const link = page.getByRole('main').getByRole('link', { name: cta });
      await expect(link).toHaveAttribute('href', href);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
    });
  }

  test('the header marks the current page with aria-current', async ({ page }) => {
    for (const [path, label] of [['/projects', 'Projects'], ['/pt-br/works', 'Experiência']]) {
      await page.goto(path);
      const link = page.locator('header').getByRole('link', { name: label, exact: true }).filter({ visible: true });
      await expect(link).toHaveAttribute('aria-current', 'page');
      await expect(link).toHaveClass(/(^|\s)text-accent(\s|$)/);
    }
  });
});

test('the legacy localStorage keys are cleared on load and other keys are kept', async ({ page }) => {
  await page.goto('/study-groups');
  await page.evaluate(() => {
    localStorage.setItem('study-group:code', 'old-shared-code');
    localStorage.setItem('study-group:name', 'Typed Name');
    localStorage.setItem('study-groups:cookie-notice-dismissed', '1');
  });
  for (const path of ['/study-groups', '/study-groups/my']) {
    await page.goto(path);
    await expect.poll(() => page.evaluate(() => [localStorage.getItem('study-group:code'), localStorage.getItem('study-group:name')])).toEqual([null, null]);
    expect(await page.evaluate(() => localStorage.getItem('study-groups:cookie-notice-dismissed'))).toBe('1');
    await page.evaluate(() => {
      localStorage.setItem('study-group:code', 'old-shared-code');
      localStorage.setItem('study-group:name', 'Typed Name');
    });
  }
});

test.describe('admin participation and management', () => {
  test.describe.configure({ mode: 'serial' });

  let admin: Page;
  let owner: Page;
  let member: Page;
  let groupId = '';
  let accessCode = '';
  let roundId = 0;
  let first = 0;
  let second = 0;

  test.beforeAll(async ({ browser }) => {
    admin = await sessionFor(browser, users.admin);
    owner = await sessionFor(browser, freshUser('PartOwner'));
    member = await sessionFor(browser, freshUser('PartMember'));
    const group = await createGroupViaApi(owner, groupInput('Participation'));
    groupId = group.id;
    accessCode = group.accessCode;
    await joinAndApprove(member, owner, groupId, accessCode);
    first = (await suggest(member, groupId, 'First topic', 'https://example.test/first')).id;
  });

  test.afterAll(async () => {
    for (const page of [admin, owner, member]) await page.context().close();
  });

  test('a vote needs at least 2 open materials (422); a draw needs 1', async () => {
    const one = await api<{ error: string }>(owner, 'POST', `/groups/${groupId}/rounds`, { mode: 'vote' });
    expect(one.status).toBe(422);
    await owner.goto(`/study-groups/g/${groupId}`);
    await expect(owner.getByRole('button', { name: 'Start vote' })).toBeDisabled();
    await expect(owner.getByRole('button', { name: /Draw at random/ })).toBeEnabled();

    second = (await suggest(owner, groupId, 'Second topic', 'https://example.test/second')).id;
    const vote = await api<{ round: { id: number } }>(owner, 'POST', `/groups/${groupId}/rounds`, { mode: 'vote' });
    expect(vote.status).toBe(201);
    roundId = vote.body.round.id;
  });

  test('a non-member admin cannot suggest or vote (API 403)', async () => {
    expect((await api(admin, 'POST', `/groups/${groupId}/materials`, { type: 'article', title: 'Admin idea' })).status).toBe(403);
    expect((await api(admin, 'POST', `/groups/${groupId}/rounds/${roundId}/votes`, { materialId: first })).status).toBe(403);
    const group = await api<{ role: string; canParticipate: boolean }>(admin, 'GET', `/groups/${groupId}`);
    expect(group.body).toMatchObject({ role: 'platform_admin', canParticipate: false });
    expect((await api<{ canParticipate: boolean }>(member, 'GET', `/groups/${groupId}`)).body.canParticipate).toBe(true);
    expect((await api<{ canParticipate: boolean }>(owner, 'GET', `/groups/${groupId}`)).body.canParticipate).toBe(true);
  });

  test('the board hides the suggest form and vote buttons from a non-member admin but keeps management', async () => {
    await admin.goto(`/study-groups/g/${groupId}`);
    await expect(admin.getByText('Platform admin', { exact: true })).toBeVisible();
    await expect(admin.getByText('You manage this group as the platform admin. Only members suggest materials and vote.')).toBeVisible();
    await expect(admin.getByRole('button', { name: 'Add suggestion' })).toHaveCount(0);
    await expect(admin.getByRole('button', { name: /^Vote for:/ })).toHaveCount(0);
    await expect(admin.getByRole('button', { name: /^Your vote:/ })).toHaveCount(0);
    await expect(admin.getByRole('button', { name: 'Close vote' })).toBeVisible();
    await expect(admin.getByRole('button', { name: 'Delete “First topic”' })).toBeVisible();

    // Members still vote; the admin closes the round.
    await member.goto(`/study-groups/g/${groupId}`);
    await member.getByRole('button', { name: /^Vote for: Second topic/ }).click();
    await expect(member.getByRole('button', { name: /^Your vote: Second topic/ })).toBeVisible();
    acceptNextDialog(admin);
    await admin.getByRole('button', { name: 'Close vote' }).click();
    await expect(admin.getByRole('heading', { name: 'This week’s topic' }).or(admin.getByRole('heading', { name: "This week's topic" }))).toBeVisible();
    const current = await api<{ round: { status: string; winnerMaterialId: number } }>(admin, 'GET', `/groups/${groupId}/rounds/current`);
    expect(current.body.round).toMatchObject({ status: 'closed', winnerMaterialId: second });

    // Other management actions still work for the admin.
    expect((await api(admin, 'PATCH', `/groups/${groupId}/materials/${second}`, { status: 'discussed' })).status).toBe(200);
    expect((await api(admin, 'POST', `/groups/${groupId}/rounds`, { mode: 'draw' })).status).toBe(201);
    expect((await api(admin, 'POST', `/groups/${groupId}/access-code`)).status).toBe(200);
    expect((await api(admin, 'PUT', `/groups/${groupId}/settings`, await profileOf(admin, groupId))).status).toBe(200);
  });

  test('an admin who joins the group as a member can suggest and vote', async () => {
    const code = (await api<{ settings: { accessCode: string } }>(owner, 'GET', `/groups/${groupId}/settings`)).body.settings.accessCode;
    await joinAndApprove(admin, owner, groupId, code);
    expect((await api<{ canParticipate: boolean }>(admin, 'GET', `/groups/${groupId}`)).body.canParticipate).toBe(true);
    expect((await suggest(admin, groupId, 'Admin as member')).status).toBe('open');
    await admin.goto(`/study-groups/g/${groupId}`);
    await expect(admin.getByRole('button', { name: 'Add suggestion' })).toBeVisible();
  });

  test('an admin deletion is audited and permanent; an owner deletion is not audited', async () => {
    const victim = await suggest(member, groupId, 'Spammy item', 'https://example.test/spammy');
    // The admin is a member now but not the owner, so admin rules still apply.
    expect((await api(admin, 'DELETE', `/groups/${groupId}/materials/${victim.id}`, { reason: 'Looked like spam at first' })).status).toBe(204);
    const ownerItem = await suggest(member, groupId, 'Owner removed', 'https://example.test/owner-removed');
    expect((await api(owner, 'DELETE', `/groups/${groupId}/materials/${ownerItem.id}`, {})).status).toBe(204);
    // The same links can be suggested again right away: nothing is kept.
    await suggest(member, groupId, 'Spammy again', 'https://example.test/spammy');

    const log = (await api<LogResponse>(admin, 'GET', '/admin/moderation-log')).body.actions.filter((action) => action.groupId === groupId);
    expect(log.map((action) => action.action)).toEqual(['delete_material']);
    expect(log[0]).toMatchObject({ targetType: 'material', targetId: String(victim.id), label: 'Spammy item' });
  });
});

test('deleting a join request message logs a neutral label and the text appears nowhere', async ({ browser }) => {
  const admin = await sessionFor(browser, users.admin);
  const owner = await sessionFor(browser, freshUser('MsgOwner'));
  const applicant = await sessionFor(browser, freshUser('MsgApplicant'));
  const secret = 'My CPF is 123.456.789-00';
  const group = await createGroupViaApi(owner, groupInput('Neutral label'));
  expect((await api(applicant, 'POST', `/groups/${group.id}/join`, { code: group.accessCode, message: secret })).status).toBe(201);
  const requestId = (await api<{ requests: { id: number }[] }>(owner, 'GET', `/groups/${group.id}/requests`)).body.requests[0].id;

  expect((await api(admin, 'DELETE', `/groups/${group.id}/requests/${requestId}/message`, { reason: 'Personal data in the message' })).status).toBe(204);

  const log = await api<LogResponse>(admin, 'GET', '/admin/moderation-log');
  const entry = log.body.actions.find((action) => action.groupId === group.id);
  expect(entry).toMatchObject({ action: 'delete_join_message', targetId: String(requestId), label: `Join request #${requestId}` });
  expect(JSON.stringify(log.body)).not.toContain('123.456.789-00');

  for (const [page, path] of [[admin, '/study-groups/admin'], [owner, '/study-groups/my'], [owner, `/study-groups/g/${group.id}/settings`]] as const) {
    await page.goto(path);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).last()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('123.456.789-00');
  }
  await expect(owner.getByText(`Join request #${requestId}`).first()).toBeVisible();
  for (const page of [admin, owner, applicant]) await page.context().close();
});

test.describe('landing list stays correct after group changes', () => {
  test('create, edit, unlist, relist and delete are reflected on the landing page', async ({ browser }) => {
    const owner = await sessionFor(browser, freshUser('Landing'));
    const visitor = await browser.newPage();
    const input: GroupInput = groupInput('Landing sync');
    const { id } = await createGroupViaApi(owner, input);

    expect((await publicGroups(visitor)).find((group) => group.id === id)?.name).toBe(input.name);
    await visitor.goto('/study-groups');
    await expect(visitor.getByRole('heading', { name: input.name })).toBeVisible();

    const renamed = `${input.name} renamed`;
    expect((await api(owner, 'PUT', `/groups/${id}/settings`, { ...(await profileOf(owner, id)), name: renamed })).status).toBe(200);
    expect((await publicGroups(visitor)).find((group) => group.id === id)?.name).toBe(renamed);
    await visitor.reload();
    await expect(visitor.getByRole('heading', { name: renamed })).toBeVisible();

    expect((await api(owner, 'PUT', `/groups/${id}/settings`, { ...(await profileOf(owner, id)), listed: false })).status).toBe(200);
    expect((await publicGroups(visitor)).map((group) => group.id)).not.toContain(id);

    expect((await api(owner, 'PUT', `/groups/${id}/settings`, { ...(await profileOf(owner, id)), listed: true })).status).toBe(200);
    expect((await publicGroups(visitor)).map((group) => group.id)).toContain(id);

    expect((await api(owner, 'DELETE', `/groups/${id}`, { confirmName: renamed })).status).toBe(204);
    expect((await publicGroups(visitor)).map((group) => group.id)).not.toContain(id);
    await visitor.reload();
    await expect(visitor.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    await expect(visitor.getByText(renamed)).toHaveCount(0);

    await visitor.close();
    await owner.context().close();
  });
});
