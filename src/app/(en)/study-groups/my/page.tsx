import { MyGroupsPage } from '@/site-pages/study-group-pages';
import { createUnlistedNextMetadata } from '@/lib/next-metadata';

export const metadata = createUnlistedNextMetadata({ title: 'My study groups', description: 'Your English study groups.' });

export default function Page() {
  return <MyGroupsPage />;
}
