import { ArticlesPage } from '@/site-pages/articles-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getMessages } from '@/lib/site';

const messages = getMessages('en');
export const metadata = createNextMetadata({ locale: 'en', pathname: '/articles', title: `${messages.pages.articles.title} | ${messages.site.name}`, description: messages.pages.articles.description });

export default function Page() {
  return <ArticlesPage locale="en" />;
}
