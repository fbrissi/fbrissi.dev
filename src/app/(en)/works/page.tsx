import { WorksPage } from '@/site-pages/works-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getMessages } from '@/lib/site';

const messages = getMessages('en');
export const metadata = createNextMetadata({ locale: 'en', pathname: '/works', title: `${messages.pages.works.title} | ${messages.site.name}`, description: messages.pages.works.description });

export default function Page() {
  return <WorksPage locale="en" />;
}
