import type { Metadata } from 'next';

import { AboutPage } from '@/components/site-pages';
import { createPageMetadata } from '@/lib/seo';
import { getMessages } from '@/lib/site';

export const metadata: Metadata = createPageMetadata({
  locale: 'pt-BR',
  pathname: '/about',
  title: `Sobre | ${getMessages('pt-BR').site.name}`,
  description: getMessages('pt-BR').pages.about.description
});

export default function Page() {
  return <AboutPage locale="pt-BR" />;
}
