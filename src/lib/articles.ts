import { formatDate, localizedPath, type Locale } from './i18n';
import { parseMarkdown } from './markdown';
import { absoluteUrl } from './seo';

const articleSources = import.meta.glob<string>('/src/content/articles/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
});

type FrontMatter = {
  title: string;
  description: string;
  date: string;
  image?: string;
  imageAlt?: string;
  tags?: string[];
};

export type Article = FrontMatter & {
  slug: string;
  content: string;
  readingTime: string;
  url: string;
  dateLabel: string;
};

function readArticleFile(locale: Locale, slug: string): Article | null {
  const source = articleSources[`/src/content/articles/${locale}/${slug}.md`];
  if (!source) {
    return null;
  }
  const { data: frontMatter, content } = parseMarkdown<FrontMatter>(source);

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
  const prefix = `/src/content/articles/${locale}/`;
  return Object.keys(articleSources)
    .filter((fileName) => fileName.startsWith(prefix))
    .map((fileName) => fileName.slice(prefix.length).replace(/\.md$/, ''))
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
