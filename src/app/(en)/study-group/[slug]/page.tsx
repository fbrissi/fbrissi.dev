import { notFound } from 'next/navigation';

import { StudyGroupPage } from '@/site-pages/study-group-page';
import { createUnlistedNextMetadata } from '@/lib/next-metadata';

import { isStudyGroupSlug, studyGroupStaticParams } from './params';

export const dynamicParams = false;
export const generateStaticParams = studyGroupStaticParams;
export const metadata = createUnlistedNextMetadata({ title: 'Study group', description: 'Unlisted study group board.' });

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  if (!isStudyGroupSlug((await params).slug)) notFound();
  return <StudyGroupPage />;
}
