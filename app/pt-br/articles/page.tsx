import type { Metadata } from 'next';

import { ArticlesPage } from '@/components/site-pages';
import { createPageMetadata } from '@/lib/seo';
import { getMessages } from '@/lib/site';

export const metadata: Metadata = createPageMetadata({
  locale: 'pt-BR',
  pathname: '/articles',
  title: `Artigos | ${getMessages('pt-BR').site.name}`,
  description: getMessages('pt-BR').pages.articles.description
});

export default function Page() {
  return <ArticlesPage locale="pt-BR" />;
}
