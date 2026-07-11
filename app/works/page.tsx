import type { Metadata } from 'next';

import { WorksPage } from '@/components/site-pages';
import { createPageMetadata } from '@/lib/seo';
import { getMessages } from '@/lib/site';

export const metadata: Metadata = createPageMetadata({
  locale: 'en',
  pathname: '/works',
  title: `Works | ${getMessages('en').site.name}`,
  description: getMessages('en').pages.works.description
});

export default function Page() {
  return <WorksPage locale="en" />;
}
