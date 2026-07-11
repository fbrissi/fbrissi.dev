import type { Metadata } from 'next';

import { ContactPage } from '@/components/site-pages';
import { createPageMetadata } from '@/lib/seo';
import { getMessages } from '@/lib/site';

export const metadata: Metadata = createPageMetadata({
  locale: 'pt-BR',
  pathname: '/contact',
  title: `Contato | ${getMessages('pt-BR').site.name}`,
  description: getMessages('pt-BR').pages.contact.description
});

export default function Page() {
  return <ContactPage locale="pt-BR" />;
}
