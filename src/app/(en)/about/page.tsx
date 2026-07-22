import { AboutPage } from '@/site-pages/about-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getMessages } from '@/lib/site';

const messages = getMessages('en');
export const metadata = createNextMetadata({ locale: 'en', pathname: '/about', title: `${messages.pages.about.title} | ${messages.site.name}`, description: messages.pages.about.description });

export default function Page() {
  return <AboutPage locale="en" />;
}
