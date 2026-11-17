import { StudyGroupsPolicyPage } from '@/site-pages/study-groups-policy-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getMessages } from '@/lib/site';
import { getProgramDocument } from '@/lib/study-groups';

const document = getProgramDocument('pt-BR', 'privacy');
export const metadata = createNextMetadata({ locale: 'pt-BR', pathname: '/study-groups/privacy', title: `${document.title} | ${getMessages('pt-BR').studyGroups.title}`, description: document.description });

export default function Page() {
  return <StudyGroupsPolicyPage locale="pt-BR" document="privacy" />;
}
