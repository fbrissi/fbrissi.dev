import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { WorkPage } from '@/site-pages/work-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getWork, getWorkSlugs } from '@/lib/works';
import { getMessages } from '@/lib/site';

export function generateStaticParams() {
  return getWorkSlugs('en').map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const work = getWork('en', slug);
  if (!work) return {};
  const messages = getMessages('en');
  return createNextMetadata({ locale: 'en', pathname: `/works/${slug}`, title: `${work.title} at ${work.company} | ${messages.site.name}`, description: work.summary, keywords: work.skills });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getWork('en', slug)) notFound();
  return <WorkPage locale="en" slug={slug} />;
}
