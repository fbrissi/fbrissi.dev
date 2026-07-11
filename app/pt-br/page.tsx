import type { Metadata } from 'next';

import { HomePage } from '@/components/site-pages';
import { createPageMetadata } from '@/lib/seo';
import { getMessages } from '@/lib/site';

export const metadata: Metadata = createPageMetadata({
  locale: 'pt-BR',
  pathname: '/',
  title: 'Filipe Bojikian Rissi | Portfólio',
  description: getMessages('pt-BR').site.description
});

export default function Page() {
  return <HomePage locale="pt-BR" />;
}
