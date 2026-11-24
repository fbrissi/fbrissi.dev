import { expect, test, type Page } from '@playwright/test';

import { api, createGroupViaApi, freshUser, groupInput, groupUrl, joinAndApprove, sessionFor, type TestUser } from './support';

// e2e/features/emails.feature (E5) and groups.feature: meeting reminders, checked in Mailpit, and the schedule fields.
const mailpitUrl = process.env.E2E_MAILPIT_URL ?? 'http://mailpit:8025';
// Local only: runs the hourly reminder scan now (workers/local/study-group-api.ts), on the Docker network.
const reminderTrigger = process.env.E2E_REMINDER_TRIGGER_URL ?? 'http://study-group-api:8788/__local/meeting-reminders';

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

const reminders = async (user: TestUser, groupName: string) => (await inbox(user)).filter((message) => message.Subject.includes(`Reminder: ${groupName} meets`));

async function waitForReminder(user: TestUser, groupName: string): Promise<Mail> {
  await expect.poll(async () => (await reminders(user, groupName)).length, { message: `reminder to ${user.email}`, timeout: 15_000 }).toBe(1);
  const [found] = await reminders(user, groupName);
  return (await (await fetch(`${mailpitUrl}/api/v1/message/${found.ID}`)).json()) as Mail;
}

async function runReminderScan(): Promise<void> {
  const response = await fetch(reminderTrigger, { method: 'POST' });
  expect(response.ok).toBe(true);
}

const pad = (value: number) => String(value).padStart(2, '0');

/** A weekly UTC schedule whose next meeting starts 2 hours from now (rounded down to the minute): its same-day reminder is due now. */
function meetingInTwoHours() {
  const at = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const day = at.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  return {
    meetingDay: day,
    meetingStart: `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`,
    meetingEnd: `${pad((at.getUTCHours() + 1) % 24)}:${pad(at.getUTCMinutes())}`,
    timezone: 'UTC',
  };
}

test.describe('meeting reminders', () => {
  test.describe.configure({ mode: 'serial' });

  const owner = freshUser('RemindOwner');
  const member = freshUser('RemindMember');
  const optedOut = freshUser('RemindOptOut');
  const schedule = meetingInTwoHours();
  const reminded = groupInput('Reminder group', schedule);
  const quiet = groupInput('Quiet group', { ...schedule, meetingReminders: false });
  let ownerPage: Page;
  let memberPage: Page;
  let optedOutPage: Page;

  test.beforeAll(async ({ browser }) => {
    ownerPage = await sessionFor(browser, owner);
    memberPage = await sessionFor(browser, member);
    optedOutPage = await sessionFor(browser, optedOut);
    const remindedGroup = await createGroupViaApi(ownerPage, reminded);
    const quietGroup = await createGroupViaApi(ownerPage, quiet);
    await joinAndApprove(memberPage, ownerPage, remindedGroup.id, remindedGroup.accessCode);
    await joinAndApprove(optedOutPage, ownerPage, remindedGroup.id, remindedGroup.accessCode);
    await joinAndApprove(memberPage, ownerPage, quietGroup.id, quietGroup.accessCode);
    expect((await api(optedOutPage, 'PUT', '/me/notifications', { emailEnabled: false })).status).toBe(200);
    await runReminderScan();
  });

  test.afterAll(async () => {
    for (const page of [ownerPage, memberPage, optedOutPage]) await page.context().close();
  });

  test('the owner and the members get the meeting reminder on the day, with the time and the meeting link (E5)', async () => {
    for (const recipient of [owner, member]) {
      const mail = await waitForReminder(recipient, reminded.name);
      expect(mail.Subject).toBe(`[LOCAL] Reminder: ${reminded.name} meets today at ${schedule.meetingStart}`);
      expect(mail.Text).toContain(`${reminded.name} meets today, `);
      expect(mail.Text).toContain(`from ${schedule.meetingStart} to ${schedule.meetingEnd} (UTC).`);
      expect(mail.Text).toContain(`Join the meeting: ${reminded.meetingUrl}`);
      expect(mail.Text).toContain('Group board: http://localhost:3000/study-groups/g/');
      expect(mail.HTML).toContain(`href="${reminded.meetingUrl}"`);
    }

    await runReminderScan();
    await ownerPage.waitForTimeout(1500);
    expect(await reminders(owner, reminded.name)).toHaveLength(1);
    expect(await reminders(member, reminded.name)).toHaveLength(1);
  });

  test('no meeting reminder for a member who turned emails off or for a group with reminders off', async () => {
    await waitForReminder(member, reminded.name);
    expect(await reminders(optedOut, reminded.name)).toHaveLength(0);
    expect(await reminders(member, quiet.name)).toHaveLength(0);
    expect(await reminders(owner, quiet.name)).toHaveLength(0);
  });

  test('the owner picks the meeting day and time zone from lists and turns meeting reminders off', async () => {
    const { id } = await createGroupViaApi(ownerPage, groupInput('Schedule group'));
    await ownerPage.goto(groupUrl(id, '/settings'));
    const form = ownerPage.getByRole('region', { name: 'Group profile' });
    await form.getByLabel('Meeting day').selectOption('Thursday');
    await form.getByLabel('Time zone', { exact: true }).selectOption('Europe/Lisbon');
    const toggle = form.getByRole('checkbox', { name: /Email meeting reminders/ });
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await form.getByRole('button', { name: 'Save settings' }).click();
    await expect(form.getByText('Settings saved.')).toBeVisible();

    const { body } = await api<{ settings: { meetingDay: string; timezone: string; meetingReminders: boolean } }>(ownerPage, 'GET', `/groups/${id}/settings`);
    expect(body.settings).toMatchObject({ meetingDay: 'Thursday', timezone: 'Europe/Lisbon', meetingReminders: false });
    await ownerPage.reload();
    await expect(form.getByLabel('Meeting day')).toHaveValue('Thursday');
    await expect(form.getByRole('checkbox', { name: /Email meeting reminders/ })).not.toBeChecked();
  });
});
