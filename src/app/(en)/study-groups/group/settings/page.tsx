import { GroupSettingsPage } from '@/site-pages/study-group-pages';
import { createUnlistedNextMetadata } from '@/lib/next-metadata';

export const metadata = createUnlistedNextMetadata({ title: 'Study group settings', description: 'Study group settings.' });

export default function Page() {
  return <GroupSettingsPage />;
}
