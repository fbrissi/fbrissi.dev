import { PrivacyPage } from '@/site-pages/privacy-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getMessages } from '@/lib/site';
import { getProgramDocument } from '@/lib/study-groups';

const document = getProgramDocument('en', 'privacy');
export const metadata = createNextMetadata({ locale: 'en', pathname: '/privacy', title: `${document.title} | ${getMessages('en').site.name}`, description: document.description });

export default function Page() {
  return <PrivacyPage locale="en" />;
}
