import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProjectPage } from '@/components/site-pages';
import { getProject, getProjectSlugs } from '@/lib/projects';
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
  return getProjectSlugs('en').map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject('en', slug);

  if (!project) {
    return {};
  }

  return createPageMetadata({
    locale: 'en',
    pathname: `/projects/${slug}`,
    title: `${project.title} | ${getMessages('en').site.name}`,
    description: project.description
  });
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const project = getProject('en', slug);

  if (!project) {
    notFound();
  }

  return <ProjectPage locale="en" slug={slug} />;
}
