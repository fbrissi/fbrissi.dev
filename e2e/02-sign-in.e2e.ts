import { expect, test } from '@playwright/test';

import { acceptWelcome, api, chooseFakeGoogleUser, freshUser, signIn, signInUrl, users } from './support';

test.describe('Google sign-in (2.1)', () => {
  test('an unverified Google email is rejected and nothing is stored', async ({ page }) => {
    await page.goto(signInUrl('/study-groups/my'));
    await chooseFakeGoogleUser(page, users.unverified);
    await expect(page).toHaveURL(/\/study-groups\?signin=failed$/);
    await expect(page.getByRole('main').getByRole('alert').or(page.getByRole('main').getByRole('status')).first()).toBeVisible();

    const me = await api<{ user: unknown }>(page, 'GET', '/me');
    expect(me.body.user).toBeNull();
    const cookies = await page.context().cookies();
    expect(cookies.map((cookie) => cookie.name)).not.toContain('__Host-sg_session');
    expect(cookies.map((cookie) => cookie.name)).not.toContain('__Host-sg_signup');
  });

  test('a callback without the OAuth cookie or with a wrong state fails generically', async ({ page }) => {
    await page.goto('/api/study-group/auth/callback?code=forged&state=forged');
    await expect(page).toHaveURL(/\/study-groups\?signin=failed$/);

    await page.goto(signInUrl('/study-groups/my'));
    const authorizeUrl = new URL(page.url());
    expect(authorizeUrl.origin).toBe('http://localhost:8790');
    expect(authorizeUrl.searchParams.get('scope')).toBe('openid email profile');
    expect(authorizeUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorizeUrl.searchParams.get('nonce')).toBeTruthy();
    expect(authorizeUrl.searchParams.get('state')).toBeTruthy();

    await page.goto('/api/study-group/auth/callback?code=forged&state=wrong');
    await expect(page).toHaveURL(/\/study-groups\?signin=failed$/);
    expect((await api<{ user: unknown }>(page, 'GET', '/me')).body.user).toBeNull();
  });

  test('the session cookie is __Host-, HttpOnly, Secure, SameSite=Lax and hidden from JavaScript', async ({ page }) => {
    await signIn(page, users.member);
    const session = (await page.context().cookies()).find((cookie) => cookie.name === '__Host-sg_session');
    expect(session).toBeDefined();
    expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
    expect(session?.domain).toBe('localhost');
    // 30-day absolute lifetime (Q11).
    const days = ((session?.expires ?? 0) * 1000 - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30.01);
    expect(await page.evaluate(() => document.cookie)).not.toContain('sg_session');

    // Signing out deletes the session.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/study-groups$/);
    expect((await api<{ user: unknown }>(page, 'GET', '/me')).body.user).toBeNull();
  });

  test('the post-sign-in redirect only accepts program pages', async ({ page }) => {
    const user = freshUser('Redirect');
    await page.goto(signInUrl('https://evil.example/steal'));
    await chooseFakeGoogleUser(page, user);
    await acceptWelcome(page);
    await expect(page).toHaveURL(/\/study-groups\/my$/);
  });
});

test.describe('welcome and consent (2.2, D9, Q4)', () => {
  test('boxes are never pre-checked, all three are required, and declining keeps nothing', async ({ page }) => {
    const user = freshUser('Consent');
    await page.goto(signInUrl('/study-groups/new'));
    await chooseFakeGoogleUser(page, user);
    await expect(page).toHaveURL(/\/study-groups\/welcome$/);
    await expect(page.getByRole('heading', { name: `Welcome, ${user.givenName}` })).toBeVisible();

    const terms = page.getByRole('checkbox', { name: /Terms of Use and content policy/ });
    const privacy = page.getByRole('checkbox', { name: /Privacy Policy/ });
    const adult = page.getByRole('checkbox', { name: /18 years old or older/ });
    for (const box of [terms, privacy, adult]) await expect(box).not.toBeChecked();
    await expect(page.getByRole('link', { name: 'Terms of Use and content policy' })).toHaveAttribute('href', '/study-groups/terms');
    await expect(page.getByRole('link', { name: 'Privacy Policy' }).first()).toHaveAttribute('href', '/study-groups/privacy');

    await terms.check();
    await privacy.check();
    await page.getByRole('button', { name: 'Create my account' }).click();
    await expect(page.getByText('Check all three boxes to create your account.')).toBeVisible();

    // The API refuses a sign-up without every acceptance too.
    const missingAge = await api(page, 'POST', '/auth/signup', { acceptTerms: true, acceptPrivacy: true });
    expect(missingAge.status).toBe(400);

    await page.getByRole('button', { name: 'Decline' }).click();
    await expect(page).toHaveURL(/\/study-groups$/);
    expect((await api<{ user: unknown }>(page, 'GET', '/me')).body.user).toBeNull();
    expect((await api(page, 'GET', '/auth/signup')).status).toBe(404);

    // Nothing was kept: signing in again asks for the acceptance again, then lands on the requested page.
    await page.goto(signInUrl('/study-groups/new'));
    await chooseFakeGoogleUser(page, user);
    await expect(page).toHaveURL(/\/study-groups\/welcome$/);
    await acceptWelcome(page);
    await expect(page).toHaveURL(/\/study-groups\/new$/);
    await expect(page.getByRole('heading', { name: 'Create a group' })).toBeVisible();

    const me = await api<{ user: { displayName: string; needsConsent: boolean } }>(page, 'GET', '/me');
    expect(me.body.user).toMatchObject({ displayName: user.givenName, needsConsent: false });

    // The acceptance is recorded with the document, version and UTC timestamp.
    const exported = await api<{ consents: { document: string; version: string; acceptedAt: string }[] }>(page, 'GET', '/me/export');
    expect(exported.status).toBe(200);
    const documents = exported.body.consents.map((consent) => consent.document).sort();
    expect(documents).toEqual(expect.arrayContaining(['privacy', 'terms']));
    for (const consent of exported.body.consents) {
      expect(consent.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(consent.acceptedAt).toMatch(/Z$/);
    }
  });

  test('a returning user skips the welcome page', async ({ page }) => {
    await signIn(page, users.member);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/study-groups$/);

    await page.goto(signInUrl('/study-groups/account'));
    await chooseFakeGoogleUser(page, users.member);
    await expect(page).toHaveURL(/\/study-groups\/account$/);
    await expect(page.getByRole('heading', { name: 'Account', exact: true })).toBeVisible();
  });

  test('the welcome page without a pending sign-up says the sign-in expired', async ({ page }) => {
    await page.goto('/study-groups/welcome');
    await expect(page.getByRole('heading', { name: 'Your sign-in expired' })).toBeVisible();
  });
});
