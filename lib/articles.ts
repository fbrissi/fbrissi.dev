import fs from 'node:fs';
import path from 'node:path';

import matter from 'gray-matter';

import { formatDate, localizedPath, type Locale } from './i18n';
import { absoluteUrl } from './seo';

const articlesRoot = path.join(process.cwd(), 'content/articles');

type FrontMatter = {
  title: string;
  description: string;
  date: string;
  tags?: string[];
};

export type Article = FrontMatter & {
  slug: string;
  content: string;
  readingTime: string;
  url: string;
  dateLabel: string;
};

function getLocaleDir(locale: Locale): string {
  return path.join(articlesRoot, locale);
}

function readArticleFile(locale: Locale, slug: string): Article | null {
  const filePath = path.join(getLocaleDir(locale), `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const source = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(source);
  const frontMatter = data as FrontMatter;

  return {
    ...frontMatter,
    slug,
    content,
    readingTime: estimateReadingTime(content),
    url: absoluteUrl(localizedPath(locale, `/articles/${slug}`)),
    dateLabel: formatDate(frontMatter.date, locale)
  };
}

function estimateReadingTime(content: string): string {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(wordCount / 200))} min read`;
}

export function getArticleSlugs(locale: Locale): string[] {
  const directory = getLocaleDir(locale);

  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory)
    .filter((fileName) => fileName.endsWith('.md'))
    .map((fileName) => fileName.replace(/\.md$/, ''))
    .sort();
}

export function getArticles(locale: Locale): Article[] {
  return getArticleSlugs(locale)
    .map((slug) => readArticleFile(locale, slug))
    .filter((article): article is Article => article !== null)
    .sort((left, right) => right.date.localeCompare(left.date));
}

export function getArticle(locale: Locale, slug: string): Article | null {
  return readArticleFile(locale, slug);
}
