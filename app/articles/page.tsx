import type { Metadata } from 'next';

import { ArticlesPage } from '@/components/site-pages';
import { createPageMetadata } from '@/lib/seo';
import { getMessages } from '@/lib/site';

export const metadata: Metadata = createPageMetadata({
  locale: 'en',
  pathname: '/articles',
  title: `Articles | ${getMessages('en').site.name}`,
  description: getMessages('en').pages.articles.description
});

export default function Page() {
  return <ArticlesPage locale="en" />;
}
