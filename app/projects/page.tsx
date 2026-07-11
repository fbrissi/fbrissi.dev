import type { Metadata } from 'next';

import { ProjectsPage } from '@/components/site-pages';
import { createPageMetadata } from '@/lib/seo';
import { getMessages } from '@/lib/site';

export const metadata: Metadata = createPageMetadata({
  locale: 'en',
  pathname: '/projects',
  title: `Projects | ${getMessages('en').site.name}`,
  description: getMessages('en').pages.projects.description
});

export default function Page() {
  return <ProjectsPage locale="en" />;
}
