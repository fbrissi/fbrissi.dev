import { AdminPage } from '@/site-pages/study-group-pages';
import { createUnlistedNextMetadata } from '@/lib/next-metadata';

export const metadata = createUnlistedNextMetadata({ title: 'Study groups moderation', description: 'Platform moderation.' });

export default function Page() {
  return <AdminPage />;
}
