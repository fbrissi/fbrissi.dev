import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const slug = process.env.STUDY_GROUP_SLUG?.trim();

// Groups are created at runtime, so every group URL is served by one static shell that reads the ID on the client.
const lines = [
  '/study-groups/g/:id/settings  /study-groups/group/settings  200',
  '/study-groups/g/:id  /study-groups/group  200'
];

// The retired secret-slug URL of the DevTalk board (v0.3) moves to its group page. The slug is a build secret, so this
// file is generated and never committed.
if (slug) {
  if (!/^[A-Za-z0-9_-]+$/.test(slug)) {
    throw new Error('STUDY_GROUP_SLUG may only contain letters, digits, "-" and "_"');
  }
  lines.unshift(`/study-group/${slug}/settings  /study-groups/g/devtalk/settings  301`, `/study-group/${slug}  /study-groups/g/devtalk  301`);
}

fs.writeFileSync(path.join(root, 'public', '_redirects'), `${lines.join('\n')}\n`);
