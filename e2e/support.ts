import { expect, type Browser, type Page } from '@playwright/test';

export interface TestUser {
  email: string;
  /** Full name the fake IdP signs into the ID token. */
  name: string;
  /** Google given name, the default display name (Q9). */
  givenName: string;
  /** Users outside the fake IdP's preset list sign in through its free-form "anyone" form. */
  custom?: boolean;
}

/** Preset users of the local fake Google IdP (workers/local/fake-idp.ts). */
export const users = {
  admin: { email: 'admin@example.test', name: 'Ada Admin', givenName: 'Ada' },
  owner: { email: 'owner@example.test', name: 'Olivia Owner', givenName: 'Olivia' },
  member: { email: 'member@example.test', name: 'Max Member', givenName: 'Max' },
  outsider: { email: 'outsider@example.test', name: 'Oscar Outsider', givenName: 'Oscar' },
  unverified: { email: 'unverified@example.test', name: 'Uma Unverified', givenName: 'Uma' }
} satisfies Record<string, TestUser>;

let counter = 0;
const runId = Date.now().toString(36);

export function uniqueSuffix(): string {
  counter += 1;
  return `${runId}${counter}`;
}

/** A brand-new verified Google account for this run (signed in through the fake IdP's free-form form). */
export function freshUser(label: string): TestUser {
  const name = `${label} ${uniqueSuffix()}`;
  return { email: `${label.toLowerCase()}-${uniqueSuffix()}@example.test`, name, givenName: name, custom: true };
}

export function signInUrl(returnTo: string): string {
  return `/api/study-group/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

/** Picks the user on the fake Google sign-in page that the API redirected the browser to. */
export async function chooseFakeGoogleUser(page: Page, user: TestUser): Promise<void> {
  await expect(page).toHaveTitle('Fake Google sign-in');
  if (user.custom) {
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Name').fill(user.name);
    await page.getByRole('button', { name: 'Sign in as this user' }).click();
  } else {
    await page.getByRole('button', { name: `Sign in as ${user.name} (${user.email})` }).click();
  }
}

/** Accepts the Terms, Privacy Policy and age confirmation on the welcome page (D9, Q4). */
export async function acceptWelcome(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: /^Welcome, / })).toBeVisible();
  await page.getByRole('checkbox', { name: /Terms of Use and content policy/ }).check();
  await page.getByRole('checkbox', { name: /Privacy Policy/ }).check();
  await page.getByRole('checkbox', { name: /18 years old or older/ }).check();
  await page.getByRole('button', { name: 'Create my account' }).click();
}

/**
 * Signs in through the fake IdP and, for a new account, accepts the policies. Ends on `returnTo` with the session
 * loaded.
 */
export async function signIn(page: Page, user: TestUser, returnTo = '/study-groups/my'): Promise<void> {
  await page.goto(signInUrl(returnTo));
  await chooseFakeGoogleUser(page, user);
  await finishSignIn(page, returnTo);
}

/** After the fake IdP: accepts the policies when the account is new, then waits for `returnTo`. */
export async function finishSignIn(page: Page, returnTo: string): Promise<void> {
  await page.waitForURL((url) => url.pathname === '/study-groups/welcome' || url.pathname === returnTo);
  if (new URL(page.url()).pathname === '/study-groups/welcome') await acceptWelcome(page);
  await page.waitForURL((url) => url.pathname === returnTo);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
}

/** A new browser context (separate cookie jar) signed in as `user`. */
export async function sessionFor(browser: Browser, user: TestUser, returnTo = '/study-groups/my'): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, user, returnTo);
  return page;
}

export interface ApiResult<T = Record<string, unknown>> {
  status: number;
  body: T;
}

/**
 * Calls the same-origin study group API from inside the page, with the browser's own cookies and Origin, like the app
 * does. This is how the specs check API permissions (403s) without going through the UI.
 */
export async function api<T = Record<string, never>>(page: Page, method: string, path: string, body?: unknown, contentType = 'application/json'): Promise<ApiResult<T>> {
  return page.evaluate(async ({ method, path, body, contentType }) => {
    const init: RequestInit = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (method !== 'GET') {
      init.headers = { Accept: 'application/json', 'Content-Type': contentType };
      init.body = JSON.stringify(body ?? {});
    }
    const response = await fetch(`/api/study-group${path}`, init);
    const text = await response.text();
    const parse = (): unknown => {
      try {
        return text ? JSON.parse(text) : null;
      } catch {
        return text;
      }
    };
    return { status: response.status, body: parse() as never };
  }, { method, path, body, contentType });
}

export interface GroupInput {
  name: string;
  summary: string;
  rules?: string[];
  meetingUrl?: string | null;
  moderationMode?: 'free' | 'review';
  listed?: boolean;
  meetingDay?: string;
  meetingStart?: string;
  meetingEnd?: string;
  timezone?: string;
  meetingReminders?: boolean;
  requiresAccessCode?: boolean;
}

export function groupInput(label: string, overrides: Partial<GroupInput> = {}): GroupInput {
  const suffix = uniqueSuffix();
  return {
    name: `${label} ${suffix}`,
    summary: `A friendly group to practice English about ${label.toLowerCase()} (${suffix}).`,
    rules: ['Speak English only', 'Be kind'],
    meetingUrl: `https://meet.example.test/${suffix}`,
    moderationMode: 'free',
    listed: true,
    ...overrides
  };
}

/** Creates a group through the API as the signed-in user and returns its ID and access code; it requires the code unless `input` says otherwise. */
export async function createGroupViaApi(page: Page, input: GroupInput): Promise<{ id: string; accessCode: string }> {
  const result = await api<{ group: { id: string } }>(page, 'POST', '/groups', {
    meetingDay: 'Monday',
    meetingStart: '20:00',
    meetingEnd: '21:00',
    timezone: 'America/Sao_Paulo',
    rules: [],
    meetingUrl: null,
    moderationMode: 'free',
    listed: true,
    requiresAccessCode: true,
    ...input,
    acceptContentPolicy: true
  });
  expect(result.status, JSON.stringify(result.body)).toBe(201);
  const settings = await api<{ settings: { accessCode: string } }>(page, 'GET', `/groups/${result.body.group.id}/settings`);
  expect(settings.status).toBe(200);
  return { id: result.body.group.id, accessCode: settings.body.settings.accessCode };
}

/** Requests to join `groupId` as the user of `memberPage`, then approves it as the owner. */
export async function joinAndApprove(memberPage: Page, ownerPage: Page, groupId: string, accessCode: string): Promise<void> {
  const join = await api(memberPage, 'POST', `/groups/${groupId}/join`, { code: accessCode });
  expect([200, 201], JSON.stringify(join.body)).toContain(join.status);
  const requests = await api<{ requests: { id: number }[] }>(ownerPage, 'GET', `/groups/${groupId}/requests`);
  expect(requests.status).toBe(200);
  for (const request of requests.body.requests) {
    const approved = await api(ownerPage, 'POST', `/groups/${groupId}/requests/${request.id}/approve`);
    expect(approved.status, JSON.stringify(approved.body)).toBeLessThan(300);
  }
}

export async function suggest(page: Page, groupId: string, title: string, url?: string): Promise<{ id: number; status: string }> {
  const result = await api<{ material: { id: number; status: string } }>(page, 'POST', `/groups/${groupId}/materials`, { type: 'article', title, url });
  expect(result.status, JSON.stringify(result.body)).toBe(201);
  return result.body.material;
}

export function groupUrl(id: string, page: '' | '/settings' = ''): string {
  return `/study-groups/g/${id}${page}`;
}

/** Answers the in-page confirmation (no reason) that the last click opened: confirms it, or cancels it. */
export async function answerConfirmDialog(page: Page, confirmed = true) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await (confirmed ? dialog.getByRole('button').last() : dialog.getByRole('button', { name: 'Cancel' })).click();
  await expect(dialog).toHaveCount(0);
}

/**
 * Answers the platform admin's in-page reason dialog that the last click opened: submits `reason`, or cancels when
 * it is null. Returns the dialog locator.
 */
export async function answerReasonDialog(page: Page, reason: string | null) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  if (reason === null) {
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  } else {
    await dialog.getByLabel(/^Reason/).fill(reason);
    await dialog.getByRole('button').last().click();
  }
  await expect(dialog).toHaveCount(0);
  return dialog;
}
