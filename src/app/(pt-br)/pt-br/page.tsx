import { HomePage } from '@/site-pages/home-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getMessages } from '@/lib/site';

const messages = getMessages('pt-BR');
export const metadata = createNextMetadata({
  locale: 'pt-BR',
  pathname: '/',
  title: `${messages.site.name} | ${messages.site.jobTitle}`,
  description: messages.home.description
});

export default function Page() {
  return <HomePage locale="pt-BR" />;
}
