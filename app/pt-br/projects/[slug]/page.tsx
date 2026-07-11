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
  return getProjectSlugs('pt-BR').map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject('pt-BR', slug);

  if (!project) {
    return {};
  }

  return createPageMetadata({
    locale: 'pt-BR',
    pathname: `/projects/${slug}`,
    title: `${project.title} | ${getMessages('pt-BR').site.name}`,
    description: project.description
  });
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const project = getProject('pt-BR', slug);

  if (!project) {
    notFound();
  }

  return <ProjectPage locale="pt-BR" slug={slug} />;
}
