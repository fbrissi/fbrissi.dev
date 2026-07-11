import type { Metadata } from 'next';

import { HomePage } from '@/components/site-pages';
import { createPageMetadata } from '@/lib/seo';
import { getMessages } from '@/lib/site';

export const metadata: Metadata = createPageMetadata({
  locale: 'en',
  pathname: '/',
  title: 'Filipe Bojikian Rissi | Portfolio',
  description: getMessages('en').site.description
});

export default function Page() {
  return <HomePage locale="en" />;
}
