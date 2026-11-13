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

describe('sitemap', () => {
  it('never lists the unlisted study group board', () => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-'));
    fs.mkdirSync(path.join(workDir, 'public'));
    fs.symlinkSync(path.join(rootDir, 'src'), path.join(workDir, 'src'));

    execFileSync(process.execPath, [path.join(rootDir, 'scripts/build-seo.mjs')], {
      cwd: workDir,
      env: { ...process.env, NEXT_PUBLIC_SITE_URL: 'https://example.com', STUDY_GROUP_SLUG: 'secret-slug' }
    });

    const sitemap = fs.readFileSync(path.join(workDir, 'public/sitemap.xml'), 'utf8');
    const robots = fs.readFileSync(path.join(workDir, 'public/robots.txt'), 'utf8');

    expect(sitemap).toContain('<loc>https://example.com/contact</loc>');
    expect(sitemap).not.toMatch(/study-group|secret-slug/);
    expect(robots).not.toMatch(/study-group|secret-slug/);
  });

  it('serves the board with noindex and no-referrer headers', () => {
    const headers = fs.readFileSync(path.join(rootDir, 'public/_headers'), 'utf8');

    expect(headers).toMatch(/\/study-group\/\*\n {2}X-Robots-Tag: noindex, nofollow\n {2}Referrer-Policy: no-referrer/);
  });
});
