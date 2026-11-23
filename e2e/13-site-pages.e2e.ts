import { expect, test } from '@playwright/test';

import { uniqueSuffix } from './support';

// e2e/features/public-site.feature: portfolio SEO, the Open Source highlight, phone layouts and the contact email.
const siteUrl = 'https://fbrissi.dev';
const mailpitUrl = process.env.E2E_MAILPIT_URL ?? 'http://mailpit:8025';
const contactApiUrl = process.env.E2E_CONTACT_API_URL ?? 'http://contact-api:8787/api/contact';

test.describe('portfolio pages', () => {
  for (const path of ['/', '/pt-br', '/about', '/pt-br/about', '/works', '/pt-br/works', '/projects', '/pt-br/projects', '/contact', '/pt-br/contact']) {
    test(`${path} is indexable in its language with canonical, hreflang and Open Graph tags`, async ({ page }) => {
      const portuguese = path.startsWith('/pt-br');
      const english = portuguese ? path.replace(/^\/pt-br/, '') || '/' : path;
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', portuguese ? 'pt-BR' : 'en');
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^index, follow/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${siteUrl}${path === '/' ? '' : path}`);
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', `${siteUrl}${english === '/' ? '' : english}`);
      await expect(page.locator('link[rel="alternate"][hreflang="pt-BR"]')).toHaveAttribute('href', `${siteUrl}/pt-br${english === '/' ? '' : english}`);
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{40,}/);
    });
  }

  test('the projects page shows the Open Source section with the Kool Dev #542 highlight in both locales', async ({ page }) => {
    for (const path of ['/projects', '/pt-br/projects']) {
      await page.goto(path);
      const section = page.locator('section#open-source');
      await expect(section).toBeVisible();
      await expect(section.locator('a[href="https://github.com/kool-dev/kool/pull/542"]')).toBeVisible();
      await expect(section.locator('a[href$="/open-source/kool-dev"]').first()).toBeVisible();
    }
  });

  test('the contact form has no consent checkbox and links to the privacy policy', async ({ page }) => {
    for (const [path, privacy] of [['/contact', '/privacy'], ['/pt-br/contact', '/pt-br/privacy']]) {
      await page.goto(path);
      const form = page.getByRole('main').locator('form');
      await expect(form).toBeVisible();
      await expect(form.getByRole('checkbox')).toHaveCount(0);
      await expect(page.getByRole('main').locator(`a[href="${privacy}"]`).first()).toBeVisible();
    }
  });

  test('a contact form submission reaches the contact inbox', async () => {
    const token = `contact-${uniqueSuffix()}`;
    const response = await fetch(contactApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
      body: JSON.stringify({ name: 'Contact Tester', email: `${token}@example.test`, subject: `Hello ${token}`, message: `A message from the E2E suite (${token}).`, locale: 'en', 'cf-turnstile-response': 'local-test-token' })
    });
    expect(response.status).toBe(202);
    let found: { ID: string } | undefined;
    await expect.poll(async () => {
      const search = (await (await fetch(`${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"contact@fbrissi.dev" ${token}`)}`)).json()) as { messages: { ID: string }[] };
      found = search.messages[0];
      return Boolean(found);
    }, { timeout: 30_000 }).toBe(true);
    const mail = (await (await fetch(`${mailpitUrl}/api/v1/message/${found!.ID}`)).json()) as { From: { Address: string }; ReplyTo: { Address: string }[]; Text: string };
    expect(mail.From.Address).toBe('no-reply@fbrissi.dev');
    expect(mail.ReplyTo.map((item) => item.Address)).toEqual([`${token}@example.test`]);
    expect(mail.Text).toContain(token);
  });
});

test.describe('phone layout', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const path of ['/', '/pt-br', '/projects', '/contact', '/privacy', '/pt-br/privacy', '/study-groups', '/pt-br/grupos-de-estudo-de-ingles']) {
    test(`${path} has no horizontal scroll at 375px`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
