import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

const siteUrl = 'https://fbrissi.dev';

const programPages = [
  { path: '/study-groups', locale: 'en', heading: /English study groups/ },
  { path: '/study-groups/terms', locale: 'en', heading: /Terms/i },
  { path: '/study-groups/privacy', locale: 'en', heading: /Privacy/i },
  { path: '/pt-br/study-groups', locale: 'pt-BR', heading: /Grupos de estudo/ },
  { path: '/pt-br/study-groups/terms', locale: 'pt-BR', heading: /Termos/i },
  { path: '/pt-br/study-groups/privacy', locale: 'pt-BR', heading: /Privacidade/i }
];

const appPages = [
  '/study-groups/my',
  '/study-groups/new',
  '/study-groups/account',
  '/study-groups/welcome',
  '/study-groups/admin',
  '/study-groups/g/devtalk',
  '/study-groups/g/devtalk/settings'
];

async function robots(page: Page): Promise<string> {
  return (await page.locator('meta[name="robots"]').getAttribute('content')) ?? '';
}

test.describe('program pages (D1, Q1, Q2)', () => {
  for (const { path, locale, heading } of programPages) {
    test(`${path} is indexable with canonical, hreflang and OG metadata`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('main').getByRole('heading', { level: 1, name: heading })).toBeVisible();

      expect(await robots(page)).toMatch(/(^|,\s*)index/);
      expect(await robots(page)).not.toMatch(/noindex/);
      expect(response?.headers()['x-robots-tag'] ?? '').not.toMatch(/noindex/);

      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${siteUrl}${path}`);
      const enPath = path.replace(/^\/pt-br/, '');
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', `${siteUrl}${enPath}`);
      await expect(page.locator('link[rel="alternate"][hreflang="pt-BR"]')).toHaveAttribute('href', `${siteUrl}/pt-br${enPath}`);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${siteUrl}${path}`);
      await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', locale === 'pt-BR' ? 'pt_BR' : 'en_US');
    });
  }

  test('the landing page has the sign-in call to action and links to the policies (1.1)', async ({ page }) => {
    await page.goto('/study-groups');
    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: /Sign in with Google/i }).first()).toHaveAttribute('href', /\/api\/study-group\/auth\/login\?returnTo=/);
    await expect(main.getByRole('link', { name: /Create a group/i }).first()).toBeVisible();
    await expect(page.locator('a[href="/study-groups/terms"]').first()).toBeVisible();
    await expect(page.locator('a[href="/study-groups/privacy"]').first()).toBeVisible();
  });

  test('the pt-BR landing page is in Portuguese and links to the pt-BR policies', async ({ page }) => {
    await page.goto('/pt-br/study-groups');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.locator('a[href="/pt-br/study-groups/terms"]').first()).toBeVisible();
    await expect(page.locator('a[href="/pt-br/study-groups/privacy"]').first()).toBeVisible();
  });

  test('the sitemap lists the program pages and no app pages (D1, D2)', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    for (const path of ['/study-groups', '/study-groups/terms', '/study-groups/privacy', '/pt-br/study-groups', '/pt-br/study-groups/terms', '/pt-br/study-groups/privacy']) {
      expect(sitemap).toContain(`<loc>${siteUrl}${path}</loc>`);
    }
    expect(sitemap).not.toMatch(/\/study-groups\/(g|group|my|new|account|welcome|admin)\b/);
    expect(sitemap).not.toMatch(/\/study-group\//);
  });
});

test.describe('app pages stay out of search engines (D2)', () => {
  for (const path of appPages) {
    test(`${path} loads directly and is noindex, nofollow with no-referrer`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      expect(await robots(page)).toMatch(/noindex/);
      expect(await robots(page)).toMatch(/nofollow/);
      await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Sign in with Google' }).first()).toBeVisible();
    });
  }

  test('Cloudflare headers send noindex and no-referrer for every app shell', () => {
    const headers = readFileSync('public/_headers', 'utf8');
    for (const path of ['/study-groups/g/*', '/study-groups/group', '/study-groups/group/*', '/study-groups/new', '/study-groups/my', '/study-groups/account', '/study-groups/welcome', '/study-groups/admin']) {
      const block = headers.split(/\n\s*\n/).find((item) => item.trim().split('\n')[0].trim() === path);
      expect(block, `missing _headers block for ${path}`).toBeDefined();
      expect(block).toMatch(/X-Robots-Tag: noindex, nofollow/);
      expect(block).toMatch(/Referrer-Policy: no-referrer/);
    }
  });

  test('the API answers with noindex and no-store', async ({ request }) => {
    const response = await request.get('/api/study-group/me');
    expect(response.status()).toBe(200);
    expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
    expect(response.headers()['cache-control']).toBe('no-store');
  });
});

test.describe('cookie notice (D9, Q17)', () => {
  test('is informational, links to the cookie section and stays dismissed', async ({ page }) => {
    await page.goto('/study-groups');
    const notice = page.getByRole('complementary').filter({ has: page.locator('a[href="/study-groups/privacy#cookies"]') });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('button')).toHaveCount(1);

    await notice.getByRole('button').click();
    await expect(notice).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('study-groups:cookie-notice-dismissed'))).toBe('1');

    await page.reload();
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('a[href="/study-groups/privacy#cookies"]')).toHaveCount(0);
  });

  test('is shown in Portuguese on the pt-BR pages and on the app pages', async ({ page }) => {
    await page.goto('/pt-br/study-groups');
    await expect(page.locator('a[href="/pt-br/study-groups/privacy#cookies"]')).toBeVisible();

    await page.goto('/study-groups/my');
    await expect(page.locator('a[href="/study-groups/privacy#cookies"]')).toBeVisible();
  });

  test('the privacy policy has the cookie section the notice links to', async ({ page }) => {
    for (const path of ['/study-groups/privacy', '/pt-br/study-groups/privacy']) {
      await page.goto(path);
      await expect(page.locator('#cookies')).toHaveCount(1);
    }
  });
});
