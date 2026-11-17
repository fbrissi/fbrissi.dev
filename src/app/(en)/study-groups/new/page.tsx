import { NewGroupPage } from '@/site-pages/study-group-pages';
import { createUnlistedNextMetadata } from '@/lib/next-metadata';

export const metadata = createUnlistedNextMetadata({ title: 'Create a study group', description: 'Create an English study group.' });

export default function Page() {
  return <NewGroupPage />;
}
