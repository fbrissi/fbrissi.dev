import { HomePage } from '@/site-pages/home-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getProfile } from '@/lib/site';

export const metadata = createNextMetadata({
  locale: 'pt-BR',
  pathname: '/',
  title: 'Filipe Bojikian Rissi | Portfólio',
  description: getProfile('pt-BR').summary,
  keywords: getProfile('pt-BR').skills.flatMap((group) => group.items)
});

export default function Page() {
  return <HomePage locale="pt-BR" />;
}
