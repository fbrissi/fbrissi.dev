import { expect, request as playwrightRequest, test, type Page } from '@playwright/test';

import { api, createGroupViaApi, freshUser, groupInput, sessionFor, users, type TestUser } from './support';

// Mailpit (docker-compose.yml) receives the local study group emails; the test container shares the app's network.
const mailpitUrl = process.env.E2E_MAILPIT_URL ?? 'http://mailpit:8025';

interface MailSummary {
  ID: string;
  Subject: string;
}

interface Mail {
  ID: string;
  Subject: string;
  Text: string;
  HTML: string;
  From: { Address: string; Name: string };
  ReplyTo: { Address: string }[];
  To: { Address: string }[];
}

async function mailpit<T>(path: string): Promise<T> {
  const response = await fetch(`${mailpitUrl}/api/v1${path}`);
  expect(response.ok, `Mailpit ${path}`).toBe(true);
  return response.json() as Promise<T>;
}

async function inbox(user: TestUser): Promise<MailSummary[]> {
  return (await mailpit<{ messages: MailSummary[] }>(`/search?query=${encodeURIComponent(`to:"${user.email}"`)}`)).messages;
}

/** Waits for the email to `user` whose subject matches, and returns it with its headers. */
async function waitForMail(user: TestUser, subject: RegExp): Promise<{ mail: Mail; headers: Record<string, string[]> }> {
  let found: MailSummary | undefined;
  await expect.poll(async () => {
    found = (await inbox(user)).find((message) => subject.test(message.Subject));
    return Boolean(found);
  }, { message: `email to ${user.email} matching ${subject}`, timeout: 15_000 }).toBe(true);
  return { mail: await mailpit<Mail>(`/message/${found!.ID}`), headers: await mailpit<Record<string, string[]>>(`/message/${found!.ID}/headers`) };
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Service emails (E1–E4), the 7-day cooldown, the email setting and one-click unsubscribe, checked in Mailpit. */
test.describe('study group emails', () => {
  test.describe.configure({ mode: 'serial' });

  const owner = freshUser('MailOwner');
  const accepted = freshUser('MailAccepted');
  const declined = freshUser('MailDeclined');
  const input = groupInput('Mail group');
  let ownerPage: Page;
  let acceptedPage: Page;
  let declinedPage: Page;
  let groupId = '';
  let accessCode = '';

  test.beforeAll(async ({ browser }) => {
    ownerPage = await sessionFor(browser, owner);
    acceptedPage = await sessionFor(browser, accepted);
    declinedPage = await sessionFor(browser, declined);
    ({ id: groupId, accessCode } = await createGroupViaApi(ownerPage, input));
  });

  test.afterAll(async () => {
    for (const page of [ownerPage, acceptedPage, declinedPage]) await page.context().close();
  });

  test('the owner gets one digest per group, with the count and nothing about the requester (E1)', async () => {
    expect((await api(acceptedPage, 'POST', `/groups/${groupId}/join`, { code: accessCode, message: 'Secret hello from the requester' })).status).toBe(201);
    const { mail, headers } = await waitForMail(owner, new RegExp(`^\\[LOCAL\\] New requests to join ${escape(input.name)}$`));
    expect(mail.Text).toContain(`1 person is waiting to join ${input.name}.`);
    expect(mail.Text).toContain(`http://localhost:3000/study-groups/g/${groupId}/settings`);
    expect(`${mail.Text}${mail.HTML}`).not.toContain('Secret hello');
    expect(`${mail.Text}${mail.HTML}`).not.toContain(accepted.email);
    expect(`${mail.Text}${mail.HTML}`).not.toContain(accepted.givenName);
    expect(mail.From).toEqual({ Address: 'notifications@fbrissi.dev', Name: 'English Study Groups' });
    expect(mail.ReplyTo.map((address) => address.Address)).toEqual(['contact@fbrissi.dev']);
    expect(mail.To.map((address) => address.Address)).toEqual([owner.email]);
    expect(headers['List-Unsubscribe']?.[0]).toMatch(/^<http:\/\/localhost:3000\/api\/study-group\/unsubscribe\?t=[\w.%-]+>$/);
    expect(headers['List-Unsubscribe-Post']).toEqual(['List-Unsubscribe=One-Click']);

    // A second request within 6 hours adds no email.
    expect((await api(declinedPage, 'POST', `/groups/${groupId}/join`, { code: accessCode })).status).toBe(201);
    await ownerPage.waitForTimeout(1500);
    expect((await inbox(owner)).filter((message) => message.Subject.includes('New requests'))).toHaveLength(1);
  });

  test('requesters learn the decision, and a declined one waits 7 days (E2, E3)', async () => {
    const requests = await api<{ requests: { id: number; displayName: string }[] }>(ownerPage, 'GET', `/groups/${groupId}/requests`);
    const byName = (name: string) => requests.body.requests.find((item) => item.displayName === name)!.id;
    expect((await api(ownerPage, 'POST', `/groups/${groupId}/requests/${byName(accepted.givenName)}/approve`)).status).toBe(204);
    expect((await api(ownerPage, 'POST', `/groups/${groupId}/requests/${byName(declined.givenName)}/reject`)).status).toBe(204);

    const approved = await waitForMail(accepted, new RegExp(`^\\[LOCAL\\] You joined ${escape(input.name)}$`));
    expect(approved.mail.Text).toContain(`Open the group: http://localhost:3000/study-groups/g/${groupId}`);
    const rejected = await waitForMail(declined, new RegExp(`^\\[LOCAL\\] Your request to join ${escape(input.name)}$`));
    expect(rejected.mail.Text).toContain('was not approved');
    expect(rejected.mail.Text).toContain('You can ask to join this group again after 7 days');
    expect(rejected.mail.HTML).toContain('#f97316');
    expect(rejected.mail.Text).not.toContain(owner.email);

    const again = await api<{ error: string }>(declinedPage, 'POST', `/groups/${groupId}/join`, { code: accessCode });
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/You can ask again after [A-Z][a-z]+ \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M \(Brasília time\)\./);

    // The join form shows the wait as a form error; the code field stays valid.
    await declinedPage.goto(`/study-groups/g/${groupId}`);
    await declinedPage.getByLabel('Group code').fill(accessCode);
    await declinedPage.getByRole('button', { name: 'Send request' }).click();
    await expect(declinedPage.getByRole('alert').filter({ hasText: /You can ask again after/ })).toBeVisible();
    await expect(declinedPage.getByLabel('Group code')).toHaveAttribute('aria-invalid', 'false');
  });

  test('the one-click unsubscribe POST from a mail provider turns emails off, and the account turns them back on', async () => {
    const { headers } = await waitForMail(accepted, /You joined/);
    const oneClick = headers['List-Unsubscribe'][0].slice(1, -1);
    // A mail provider posts a form, with no Origin or cookie.
    const provider = await playwrightRequest.newContext();
    const response = await provider.post(oneClick, { form: { 'List-Unsubscribe': 'One-Click' } });
    expect(response.status()).toBe(200);
    await provider.dispose();

    await acceptedPage.goto('/study-groups/account');
    const box = acceptedPage.getByRole('checkbox', { name: 'Email me about my groups and requests' });
    await expect(box).not.toBeChecked();
    await expect(box).toBeEnabled();
    await box.check();
    await expect(acceptedPage.getByText('Emails turned on.')).toBeVisible();
    expect((await api<{ emailEnabled: boolean }>(acceptedPage, 'GET', '/me/notifications')).body).toEqual({ emailEnabled: true });
  });

  test('the unsubscribe link in the email opens a confirmation page and changes nothing until confirmed', async ({ browser }) => {
    const { mail } = await waitForMail(declined, /Your request to join/);
    const link = mail.Text.match(/Unsubscribe from these emails: (\S+)/)![1];
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(link);
    await expect(page.getByRole('heading', { name: 'Unsubscribe from emails' })).toBeVisible();
    expect((await api<{ emailEnabled: boolean }>(declinedPage, 'GET', '/me/notifications')).body).toEqual({ emailEnabled: true });
    await page.getByRole('button', { name: 'Unsubscribe' }).click();
    await expect(page.getByText("You won't get study group emails anymore.")).toBeVisible();
    expect((await api<{ emailEnabled: boolean }>(declinedPage, 'GET', '/me/notifications')).body).toEqual({ emailEnabled: false });
    await context.close();
  });

  test('an owner who turned emails off gets no digest', async ({ browser }) => {
    const quietOwner = freshUser('QuietOwner');
    const quiet = await sessionFor(browser, quietOwner);
    await quiet.goto('/study-groups/account');
    const box = quiet.getByRole('checkbox', { name: 'Email me about my groups and requests' });
    await expect(box).toBeEnabled();
    await box.uncheck();
    await expect(quiet.getByText('Emails turned off.')).toBeVisible();
    const group = await createGroupViaApi(quiet, groupInput('Quiet group'));
    const requester = await sessionFor(browser, freshUser('QuietRequester'));
    expect((await api(requester, 'POST', `/groups/${group.id}/join`, { code: group.accessCode })).status).toBe(201);
    await quiet.waitForTimeout(1500);
    expect(await inbox(quietOwner)).toEqual([]);
    await quiet.context().close();
    await requester.context().close();
  });

  test('the owner gets the platform admin deletion with the reason (E4)', async ({ browser }) => {
    const admin = await sessionFor(browser, users.admin);
    const reason = 'The group repeatedly shared off-topic promotions';
    expect((await api(admin, 'DELETE', `/groups/${groupId}`, { confirmName: input.name, reason })).status).toBe(204);
    const { mail } = await waitForMail(owner, new RegExp(`^\\[LOCAL\\] Your group ${escape(input.name)} was deleted$`));
    expect(mail.Text).toContain(`Reason: ${reason}`);
    expect(mail.Text).not.toContain(users.admin.email);
    await admin.context().close();
  });
});
