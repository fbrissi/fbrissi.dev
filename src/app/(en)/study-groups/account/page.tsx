import { AccountPage } from '@/site-pages/study-group-pages';
import { createUnlistedNextMetadata } from '@/lib/next-metadata';

export const metadata = createUnlistedNextMetadata({ title: 'Study groups account', description: 'Your study groups account.' });

export default function Page() {
  return <AccountPage />;
}
