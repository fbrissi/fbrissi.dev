import { notFound } from 'next/navigation';

import { StudyGroupSettingsPage } from '@/site-pages/study-group-settings-page';
import { createUnlistedNextMetadata } from '@/lib/next-metadata';

import { isStudyGroupSlug, studyGroupStaticParams } from '../params';

export const dynamicParams = false;
export const generateStaticParams = studyGroupStaticParams;
export const metadata = createUnlistedNextMetadata({ title: 'Study group settings', description: 'Unlisted study group settings.' });

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  if (!isStudyGroupSlug((await params).slug)) notFound();
  return <StudyGroupSettingsPage />;
}
