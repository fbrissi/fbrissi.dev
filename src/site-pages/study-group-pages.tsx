import { AccountView } from '@/features/study-group/account';
import { AdminConsoleView } from '@/features/study-group/admin-console';
import { CreateGroupView } from '@/features/study-group/create-group';
import { GroupBoardView } from '@/features/study-group/group-page';
import { GroupSettingsView } from '@/features/study-group/group-settings';
import { MyGroupsView } from '@/features/study-group/my-groups';
import { WelcomeView } from '@/features/study-group/welcome';

import { StudyGroupShell } from './study-group-shell';

type PageProps = { apiUrl?: string };

export function GroupBoardPage({ apiUrl }: PageProps) {
  return <StudyGroupShell apiUrl={apiUrl}><GroupBoardView /></StudyGroupShell>;
}

export function GroupSettingsPage({ apiUrl }: PageProps) {
  return <StudyGroupShell apiUrl={apiUrl}><GroupSettingsView /></StudyGroupShell>;
}

export function NewGroupPage({ apiUrl }: PageProps) {
  return <StudyGroupShell apiUrl={apiUrl}><CreateGroupView /></StudyGroupShell>;
}

export function MyGroupsPage({ apiUrl }: PageProps) {
  return <StudyGroupShell apiUrl={apiUrl}><MyGroupsView /></StudyGroupShell>;
}

export function AccountPage({ apiUrl }: PageProps) {
  return <StudyGroupShell apiUrl={apiUrl}><AccountView /></StudyGroupShell>;
}

export function WelcomePage({ apiUrl }: PageProps) {
  return <StudyGroupShell apiUrl={apiUrl}><WelcomeView /></StudyGroupShell>;
}

export function AdminPage({ apiUrl }: PageProps) {
  return <StudyGroupShell apiUrl={apiUrl}><AdminConsoleView /></StudyGroupShell>;
}
