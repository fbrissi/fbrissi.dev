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
    for (const route of ['/study-groups', '/study-groups/terms', '/study-groups/privacy', '/pt-br/study-groups', '/pt-br/study-groups/terms', '/pt-br/study-groups/privacy']) {
      expect(sitemap).toContain(`<loc>https://example.com${route}</loc>`);
    }
    expect(sitemap).not.toMatch(/study-group\/|secret-slug|study-groups\/(g|group|new|my|account|welcome|admin)\b/);
    expect(robots).not.toMatch(/study-group|secret-slug/);
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
});

describe('redirects', () => {
  it('rewrites group URLs to the static shells', () => {
    const redirects = runScript('build-redirects.mjs', { STUDY_GROUP_SLUG: '' })('_redirects');
    expect(redirects).toBe('/study-groups/g/:id/settings  /study-groups/group/settings  200\n/study-groups/g/:id  /study-groups/group  200\n');
  });

  it('moves the retired secret-slug board to the DevTalk group with a 301 (Q21)', () => {
    const redirects = runScript('build-redirects.mjs', { STUDY_GROUP_SLUG: ' secret-slug_1 ' })('_redirects');
    expect(redirects.split('\n').slice(0, 2)).toEqual([
      '/study-group/secret-slug_1/settings  /study-groups/g/devtalk/settings  301',
      '/study-group/secret-slug_1  /study-groups/g/devtalk  301'
    ]);
  });

  it('rejects a slug that could inject rules', () => {
    expect(() => runScript('build-redirects.mjs', { STUDY_GROUP_SLUG: 'a b /x 200' })).toThrow();
  });
});
