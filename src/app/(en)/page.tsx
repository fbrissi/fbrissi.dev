import { HomePage } from '@/site-pages/home-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getProfile } from '@/lib/site';

export const metadata = createNextMetadata({
  locale: 'en',
  pathname: '/',
  title: 'Filipe Bojikian Rissi | Staff Software Engineer',
  description: getProfile('en').summary,
  keywords: getProfile('en').skills.flatMap((group) => group.items)
});

export default function Page() {
  return <HomePage locale="en" />;
}
