import { AboutPage } from '@/site-pages/about-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getMessages } from '@/lib/site';

const messages = getMessages('pt-BR');
export const metadata = createNextMetadata({ locale: 'pt-BR', pathname: '/about', title: `${messages.pages.about.title} | ${messages.site.name}`, description: messages.pages.about.description });

export default function Page() {
  return <AboutPage locale="pt-BR" />;
}
