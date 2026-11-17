import { WelcomePage } from '@/site-pages/study-group-pages';
import { createUnlistedNextMetadata } from '@/lib/next-metadata';

export const metadata = createUnlistedNextMetadata({ title: 'Welcome to the study groups', description: 'Accept the Terms and Privacy Policy to create your account.' });

export default function Page() {
  return <WelcomePage />;
}
