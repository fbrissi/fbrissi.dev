import { StudyGroupsLandingPage } from '@/site-pages/study-groups-landing-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getMessages } from '@/lib/site';

const messages = getMessages('en');
export const metadata = createNextMetadata({ locale: 'en', pathname: '/study-groups', title: `${messages.studyGroups.seoTitle} | ${messages.site.name}`, description: messages.studyGroups.seoDescription });

export default function Page() {
  return <StudyGroupsLandingPage locale="en" />;
}
