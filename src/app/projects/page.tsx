import { ProjectsPage } from '@/site-pages/projects-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getMessages } from '@/lib/site';

const messages = getMessages('en');
export const metadata = createNextMetadata({ locale: 'en', pathname: '/projects', title: `${messages.pages.projects.title} | ${messages.site.name}`, description: messages.pages.projects.description });

export default function Page() {
  return <ProjectsPage locale="en" />;
}
