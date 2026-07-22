import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArticlePage } from '@/site-pages/article-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getArticle, getArticleSlugs } from '@/lib/articles';
import { getMessages } from '@/lib/site';

export function generateStaticParams() {
  return getArticleSlugs('pt-BR').map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle('pt-BR', slug);
  if (!article) return {};
  const messages = getMessages('pt-BR');
  return createNextMetadata({ locale: 'pt-BR', pathname: `/articles/${slug}`, title: `${article.title} | ${messages.site.name}`, description: article.description, keywords: article.tags, type: 'article' });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getArticle('pt-BR', slug)) notFound();
  return <ArticlePage locale="pt-BR" slug={slug} />;
}
