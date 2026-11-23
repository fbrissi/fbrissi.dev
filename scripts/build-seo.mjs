import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
// Portuguese slugs that differ from the English path; the same source as src/lib/i18n.ts and the redirects.
const localizedSlugs = JSON.parse(fs.readFileSync(new URL('./localized-slugs.json', import.meta.url), 'utf8'));
const routeFor = (prefix, route) => `${prefix}${prefix ? localizedSlugs[route] ?? route : route}`;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VITE_SITE_URL ?? 'https://fbrissi.dev';
const locales = [
  { code: 'en', prefix: '' },
  { code: 'pt-BR', prefix: '/pt-br' }
];
const collections = [
  { name: 'articles', route: 'articles' },
  { name: 'contributions', route: 'open-source' },
  { name: 'projects', route: 'projects' },
  { name: 'works', route: 'works' }
];

function contentPath(...segments) {
  return path.join(root, 'src', 'content', ...segments);
}

function readSlugs(collection, locale) {
  const dir = contentPath(collection, locale);

  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => fileName.replace(/\.md$/, ''))
    .sort();
}

/** Date of the last commit that touched the file, or null outside a Git checkout or for uncommitted files. */
function gitDate(file) {
  try {
    const realFile = fs.realpathSync(file);
    const date = execFileSync('git', ['log', '-1', '--format=%cs', '--', path.basename(realFile)], { cwd: path.dirname(realFile), stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return date || null;
  } catch {
    return null;
  }
}

/** Articles use their front-matter `updated` or `date`; other content uses its last commit (S-4). */
function contentDate(file) {
  const frontMatter = fs.readFileSync(file, 'utf8').split('\n---', 1)[0];
  const declared = frontMatter.match(/^updated:\s*["']?(\d{4}-\d{2}-\d{2})/m) ?? frontMatter.match(/^date:\s*["']?(\d{4}-\d{2}-\d{2})/m);
  return declared?.[1] ?? gitDate(file);
}

function newest(dates) {
  return dates.filter(Boolean).sort().at(-1) ?? null;
}

const entries = [];

for (const { code, prefix } of locales) {
  // Home and About copy lives in the profile files and in the UI messages.
  const profileDate = newest([gitDate(contentPath('profile', `${code}.json`)), gitDate(contentPath('profile', `${code}.md`)), gitDate(path.join(root, 'src', 'i18n', 'messages', `${code}.json`))]);
  const detailDates = {};

  for (const { name, route } of collections) {
    detailDates[name] = readSlugs(name, code).map((slug) => {
      const lastmod = contentDate(contentPath(name, code, `${slug}.md`));
      entries.push({ route: `${prefix}/${route}/${slug}`, lastmod });
      return lastmod;
    });
  }

  const programDocument = (document) => gitDate(contentPath('study-groups', code, `${document}.md`));
  // Group pages (board, settings, join, account, admin) are noindex and never listed (D2).
  entries.push(
    { route: prefix || '/', lastmod: profileDate },
    { route: `${prefix}/about`, lastmod: profileDate },
    { route: `${prefix}/articles`, lastmod: newest(detailDates.articles) },
    { route: `${prefix}/projects`, lastmod: newest([...detailDates.projects, ...detailDates.contributions]) },
    { route: `${prefix}/works`, lastmod: newest(detailDates.works) },
    { route: `${prefix}/contact`, lastmod: null },
    { route: `${prefix}/privacy`, lastmod: programDocument('privacy') },
    // The landing copy lives in the UI messages.
    { route: routeFor(prefix, '/study-groups'), lastmod: gitDate(path.join(root, 'src', 'i18n', 'messages', `${code}.json`)) },
    { route: `${prefix}/study-groups/terms`, lastmod: programDocument('terms') }
  );
}

const sitemapEntries = entries
  .map(({ route, lastmod }) => `  <url>\n    <loc>${siteUrl}${route}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}  </url>`)
  .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`;

const robots = `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`;

fs.writeFileSync(path.join(root, 'public', 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(root, 'public', 'robots.txt'), robots);
