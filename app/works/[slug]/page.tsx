import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { WorkDetailPage } from '@/components/site-pages';
import { getWork, getWorkSlugs } from '@/lib/works';
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
  return getWorkSlugs('en').map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const work = getWork('en', slug);

  if (!work) {
    return {};
  }

  return createPageMetadata({
    locale: 'en',
    pathname: `/works/${slug}`,
    title: `${work.company} | ${getMessages('en').site.name}`,
    description: work.summary
  });
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const work = getWork('en', slug);

  if (!work) {
    notFound();
  }

  return <WorkDetailPage locale="en" slug={slug} />;
}
