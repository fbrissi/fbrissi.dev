import type { Metadata } from 'next';

import { ProjectsPage } from '@/components/site-pages';
import { createPageMetadata } from '@/lib/seo';
import { getMessages } from '@/lib/site';

export const metadata: Metadata = createPageMetadata({
  locale: 'pt-BR',
  pathname: '/projects',
  title: `Projetos | ${getMessages('pt-BR').site.name}`,
  description: getMessages('pt-BR').pages.projects.description
});

export default function Page() {
  return <ProjectsPage locale="pt-BR" />;
}
