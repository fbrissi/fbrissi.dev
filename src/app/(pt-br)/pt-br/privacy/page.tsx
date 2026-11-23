import { PrivacyPage } from '@/site-pages/privacy-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getMessages } from '@/lib/site';
import { getProgramDocument } from '@/lib/study-groups';

const document = getProgramDocument('pt-BR', 'privacy');
export const metadata = createNextMetadata({ locale: 'pt-BR', pathname: '/privacy', title: `${document.title} | ${getMessages('pt-BR').site.name}`, description: document.description });

export default function Page() {
  return <PrivacyPage locale="pt-BR" />;
}
