import { StudyGroupsLandingPage } from '@/site-pages/study-groups-landing-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getMessages } from '@/lib/site';

const messages = getMessages('pt-BR');
export const metadata = createNextMetadata({ locale: 'pt-BR', pathname: '/study-groups', title: `${messages.studyGroups.title} | ${messages.site.name}`, description: messages.studyGroups.description });

export default function Page() {
  return <StudyGroupsLandingPage locale="pt-BR" />;
}
