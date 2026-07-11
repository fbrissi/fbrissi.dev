import type { Metadata } from 'next';

import { ContactPage } from '@/components/site-pages';
import { createPageMetadata } from '@/lib/seo';
import { getMessages } from '@/lib/site';

export const metadata: Metadata = createPageMetadata({
  locale: 'en',
  pathname: '/contact',
  title: `Contact | ${getMessages('en').site.name}`,
  description: getMessages('en').pages.contact.description
});

export default function Page() {
  return <ContactPage locale="en" />;
}
