import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fbrissi.dev';

const staticRoutes = ['/', '/about', '/articles', '/projects', '/works', '/contact', '/pt-br', '/pt-br/about', '/pt-br/articles', '/pt-br/projects', '/pt-br/works', '/pt-br/contact'];

function readSlugs(collection, locale) {
  const dir = path.join(root, 'content', collection, locale);

  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => fileName.replace(/\.md$/, ''))
    .sort();
}

const routes = [
  ...staticRoutes,
  ...['articles', 'projects', 'works'].flatMap((collection) => readSlugs(collection, 'en').map((slug) => `/${collection}/${slug}`)),
  ...['articles', 'projects', 'works'].flatMap((collection) => readSlugs(collection, 'pt-BR').map((slug) => `/pt-br/${collection}/${slug}`))
];

const today = new Date().toISOString().slice(0, 10);

const sitemapEntries = routes
  .map((route) => {
    const isHome = route === '/' || route === '/pt-br';
    const isDetailPage = route.includes('/articles/') || route.includes('/projects/') || route.includes('/works/');
    const priority = isHome ? '1.0' : isDetailPage ? '0.7' : '0.8';
    const changefreq = isDetailPage ? 'monthly' : 'weekly';

    return `  <url>\n    <loc>${siteUrl}${route}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  })
  .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`;

const robots = `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`;

fs.writeFileSync(path.join(root, 'public', 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(root, 'public', 'robots.txt'), robots);
