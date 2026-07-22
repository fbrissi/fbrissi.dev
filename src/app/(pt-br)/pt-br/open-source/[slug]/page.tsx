import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ContributionPage } from '@/site-pages/contribution-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getContribution, getContributionSlugs } from '@/lib/contributions';
import { getMessages } from '@/lib/site';

export function generateStaticParams() {
  return getContributionSlugs('pt-BR').map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const contribution = getContribution('pt-BR', slug);
  if (!contribution) return {};
  const messages = getMessages('pt-BR');
  return createNextMetadata({ locale: 'pt-BR', pathname: `/open-source/${slug}`, title: `${contribution.title} | ${messages.site.name}`, description: contribution.description, keywords: contribution.tags });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getContribution('pt-BR', slug)) notFound();
  return <ContributionPage locale="pt-BR" slug={slug} />;
}
