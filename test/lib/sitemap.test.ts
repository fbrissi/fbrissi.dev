// @vitest-environment node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
let workDir: string | undefined;

afterEach(() => {
  if (workDir) fs.rmSync(workDir, { recursive: true, force: true });
  workDir = undefined;
});

function runScript(script: string, env: Record<string, string | undefined>) {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'build-'));
  fs.mkdirSync(path.join(workDir, 'public'));
  fs.symlinkSync(path.join(rootDir, 'src'), path.join(workDir, 'src'));
  execFileSync(process.execPath, [path.join(rootDir, 'scripts', script)], { cwd: workDir, env: { ...process.env, ...env }, stdio: 'pipe' });
  return (file: string) => fs.readFileSync(path.join(workDir!, 'public', file), 'utf8');
}

describe('sitemap', () => {
  it('lists the program pages in both locales but never group pages or the old board (D1, D2)', () => {
    const read = runScript('build-seo.mjs', { NEXT_PUBLIC_SITE_URL: 'https://example.com', STUDY_GROUP_SLUG: 'secret-slug' });
    const sitemap = read('sitemap.xml');
    const robots = read('robots.txt');

    expect(sitemap).toContain('<loc>https://example.com/contact</loc>');
    for (const route of ['/study-groups', '/study-groups/terms', '/privacy', '/pt-br/grupos-de-estudo-de-ingles', '/pt-br/study-groups/terms', '/pt-br/privacy']) {
      expect(sitemap).toContain(`<loc>https://example.com${route}</loc>`);
    }
    expect(sitemap).not.toMatch(/study-group\/|secret-slug|study-groups\/(g|group|new|my|account|welcome|admin)\b/);
    expect(robots).not.toMatch(/study-group|secret-slug/);
    expect(sitemap).not.toContain('<loc>https://example.com/pt-br/study-groups</loc>');
  });

  it('lists the merged projects page instead of the open-source index and keeps the contribution pages (D-3)', () => {
    const sitemap = runScript('build-seo.mjs', { NEXT_PUBLIC_SITE_URL: 'https://example.com' })('sitemap.xml');

    expect(sitemap).not.toMatch(/<loc>https:\/\/example\.com(\/pt-br)?\/open-source<\/loc>/);
    expect(sitemap).toContain('<loc>https://example.com/open-source/keycloak</loc>');
    expect(sitemap).toContain('<loc>https://example.com/pt-br/projects</loc>');
    expect(sitemap).not.toMatch(/changefreq|priority/);
  });

  it('dates articles from their front matter and list pages from their newest item (S-4)', () => {
    const sitemap = runScript('build-seo.mjs', { NEXT_PUBLIC_SITE_URL: 'https://example.com' })('sitemap.xml');

    expect(sitemap).toContain('<loc>https://example.com/articles/registry-lookup-with-digital-certificates</loc>\n    <lastmod>2010-12-01</lastmod>');
    expect(sitemap).toContain('<loc>https://example.com/pt-br/articles</loc>\n    <lastmod>2010-12-01</lastmod>');
    expect(sitemap).toMatch(/<loc>https:\/\/example\.com\/works\/pagbank<\/loc>\n {4}<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    expect(sitemap).toContain('<loc>https://example.com/contact</loc>\n  </url>');
  });

  it('serves the app pages with noindex and no-referrer headers, and keeps the program pages indexable', () => {
    const headers = fs.readFileSync(path.join(rootDir, 'public/_headers'), 'utf8');

    for (const route of ['/study-group/*', '/study-groups/g/*', '/study-groups/group', '/study-groups/group/*', '/study-groups/new', '/study-groups/my', '/study-groups/account', '/study-groups/welcome', '/study-groups/admin']) {
      expect(headers).toContain(`${route}\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n`);
    }
    expect(headers).not.toMatch(/^\/study-groups\/?\*?$/m);
    expect(headers).not.toMatch(/^\/study-groups\/(terms|privacy)$/m);
    expect(headers).not.toMatch(/^\/pt-br/m);
  });

  it('caches hashed Next.js assets forever and sends the security headers on every page (S-2, S-3)', () => {
    const headers = fs.readFileSync(path.join(rootDir, 'public/_headers'), 'utf8');

    expect(headers).toContain('/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n');
    expect(headers).not.toContain('/assets/*');
    const site = headers.split(/\n\s*\n/).find((block) => block.split('\n').some((line) => line === '/*'));
    expect(site).toMatch(/Strict-Transport-Security: max-age=31536000; includeSubDomains/);
    expect(site).toMatch(/X-Frame-Options: DENY/);
    expect(site).toMatch(/Content-Security-Policy: .*script-src 'self' 'unsafe-inline' https:\/\/challenges\.cloudflare\.com;.*frame-src https:\/\/challenges\.cloudflare\.com;.*frame-ancestors 'none'/);
  });
});

describe('redirects', () => {
  it('moves the old pages with 301s and rewrites group URLs to the static shells', () => {
    const redirects = runScript('build-redirects.mjs', { STUDY_GROUP_SLUG: '' })('_redirects');
    expect(redirects).toBe([
      '/open-source  /projects#open-source  301',
      '/pt-br/open-source  /pt-br/projects#open-source  301',
      '/study-groups/privacy  /privacy  301',
      '/pt-br/study-groups/privacy  /pt-br/privacy  301',
      '/pt-br/articles/registry-lookup-with-digital-certificates  /pt-br/articles/consulta-de-cadastros-com-certificacao-digital  301',
      '/articles/consulta-de-cadastros-com-certificacao-digital  /articles/registry-lookup-with-digital-certificates  301',
      // Generated from scripts/localized-slugs.json, the source the site and the sitemap also read (R4).
      '/pt-br/study-groups  /pt-br/grupos-de-estudo-de-ingles  301',
      '/study-groups/g/:id/settings  /study-groups/group/settings  200',
      '/study-groups/g/:id  /study-groups/group  200',
      ''
    ].join('\n'));
  });

  it('moves the retired secret-slug board to the DevTalk group with a 301 (Q21)', () => {
    const redirects = runScript('build-redirects.mjs', { STUDY_GROUP_SLUG: ' secret-slug_1 ' })('_redirects');
    expect(redirects.split('\n').slice(7, 9)).toEqual([
      '/study-group/secret-slug_1/settings  /study-groups/g/devtalk/settings  301',
      '/study-group/secret-slug_1  /study-groups/g/devtalk  301'
    ]);
  });

  it('rejects a slug that could inject rules', () => {
    expect(() => runScript('build-redirects.mjs', { STUDY_GROUP_SLUG: 'a b /x 200' })).toThrow();
  });
});
