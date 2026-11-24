import { UnsubscribePage } from '@/site-pages/study-group-pages';
import { createUnlistedNextMetadata } from '@/lib/next-metadata';

export const metadata = createUnlistedNextMetadata({ title: 'Unsubscribe from study group emails', description: 'Stop study group emails.' });

export default function Page() {
  return <UnsubscribePage />;
}
