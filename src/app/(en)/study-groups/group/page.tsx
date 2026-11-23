import { GroupBoardPage } from '@/site-pages/study-group-pages';
import { createUnlistedNextMetadata } from '@/lib/next-metadata';

export const metadata = createUnlistedNextMetadata({ title: 'Study group', description: 'Study group board.' });

export default function Page() {
  return <GroupBoardPage />;
}
