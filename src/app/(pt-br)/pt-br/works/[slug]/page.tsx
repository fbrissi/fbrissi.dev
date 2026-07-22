import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { WorkPage } from '@/site-pages/work-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getMessages } from '@/lib/site';
import { getWork, getWorkSlugs } from '@/lib/works';

export function generateStaticParams() {
  return getWorkSlugs('pt-BR').map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const work = getWork('pt-BR', slug);
  if (!work) return {};
  const messages = getMessages('pt-BR');
  return createNextMetadata({ locale: 'pt-BR', pathname: `/works/${slug}`, title: `${work.title} na ${work.company} | ${messages.site.name}`, description: work.summary, keywords: work.skills });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getWork('pt-BR', slug)) notFound();
  return <WorkPage locale="pt-BR" slug={slug} />;
}
