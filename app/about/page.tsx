import type { Metadata } from 'next';

import { AboutPage } from '@/components/site-pages';
import { createPageMetadata } from '@/lib/seo';
import { getMessages } from '@/lib/site';

export const metadata: Metadata = createPageMetadata({
  locale: 'en',
  pathname: '/about',
  title: `About | ${getMessages('en').site.name}`,
  description: getMessages('en').pages.about.description
});

export default function Page() {
  return <AboutPage locale="en" />;
}
