import { ProjectsPage } from '@/site-pages/projects-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getMessages } from '@/lib/site';

const messages = getMessages('pt-BR');
export const metadata = createNextMetadata({ locale: 'pt-BR', pathname: '/projects', title: `${messages.pages.projects.title} | ${messages.site.name}`, description: messages.pages.projects.description });

export default function Page() {
  return <ProjectsPage locale="pt-BR" />;
}
