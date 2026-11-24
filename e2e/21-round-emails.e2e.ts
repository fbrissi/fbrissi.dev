import { expect, test, type Page } from '@playwright/test';

import { api, createGroupViaApi, freshUser, groupInput, joinAndApprove, sessionFor, suggest, type TestUser } from './support';

// e2e/features/emails.feature (E6): round emails to the members, checked in Mailpit.
const mailpitUrl = process.env.E2E_MAILPIT_URL ?? 'http://mailpit:8025';

interface Summary {
  ID: string;
  Subject: string;
}
interface Mail {
  Subject: string;
  Text: string;
  HTML: string;
}

async function inbox(user: TestUser): Promise<Summary[]> {
  const response = await fetch(`${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"${user.email}"`)}`);
  return ((await response.json()) as { messages: Summary[] }).messages;
}

const matching = async (user: TestUser, subject: string) => (await inbox(user)).filter((message) => message.Subject === `[LOCAL] ${subject}`);

async function waitForMail(user: TestUser, subject: string): Promise<Mail> {
  await expect.poll(async () => (await matching(user, subject)).length, { message: `"${subject}" to ${user.email}`, timeout: 15_000 }).toBe(1);
  const [found] = await matching(user, subject);
  return (await (await fetch(`${mailpitUrl}/api/v1/message/${found.ID}`)).json()) as Mail;
}

const roundSubjects = async (user: TestUser, groupName: string) => (await inbox(user))
  .map((message) => message.Subject)
  .filter((subject) => [`[LOCAL] A vote is open in ${groupName}`, `[LOCAL] The vote in ${groupName} ended without a topic`].includes(subject)
    || subject.startsWith(`[LOCAL] Next topic for ${groupName}: `));

test.describe('round emails', () => {
  test.describe.configure({ mode: 'serial' });

  const owner = freshUser('RoundOwner');
  const member = freshUser('RoundMember');
  const optedOut = freshUser('RoundOptOut');
  const group = groupInput('Round group');
  const title = 'Idioms <b>at work</b>';
  let groupId: string;
  let titleId: number;
  let ownerPage: Page;
  let memberPage: Page;
  let optedOutPage: Page;

  const startRound = async (mode: 'vote' | 'draw') => {
    const result = await api<{ round: { id: number } }>(ownerPage, 'POST', `/groups/${groupId}/rounds`, { mode });
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    return result.body.round.id;
  };

  test.beforeAll(async ({ browser }) => {
    ownerPage = await sessionFor(browser, owner);
    memberPage = await sessionFor(browser, member);
    optedOutPage = await sessionFor(browser, optedOut);
    const created = await createGroupViaApi(ownerPage, group);
    groupId = created.id;
    await joinAndApprove(memberPage, ownerPage, groupId, created.accessCode);
    await joinAndApprove(optedOutPage, ownerPage, groupId, created.accessCode);
    titleId = (await suggest(memberPage, groupId, title)).id;
    await suggest(memberPage, groupId, 'Phrasal verbs');
  });

  test.afterAll(async () => {
    for (const page of [ownerPage, memberPage, optedOutPage]) await page.context().close();
  });

  test('members get an email when the owner opens a vote and when a topic is picked, and the owner gets none (E6)', async () => {
    const roundId = await startRound('vote');
    const opened = await waitForMail(member, `A vote is open in ${group.name}`);
    expect(opened.Text).toContain(`Vote now: http://localhost:3000/study-groups/g/${groupId}`);
    await waitForMail(optedOut, `A vote is open in ${group.name}`);
    const voted = await api(memberPage, 'POST', `/groups/${groupId}/rounds/${roundId}/votes`, { materialId: titleId });
    expect(voted.status, JSON.stringify(voted.body)).toBe(201);

    const closed = await api(ownerPage, 'POST', `/groups/${groupId}/rounds/${roundId}/close`);
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    const picked = await waitForMail(member, `Next topic for ${group.name}: ${title}`);
    expect(picked.Text).toContain(`The next topic for ${group.name} is: ${title}`);
    expect(picked.HTML).toContain('Idioms &lt;b&gt;at work&lt;/b&gt;');
    expect(picked.HTML).not.toContain('<b>at work</b>');
    expect(await roundSubjects(owner, group.name)).toEqual([]);
  });

  test('members who got the vote email are told when the vote is cancelled', async () => {
    await suggest(memberPage, groupId, 'Small talk');
    const roundId = await startRound('vote');
    await expect.poll(async () => (await matching(member, `A vote is open in ${group.name}`)).length, { timeout: 15_000 }).toBe(2);

    const cancelled = await api(ownerPage, 'POST', `/groups/${groupId}/rounds/${roundId}/cancel`);
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    const mail = await waitForMail(member, `The vote in ${group.name} ended without a topic`);
    expect(mail.Text).toContain(`The vote in ${group.name} was closed without picking a topic.`);
  });

  test('a draw sends only the picked topic, and a member who turned emails off gets no round email', async () => {
    expect((await api(optedOutPage, 'PUT', '/me/notifications', { emailEnabled: false })).status).toBe(200);
    const before = await roundSubjects(optedOut, group.name);
    const memberBefore = (await roundSubjects(member, group.name)).length;
    await startRound('draw');

    await expect.poll(async () => (await roundSubjects(member, group.name)).length, { timeout: 15_000 }).toBe(memberBefore + 1);
    const [latest] = await roundSubjects(member, group.name);
    expect(latest).toMatch(new RegExp(`^\\[LOCAL\\] Next topic for ${group.name}: `));
    await memberPage.waitForTimeout(1500);
    expect(await roundSubjects(optedOut, group.name)).toEqual(before);
    expect(await roundSubjects(owner, group.name)).toEqual([]);
  });
});
