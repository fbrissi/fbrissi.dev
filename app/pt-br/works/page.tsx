import type { Metadata } from 'next';

import { WorksPage } from '@/components/site-pages';
import { createPageMetadata } from '@/lib/seo';
import { getMessages } from '@/lib/site';

export const metadata: Metadata = createPageMetadata({
  locale: 'pt-BR',
  pathname: '/works',
  title: `Trabalhos | ${getMessages('pt-BR').site.name}`,
  description: getMessages('pt-BR').pages.works.description
});

export default function Page() {
  return <WorksPage locale="pt-BR" />;
}
