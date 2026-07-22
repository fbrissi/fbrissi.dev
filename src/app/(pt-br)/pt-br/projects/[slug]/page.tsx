import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProjectPage } from '@/site-pages/project-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getProject, getProjectSlugs } from '@/lib/projects';
import { getMessages } from '@/lib/site';

export function generateStaticParams() {
  return getProjectSlugs('pt-BR').map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject('pt-BR', slug);
  if (!project) return {};
  const messages = getMessages('pt-BR');
  return createNextMetadata({ locale: 'pt-BR', pathname: `/projects/${slug}`, title: `${project.title} | ${messages.site.name}`, description: project.description, keywords: project.stack });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getProject('pt-BR', slug)) notFound();
  return <ProjectPage locale="pt-BR" slug={slug} />;
}
