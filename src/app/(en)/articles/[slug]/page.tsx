import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArticlePage } from '@/site-pages/article-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getArticle, getArticleSlugs, getArticleTranslationSlug } from '@/lib/articles';
import { getMessages } from '@/lib/site';

export function generateStaticParams() {
  return getArticleSlugs('en').map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle('en', slug);
  if (!article) return {};
  const messages = getMessages('en');
  const translationSlug = getArticleTranslationSlug('en', slug);
  return createNextMetadata({
    locale: 'en',
    pathname: `/articles/${slug}`,
    alternatePathname: translationSlug ? `/articles/${translationSlug}` : null,
    title: `${article.seoTitle ?? article.title} | ${messages.site.name}`,
    description: article.description,
    image: article.socialImage,
    type: 'article',
    publishedTime: article.date,
    modifiedTime: article.updated
  });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getArticle('en', slug)) notFound();
  return <ArticlePage locale="en" slug={slug} />;
}
