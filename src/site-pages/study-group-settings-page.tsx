import { defaultStudyGroupApiUrl } from '@/features/study-group/api';
import { AdminSettings } from '@/features/study-group/admin-settings';

import { StudyGroupShell } from './study-group-shell';

export function StudyGroupSettingsPage({ apiUrl = process.env.NEXT_PUBLIC_STUDY_GROUP_API_URL || defaultStudyGroupApiUrl }: { apiUrl?: string }) {
  return (
    <StudyGroupShell>
      <AdminSettings apiUrl={apiUrl} />
    </StudyGroupShell>
  );
}
