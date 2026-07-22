import { ContributionsPage } from '@/site-pages/contributions-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getMessages } from '@/lib/site';

const messages = getMessages('pt-BR');
export const metadata = createNextMetadata({ locale: 'pt-BR', pathname: '/open-source', title: `${messages.pages.openSource.title} | ${messages.site.name}`, description: messages.pages.openSource.description });

export default function Page() {
  return <ContributionsPage locale="pt-BR" />;
}
