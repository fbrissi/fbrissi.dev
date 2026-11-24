import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
// Pages that moved (D-3, D-7) and the cross-locale article URLs once advertised by hreflang (S-1). Shared with `next dev`.
const siteRedirects = JSON.parse(fs.readFileSync(new URL('./site-redirects.json', import.meta.url), 'utf8'));
// The mirrored Portuguese path of each page with its own Portuguese slug moves to that slug.
const localizedSlugs = JSON.parse(fs.readFileSync(new URL('./localized-slugs.json', import.meta.url), 'utf8'));
const slugRedirects = Object.entries(localizedSlugs).map(([english, portuguese]) => ({ source: `/pt-br${english}`, destination: `/pt-br${portuguese}` }));
const moved = [...siteRedirects, ...slugRedirects];
const slug = process.env.STUDY_GROUP_SLUG?.trim();

// Groups are created at runtime, so every group URL is served by one static shell that reads the ID on the client.
const lines = [
  ...moved.map(({ source, destination }) => `${source}  ${destination}  301`),
  '/study-groups/g/:id/settings  /study-groups/group/settings  200',
  '/study-groups/g/:id  /study-groups/group  200'
];

// The retired secret-slug URL of the DevTalk board (v0.3) moves to its group page. The slug is a build secret, so this
// file is generated and never committed.
if (slug) {
  if (!/^[A-Za-z0-9_-]+$/.test(slug)) {
    throw new Error('STUDY_GROUP_SLUG may only contain letters, digits, "-" and "_"');
  }
  lines.splice(moved.length, 0, `/study-group/${slug}/settings  /study-groups/g/devtalk/settings  301`, `/study-group/${slug}  /study-groups/g/devtalk  301`);
}

fs.writeFileSync(path.join(root, 'public', '_redirects'), `${lines.join('\n')}\n`);
