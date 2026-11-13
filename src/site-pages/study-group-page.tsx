import { defaultStudyGroupApiUrl } from '@/features/study-group/api';
import { StudyGroupBoard } from '@/features/study-group/study-group-board';

import { StudyGroupShell } from './study-group-shell';

export function StudyGroupPage({ apiUrl = process.env.NEXT_PUBLIC_STUDY_GROUP_API_URL || defaultStudyGroupApiUrl }: { apiUrl?: string }) {
  return (
    <StudyGroupShell>
      <StudyGroupBoard apiUrl={apiUrl} />
    </StudyGroupShell>
  );
}
