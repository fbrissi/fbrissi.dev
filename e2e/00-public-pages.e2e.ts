import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

const siteUrl = 'https://fbrissi.dev';

// `en` and `pt` are the hreflang pair; only the program landing has a Portuguese slug.
const programPages = [
  { path: '/study-groups', locale: 'en', heading: /English study groups/, en: '/study-groups', pt: '/pt-br/grupos-de-estudo-de-ingles' },
  { path: '/study-groups/terms', locale: 'en', heading: /Terms/i, en: '/study-groups/terms', pt: '/pt-br/study-groups/terms' },
  { path: '/privacy', locale: 'en', heading: /Privacy/i, en: '/privacy', pt: '/pt-br/privacy' },
  { path: '/pt-br/grupos-de-estudo-de-ingles', locale: 'pt-BR', heading: /Grupos de estudo/, en: '/study-groups', pt: '/pt-br/grupos-de-estudo-de-ingles' },
  { path: '/pt-br/study-groups/terms', locale: 'pt-BR', heading: /Termos/i, en: '/study-groups/terms', pt: '/pt-br/study-groups/terms' },
  { path: '/pt-br/privacy', locale: 'pt-BR', heading: /Privacidade/i, en: '/privacy', pt: '/pt-br/privacy' }
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

test.describe('program pages and the site-wide privacy policy (D1, Q1, Q2, D-7)', () => {
  for (const { path, locale, heading, en, pt } of programPages) {
    test(`${path} is indexable with canonical, hreflang and OG metadata`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('main').getByRole('heading', { level: 1, name: heading })).toBeVisible();

      expect(await robots(page)).toMatch(/(^|,\s*)index/);
      expect(await robots(page)).not.toMatch(/noindex/);
      expect(response?.headers()['x-robots-tag'] ?? '').not.toMatch(/noindex/);

      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${siteUrl}${path}`);
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', `${siteUrl}${en}`);
      await expect(page.locator('link[rel="alternate"][hreflang="pt-BR"]')).toHaveAttribute('href', `${siteUrl}${pt}`);
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', `${siteUrl}${en}`);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${siteUrl}${path}`);
      await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', locale === 'pt-BR' ? 'pt_BR' : 'en_US');
    });
  }

  test('the landing page has the sign-in call to action and links to the policies (1.1)', async ({ page }) => {
    await page.goto('/study-groups');
    const main = page.getByRole('main');
    await expect(main.getByRole('link', { name: 'Join a free English study group' })).toHaveAttribute('href', /\/api\/study-group\/auth\/login\?returnTo=/);
    await expect(main.getByText("You'll sign in with Google", { exact: true })).toBeVisible();
    await expect(page).toHaveTitle('Free English Study Groups for Devs | Filipe Bojikian Rissi');
    await expect(main.getByRole('link', { name: /Create a group/i }).first()).toBeVisible();
    await expect(page.locator('a[href="/study-groups/terms"]').first()).toBeVisible();
    await expect(page.locator('a[href="/privacy"]').first()).toBeVisible();
  });

  test('the pt-BR landing page is in Portuguese and links to the pt-BR policies', async ({ page }) => {
    await page.goto('/pt-br/grupos-de-estudo-de-ingles');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('main').getByRole('link', { name: 'Entre em um grupo de estudo de inglês grátis' })).toBeVisible();
    await expect(page.getByRole('main').getByText('Você entra com a sua conta Google', { exact: true })).toBeVisible();
    await expect(page).toHaveTitle('Grupos de Estudo de Inglês para Devs | Filipe Bojikian Rissi');
    await expect(page.locator('a[href="/pt-br/study-groups/terms"]').first()).toBeVisible();
    await expect(page.locator('a[href="/pt-br/privacy"]').first()).toBeVisible();
  });

  test('the sitemap lists the program pages and no app pages (D1, D2)', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    for (const path of ['/study-groups', '/study-groups/terms', '/privacy', '/pt-br/grupos-de-estudo-de-ingles', '/pt-br/study-groups/terms', '/pt-br/privacy']) {
      expect(sitemap).toContain(`<loc>${siteUrl}${path}</loc>`);
    }
    expect(sitemap).not.toMatch(/\/study-groups\/(g|group|my|new|account|welcome|admin)\b/);
    expect(sitemap).not.toMatch(/\/study-group\//);
    expect(sitemap).not.toContain('/study-groups/privacy');
  });

  for (const [from, to] of [
    ['/study-groups/privacy', '/privacy'],
    ['/pt-br/study-groups/privacy', '/pt-br/privacy'],
    ['/open-source', '/projects#open-source'],
    ['/pt-br/open-source', '/pt-br/projects#open-source'],
    ['/pt-br/study-groups', '/pt-br/grupos-de-estudo-de-ingles'],
    ['/pt-br/articles/registry-lookup-with-digital-certificates', '/pt-br/articles/consulta-de-cadastros-com-certificacao-digital'],
    ['/articles/consulta-de-cadastros-com-certificacao-digital', '/articles/registry-lookup-with-digital-certificates']
  ]) {
    test(`${from} moves permanently to ${to}`, async ({ request }) => {
      const response = await request.get(from, { maxRedirects: 0 });
      expect([301, 308]).toContain(response.status());
      expect(response.headers().location).toBe(to);
    });
  }
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
    const notice = page.getByRole('complementary').filter({ has: page.locator('a[href="/privacy#cookies"]') });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('button')).toHaveCount(1);

    await notice.getByRole('button').click();
    await expect(notice).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('study-groups:cookie-notice-dismissed'))).toBe('1');

    await page.reload();
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('a[href="/privacy#cookies"]')).toHaveCount(0);
  });

  test('is shown in Portuguese on the pt-BR pages and on the app pages', async ({ page }) => {
    await page.goto('/pt-br/grupos-de-estudo-de-ingles');
    await expect(page.locator('a[href="/pt-br/privacy#cookies"]')).toBeVisible();

    await page.goto('/study-groups/my');
    await expect(page.locator('a[href="/privacy#cookies"]')).toBeVisible();
  });

  test('the privacy policy has the cookie section the notice links to', async ({ page }) => {
    for (const path of ['/privacy', '/pt-br/privacy']) {
      await page.goto(path);
      await expect(page.locator('#cookies')).toHaveCount(1);
    }
  });
});

test.describe('site pages', () => {
  test('no Portuguese page links to the old /pt-br/study-groups landing URL', async ({ page }) => {
    for (const path of ['/pt-br', '/pt-br/about', '/pt-br/projects/english-study-groups', '/pt-br/grupos-de-estudo-de-ingles', '/pt-br/study-groups/terms', '/pt-br/privacy']) {
      await page.goto(path);
      await expect(page.locator('a[href="/pt-br/study-groups"], a[href="/pt-br/study-groups#"]'), path).toHaveCount(0);
      await expect(page.locator('a[href="/pt-br/grupos-de-estudo-de-ingles"]').first(), path).toBeAttached();
    }
  });

  test('articles advertise and switch to the translated slug (S-1)', async ({ page }) => {
    await page.goto('/articles/registry-lookup-with-digital-certificates');
    await expect(page.locator('link[rel="alternate"][hreflang="pt-BR"]')).toHaveAttribute('href', `${siteUrl}/pt-br/articles/consulta-de-cadastros-com-certificacao-digital`);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${siteUrl}/images/og/tcc-digital-certificates.png`);
    const switcher = page.getByRole('link', { name: 'Português' }).filter({ visible: true });
    await switcher.click();
    await expect(page).toHaveURL(/\/pt-br\/articles\/consulta-de-cadastros-com-certificacao-digital$/);
    await expect(page.getByText(/min de leitura/)).toBeVisible();
  });

  test('every page has one h1, a skip link and a privacy notice on the contact form', async ({ page }) => {
    for (const path of ['/', '/about', '/works', '/projects', '/contact', '/pt-br', '/pt-br/contact']) {
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('a[href="#main"]')).toHaveCount(1);
    }
    await expect(page.getByRole('main').locator('a[href="/pt-br/privacy"]')).toBeVisible();
  });

  test('the resume menu works from the keyboard and Escape returns focus to its button (QA-F1)', async ({ page }) => {
    await page.goto('/about');
    const button = page.locator('header').getByRole('button', { name: 'Resume' }).filter({ visible: true });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: /English/ })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: /Português/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(button).toBeFocused();
  });

  test('project bodies open external links in a new tab with noopener and keep lists styled', async ({ page }) => {
    await page.goto('/projects/notaprofile');
    const signup = page.getByRole('article').getByRole('link', { name: 'Create your free account' });
    await expect(signup).toHaveAttribute('target', '_blank');
    await expect(signup).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(signup).toHaveAttribute('href', /utm_content=project-page-en/);
    expect(await page.getByRole('article').locator('ul').first().evaluate((list) => getComputedStyle(list).listStyleType)).toBe('disc');
    await expect(page.getByText(/Bauru/)).toHaveCount(0);
  });

  test('the mobile menu opens with 44px rows', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/about');
    await expect(page.locator('header').getByText('Filipe Rissi', { exact: true })).toBeVisible();
    await page.mouse.wheel(0, 800);
    await expect.poll(() => page.locator('header').evaluate((header) => getComputedStyle(header).backgroundColor)).toBe('rgb(10, 10, 10)');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.getByRole('button', { name: 'Menu' }).click();
    const contact = page.locator('#mobile-navigation').getByRole('link', { name: 'Contact' });
    expect((await contact.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await contact.click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.locator('#mobile-navigation')).toHaveCount(0);

    const toggle = page.getByRole('button', { name: 'Menu' });
    await toggle.click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-navigation')).toHaveCount(0);
    await expect(toggle).toBeFocused();
  });
});
