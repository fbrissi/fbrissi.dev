import { StudyGroupsPolicyPage } from '@/site-pages/study-groups-policy-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getMessages } from '@/lib/site';
import { getProgramDocument } from '@/lib/study-groups';

const document = getProgramDocument('en', 'terms');
export const metadata = createNextMetadata({ locale: 'en', pathname: '/study-groups/terms', title: `${document.title} | ${getMessages('en').studyGroups.title}`, description: document.description });

export default function Page() {
  return <StudyGroupsPolicyPage locale="en" document="terms" />;
}
