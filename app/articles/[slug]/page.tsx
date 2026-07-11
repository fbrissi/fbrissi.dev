import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArticlePage } from '@/components/site-pages';
import { getArticle, getArticleSlugs } from '@/lib/articles';
import { createPageMetadata } from '@/lib/seo';
import { getMessages } from '@/lib/site';

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return getArticleSlugs('en').map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle('en', slug);

  if (!article) {
    return {};
  }

  return createPageMetadata({
    locale: 'en',
    pathname: `/articles/${slug}`,
    title: `${article.title} | ${getMessages('en').site.name}`,
    description: article.description
  });
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticle('en', slug);

  if (!article) {
    notFound();
  }

  return <ArticlePage locale="en" slug={slug} />;
}
