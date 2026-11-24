import { formatDate, getAlternateLocale, localizedPath, type Locale } from './i18n';
import { parseMarkdown } from './markdown';
import { absoluteUrl } from './seo';
import { getMessages } from './site';
import { markdownSources } from '@/generated/content-data';

type FrontMatter = {
  title: string;
  description: string;
  date: string;
  updated?: string;
  seoTitle?: string;
  translationKey?: string;
  socialImage?: string;
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
  const source = markdownSources[`articles/${locale}/${slug}` as keyof typeof markdownSources];
  if (!source) {
    return null;
  }
  const { data: frontMatter, content } = parseMarkdown<FrontMatter>(source);

  return {
    ...frontMatter,
    slug,
    content,
    readingTime: estimateReadingTime(content, locale),
    url: absoluteUrl(localizedPath(locale, `/articles/${slug}`)),
    dateLabel: formatDate(frontMatter.date, locale)
  };
}

function estimateReadingTime(content: string, locale: Locale): string {
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(wordCount / 200))} ${getMessages(locale).labels.readTime}`;
}

export function getArticleSlugs(locale: Locale): string[] {
  const prefix = `articles/${locale}/`;
  return Object.keys(markdownSources)
    .filter((fileName) => fileName.startsWith(prefix))
    .map((fileName) => fileName.slice(prefix.length))
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

/** The slug of the same article in the other locale, matched by `translationKey`, or null when it has no translation. */
export function getArticleTranslationSlug(locale: Locale, slug: string): string | null {
  const translationKey = getArticle(locale, slug)?.translationKey;
  if (!translationKey) return null;
  return getArticles(getAlternateLocale(locale)).find((article) => article.translationKey === translationKey)?.slug ?? null;
}
