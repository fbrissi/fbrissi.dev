import { expect, test, type Page } from '@playwright/test';

import { api, createGroupViaApi, freshUser, groupInput, sessionFor, users, type TestUser } from './support';

// e2e/features/emails.feature: sender, headers, language and opt-out rules of every service email, checked in Mailpit.
const mailpitUrl = process.env.E2E_MAILPIT_URL ?? 'http://mailpit:8025';
const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

interface Summary {
  ID: string;
  Subject: string;
}
interface Mail {
  ID: string;
  Subject: string;
  Text: string;
  HTML: string;
  From: { Address: string };
  ReplyTo: { Address: string }[];
}

async function inbox(user: TestUser): Promise<Summary[]> {
  const response = await fetch(`${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"${user.email}"`)}`);
  return ((await response.json()) as { messages: Summary[] }).messages;
}

async function waitForMail(user: TestUser, subject: RegExp): Promise<{ mail: Mail; headers: Record<string, string[]> }> {
  let found: Summary | undefined;
  await expect.poll(async () => {
    found = (await inbox(user)).find((message) => subject.test(message.Subject));
    return Boolean(found);
  }, { message: `email to ${user.email} matching ${subject}`, timeout: 15_000 }).toBe(true);
  const mail = (await (await fetch(`${mailpitUrl}/api/v1/message/${found!.ID}`)).json()) as Mail;
  const headers = (await (await fetch(`${mailpitUrl}/api/v1/message/${found!.ID}/headers`)).json()) as Record<string, string[]>;
  return { mail, headers };
}

async function userId(page: Page): Promise<string> {
  return (await api<{ user: { id: string } }>(page, 'GET', '/me')).body.user.id;
}

async function requestIds(owner: Page, groupId: string): Promise<{ id: number; displayName: string }[]> {
  return (await api<{ requests: { id: number; displayName: string }[] }>(owner, 'GET', `/groups/${groupId}/requests`)).body.requests;
}

test.describe('service email format and opt-out', () => {
  test.describe.configure({ mode: 'serial' });
  const owner = freshUser('FormatOwner');
  const joiner = freshUser('FormatJoiner');
  const quiet = freshUser('FormatQuiet');
  const second = freshUser('FormatSecond');
  let ownerPage: Page;
  let joinerPage: Page;
  let quietPage: Page;
  let secondPage: Page;
  let adminPage: Page;
  let group = { id: '', accessCode: '' };

  test.beforeAll(async ({ browser }) => {
    [ownerPage, joinerPage, quietPage, secondPage, adminPage] = await Promise.all([owner, joiner, quiet, second, users.admin].map((user) => sessionFor(browser, user)));
    group = await createGroupViaApi(ownerPage, groupInput('Email format', { listed: false }));
  });
  test.afterAll(async () => {
    for (const page of [ownerPage, joinerPage, quietPage, secondPage, adminPage]) await page.context().close();
  });

  test('a second join request inside 6 hours sends no new digest', async () => {
    expect((await api(joinerPage, 'POST', `/groups/${group.id}/join`, { code: group.accessCode })).status).toBe(201);
    await waitForMail(owner, /New requests to join/);
    expect((await api(secondPage, 'POST', `/groups/${group.id}/join`, { code: group.accessCode })).status).toBe(201);
    // The second request only schedules the trailing digest at the end of the window.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect((await inbox(owner)).filter((message) => /New requests to join/.test(message.Subject))).toHaveLength(1);
  });

  test('approval and rejection emails are not sent to a user who turned emails off', async () => {
    expect((await api(quietPage, 'PUT', '/me/notifications', { emailEnabled: false })).status).toBe(200);
    expect((await api(quietPage, 'POST', `/groups/${group.id}/join`, { code: group.accessCode })).status).toBe(201);
    const quietRequest = (await requestIds(ownerPage, group.id)).find((request) => request.displayName === quiet.givenName)!;
    expect((await api(ownerPage, 'POST', `/groups/${group.id}/requests/${quietRequest.id}/reject`)).status).toBe(204);
    for (const request of await requestIds(ownerPage, group.id)) expect((await api(ownerPage, 'POST', `/groups/${group.id}/requests/${request.id}/approve`)).status).toBe(204);
    await waitForMail(joiner, /You joined/);
    expect(await inbox(quiet)).toEqual([]);
  });

  test('every service email comes from notifications@fbrissi.dev, replies to groups@fbrissi.dev and has English text and HTML parts', async () => {
    const mails = [
      { recipient: owner, ...(await waitForMail(owner, /New requests to join/)) },
      { recipient: joiner, ...(await waitForMail(joiner, /You joined/)) },
      { recipient: second, ...(await waitForMail(second, /You joined/)) }
    ];
    for (const { recipient, mail, headers } of mails) {
      expect(mail.From.Address).toBe('notifications@fbrissi.dev');
      expect(mail.ReplyTo.map((item) => item.Address)).toEqual(['groups@fbrissi.dev']);
      // The shared layout: the contact form card with the avatar header and the LOCAL badge.
      expect(mail.HTML).toContain('<div class="header">');
      expect(mail.HTML).toContain('<span class="badge">LOCAL</span>');
      expect(mail.Subject).toMatch(/^\[LOCAL\] /);
      expect(mail.Text.length).toBeGreaterThan(20);
      expect(mail.HTML).toMatch(/<html[^>]*lang="en"/);
      expect(mail.Text).not.toMatch(/\b(você|olá|grupo de estudo|obrigad)/i);
      expect(headers['List-Unsubscribe']?.[0]).toMatch(/^<http:\/\/localhost:3000\/api\/study-group\/unsubscribe\?t=[^>]+>/);
      expect(headers['List-Unsubscribe-Post']).toEqual(['List-Unsubscribe=One-Click']);
      // No requester data in the owner digest, and no address of anyone else anywhere.
      for (const person of [owner, joiner, quiet, second].filter((person) => person !== recipient)) expect(mail.Text + mail.HTML).not.toContain(person.email);
    }
    expect(mails[0].mail.Text).not.toMatch(new RegExp(`${joiner.givenName}|${second.givenName}`));
  });

  test('a tampered unsubscribe link is refused and changes nothing', async () => {
    const { headers } = await waitForMail(joiner, /You joined/);
    const link = headers['List-Unsubscribe'][0].match(/<([^>]+)>/)![1].replace('http://localhost:3000', baseUrl);
    const token = new URL(link).searchParams.get('t')!;
    const tampered = new URL(link);
    tampered.searchParams.set('t', `${token.slice(0, -2)}${token.endsWith('AA') ? 'BB' : 'AA'}`);
    const response = await fetch(tampered, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
    expect(response.status).toBe(400);
    expect((await api<{ emailEnabled: boolean }>(joinerPage, 'GET', '/me/notifications')).body.emailEnabled).toBe(true);
  });

  test('the ban email mentions the 2-year record and arrives even with emails turned off', async () => {
    const id = await userId(quietPage);
    expect((await api(adminPage, 'POST', `/admin/users/${id}/ban`, { reason: 'Spam in several groups' })).status).toBe(204);
    const { mail, headers } = await waitForMail(quiet, /account was banned$/);
    expect(mail.Text).toContain('Reason: Spam in several groups');
    expect(mail.Text).toMatch(/2 years/);
    expect(mail.From.Address).toBe('notifications@fbrissi.dev');
    expect(mail.ReplyTo.map((item) => item.Address)).toEqual(['groups@fbrissi.dev']);
    expect(mail.Text).toContain('write to groups@fbrissi.dev');
    expect(headers['List-Unsubscribe']).toBeUndefined();
    expect(headers['List-Unsubscribe-Post']).toBeUndefined();
    expect(mail.Text).not.toContain('Unsubscribe');
  });

  test('the restored email arrives even with emails turned off', async () => {
    const id = (await api<{ users: { id: string }[] }>(adminPage, 'GET', `/admin/users?q=${encodeURIComponent(quiet.email)}`)).body.users[0].id;
    expect((await api(adminPage, 'DELETE', `/admin/users/${id}/ban`, { reason: 'Appeal accepted after review' })).status).toBe(204);
    const { mail, headers } = await waitForMail(quiet, /account was restored$/);
    expect(mail.Text.length).toBeGreaterThan(20);
    expect(headers['List-Unsubscribe']).toBeUndefined();
    expect((await inbox(quiet)).map((message) => message.Subject).sort()).toEqual([
      '[LOCAL] Your English Study Groups account was banned',
      '[LOCAL] Your English Study Groups account was restored'
    ]);
  });
});
