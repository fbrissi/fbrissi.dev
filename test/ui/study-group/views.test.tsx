import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountView } from '@/features/study-group/account';
import { AdminConsoleView } from '@/features/study-group/admin-console';
import { CreateGroupView } from '@/features/study-group/create-group';
import { MyGroupsView } from '@/features/study-group/my-groups';
import { GroupDirectory, ProgramActions } from '@/features/study-group/program-landing';
import { SessionProvider } from '@/features/study-group/session';
import { UnsubscribeView } from '@/features/study-group/unsubscribe';
import { WelcomeView } from '@/features/study-group/welcome';
import type { AdminGroup, ModerationAction, MyGroupsResponse } from '@/workers/study-group/contract';

import { admin, apiError, bodyOf, calls, group, stubApi, user, type Routes } from './fake-api';

vi.stubGlobal('React', React);

const navigation = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('@/features/study-group/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/study-group/navigation')>()),
  navigate: navigation.navigate
}));

function renderWith(routes: Routes, ui: React.ReactNode) {
  const fetchMock = stubApi(routes);
  render(<SessionProvider>{ui}</SessionProvider>);
  return fetchMock;
}

beforeEach(() => {
  navigation.navigate.mockReset();
  window.history.pushState({}, '', '/study-groups');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.stubGlobal('React', React);
});

describe('create a group (3.1)', () => {
  it('validates, requires the content policy confirmation and opens the new group’s settings', async () => {
    let attempt = 0;
    const fetchMock = renderWith({
      'GET /me': { user },
      'POST /groups': () => (attempt++ === 0 ? apiError(409, 'You can own at most 3 groups') : { group: { ...group, accessCode: 'code12345678' } })
    }, <CreateGroupView />);
    expect(await screen.findByRole('heading', { name: 'Create a group' })).toBeInTheDocument();
    expect(screen.getByLabelText('Suggestions')).toHaveValue('free');
    expect(screen.getByRole('checkbox', { name: /List this group/ })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Create group' }));
    expect(screen.getByText('Please fix the highlighted fields.')).toBeInTheDocument();
    expect(screen.getByText('Use 20 to 280 characters.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Go Talk' } });
    fireEvent.change(screen.getByLabelText('Public summary'), { target: { value: group.summary } });
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }));
    expect(screen.getByText('Confirm that the group follows the content policy.')).toBeInTheDocument();

    const policy = screen.getByRole('checkbox', { name: /I confirm this group follows/ });
    expect(policy).not.toBeChecked();
    fireEvent.click(policy);
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }));
    expect(await screen.findByText('You can own at most 3 groups')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create group' }));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith(`/study-groups/g/${group.id}/settings`));
    expect(bodyOf(fetchMock, 'POST /groups')).toEqual({
      name: 'Go Talk', summary: group.summary, rules: [], meetingDay: 'Monday', meetingStart: '20:00', meetingEnd: '21:00',
      timezone: 'America/Sao_Paulo', meetingUrl: null, moderationMode: 'free', listed: true, acceptContentPolicy: true
    });
  });
});

describe('my groups (3.4, Q5)', () => {
  const data: MyGroupsResponse = {
    groups: [{ id: 'own1234567', name: 'Own', summary: 'Owned group', role: 'owner', iconUrl: '/api/study-group/icons/own1234567/abcdefghjkmnpqrs.png?exp=1&sig=s' }, { id: 'mem1234567', name: 'Joined', summary: 'Joined group', role: 'member', iconUrl: null }],
    pending: [{ id: 'pen1234567', name: 'Waiting', summary: 'Pending group', requestedAt: '2026-11-03T00:00:00Z' }],
    rejected: [{ id: 'rej1234567', name: 'Declined', summary: 'Rejected group', canAskAgainAt: '2026-11-23T12:00:00.000Z' }],
    notices: [
      { id: 1, action: 'delete_group', groupId: 'gone', label: 'Gone group', reason: 'Spam and promotion', createdAt: '2026-11-04T00:00:00Z' },
      { id: 2, action: 'custom_action', groupId: 'own1234567', label: 'Thing', reason: 'Some reason here', createdAt: '2026-11-04T00:00:00Z' }
    ]
  };

  it('lists owned and joined groups, pending requests and admin notices', async () => {
    renderWith({ 'GET /me': { user }, 'GET /me/groups': data }, <MyGroupsView />);
    expect(await screen.findByRole('link', { name: 'Own' })).toHaveAttribute('href', '/study-groups/g/own1234567');
    expect(screen.getByText('Signed in as Olivia')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Settings' })).toHaveLength(1);
    expect(screen.getByText('Waiting')).toBeInTheDocument();
    const notices = screen.getByRole('region', { name: 'Moderation notices' });
    expect(notices).toHaveTextContent('Group deleted: “Gone group”');
    expect(notices).toHaveTextContent('custom_action: “Thing”');
    expect(screen.getByRole('region', { name: 'Not approved' })).toHaveTextContent("Declined · the owner didn’t approve your request. You can ask again after November 23, 2026 at 9:00 AM (Brasília time).");
  });

  it('shows a one-time status message left by a group deletion', async () => {
    window.sessionStorage.setItem('study-groups:flash', '“Old” was deleted permanently.');
    renderWith({ 'GET /me': { user }, 'GET /me/groups': { groups: [], pending: [], rejected: [], notices: [] } }, <MyGroupsView />);
    expect(await screen.findByText('“Old” was deleted permanently.')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('study-groups:flash')).toBeNull();
  });

  it('shows the empty state and errors', async () => {
    renderWith({ 'GET /me': { user }, 'GET /me/groups': { groups: [], pending: [], rejected: [], notices: [] } }, <MyGroupsView />);
    expect(await screen.findByRole('link', { name: 'create one' })).toHaveAttribute('href', '/study-groups/new');
    expect(screen.queryByRole('region', { name: 'Moderation notices' })).not.toBeInTheDocument();
    cleanup();
    renderWith({ 'GET /me': { user }, 'GET /me/groups': apiError(500, 'x') }, <MyGroupsView />);
    expect(await screen.findByText("Couldn't load your groups. Please try again.")).toBeInTheDocument();
  });
});

describe('account (2.3–2.5)', () => {
  it('edits the display name and links the data export', async () => {
    let attempt = 0;
    const fetchMock = renderWith({
      'GET /me': { user },
      'GET /me/groups': { groups: [], pending: [], rejected: [], notices: [] },
      'PATCH /me': () => (attempt++ === 0 ? apiError(500, 'Save failed') : { user: { ...user, displayName: 'Liv' } })
    }, <AccountView />);
    const name = await screen.findByLabelText('Display name');
    expect(screen.getByRole('link', { name: 'Download my data' })).toHaveAttribute('href', '/api/study-group/me/export');

    fireEvent.change(name, { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(screen.getByText('Use 1 to 40 characters.')).toBeInTheDocument();
    fireEvent.change(name, { target: { value: 'Liv\u202E' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(screen.getByText('Remove invisible or text-direction characters.')).toBeInTheDocument();
    fireEvent.change(name, { target: { value: 'liv@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(screen.getByText("Don't include an email address.")).toBeInTheDocument();
    fireEvent.change(name, { target: { value: ' Liv ' } });
    expect(screen.queryByText('Use 1 to 40 characters.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Save failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save name' }));
    expect(await screen.findByText('Name saved.')).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'PATCH /me')).toEqual({ displayName: 'Liv' });
  });

  it('warns about owned groups and deletes the account after explicit confirmation (Q8)', async () => {
    let attempt = 0;
    renderWith({
      'GET /me': { user },
      'GET /me/groups': { groups: [{ id: 'own1234567', name: 'Own', summary: 's', role: 'owner' }, { id: 'mem1234567', name: 'Joined', summary: 's', role: 'member' }], pending: [], rejected: [], notices: [] },
      'DELETE /me': () => (attempt++ === 0 ? apiError(500, 'Delete failed') : null)
    }, <AccountView />);
    const section = await screen.findByRole('region', { name: 'Delete my account' });
    expect(await within(section).findByText(/These groups you own will be deleted permanently too/)).toBeInTheDocument();
    expect(within(section).getByText('Own')).toBeInTheDocument();
    expect(within(section).queryByText('Joined')).not.toBeInTheDocument();
    const button = within(section).getByRole('button', { name: 'Delete my account permanently' });
    expect(button).toBeDisabled();
    fireEvent.click(within(section).getByRole('checkbox'));
    fireEvent.click(button);
    expect(await within(section).findByText('Delete failed')).toBeInTheDocument();
    fireEvent.click(button);
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('/study-groups'));
  });

  it('turns service emails off and on (one master switch)', async () => {
    let attempt = 0;
    const fetchMock = renderWith({
      'GET /me': { user },
      'GET /me/groups': { groups: [], pending: [], rejected: [], notices: [] },
      'GET /me/notifications': { emailEnabled: true },
      'PUT /me/notifications': (body: Record<string, unknown> | undefined) => (attempt++ === 1 ? apiError(500, 'Save failed') : { emailEnabled: body?.emailEnabled })
    }, <AccountView />);
    const section = await screen.findByRole('region', { name: 'Emails' });
    const box = within(section).getByRole('checkbox', { name: 'Email me about my groups and requests' });
    await waitFor(() => expect(box).toBeChecked());
    expect(section).toHaveTextContent('No marketing, ever.');
    fireEvent.click(box);
    expect(await within(section).findByText('Emails turned off.')).toBeInTheDocument();
    expect(box).not.toBeChecked();
    expect(bodyOf(fetchMock, 'PUT /me/notifications')).toEqual({ emailEnabled: false });
    fireEvent.click(box);
    expect(await within(section).findByText('Save failed')).toBeInTheDocument();
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(await within(section).findByText('Emails turned on.')).toBeInTheDocument();
    expect(box).toBeChecked();
  });

  it('shows an error when the email setting can’t be loaded', async () => {
    renderWith({ 'GET /me': { user }, 'GET /me/groups': { groups: [], pending: [], rejected: [], notices: [] }, 'GET /me/notifications': apiError(500, 'Load failed') }, <AccountView />);
    const section = await screen.findByRole('region', { name: 'Emails' });
    expect(await within(section).findByText('Load failed')).toBeInTheDocument();
    expect(within(section).getByRole('checkbox')).toBeDisabled();
  });

  it('works when the owned groups can’t be loaded', async () => {
    renderWith({ 'GET /me': { user }, 'GET /me/groups': apiError(500, 'x') }, <AccountView />);
    const section = await screen.findByRole('region', { name: 'Delete my account' });
    await waitFor(() => expect(within(section).queryByText(/will be deleted permanently too/)).not.toBeInTheDocument());
  });
});

describe('unsubscribe page', () => {
  it('unsubscribes only after the button is pressed', async () => {
    window.history.pushState({}, '', '/study-groups/unsubscribe?t=abc.def');
    let attempt = 0;
    const fetchMock = renderWith({
      'GET /me': { user: null },
      'POST /unsubscribe': () => (attempt++ === 0 ? apiError(500, 'Server down') : { emailEnabled: false })
    }, <UnsubscribeView />);
    const button = await screen.findByRole('button', { name: 'Unsubscribe' });
    await waitFor(() => expect(button).toBeEnabled());
    expect(calls(fetchMock)).not.toContain('POST /unsubscribe?t=abc.def');
    fireEvent.click(button);
    expect(await screen.findByText('Server down')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }));
    expect(await screen.findByText('You won\'t get study group emails anymore.')).toBeInTheDocument();
    expect(calls(fetchMock)).toContain('POST /unsubscribe?t=abc.def');
    expect(screen.getByRole('link', { name: 'account' })).toHaveAttribute('href', '/study-groups/account');
  });

  it('explains invalid, expired and missing links', async () => {
    window.history.pushState({}, '', '/study-groups/unsubscribe?t=bad');
    renderWith({ 'GET /me': { user: null }, 'POST /unsubscribe': apiError(400, 'invalid_link') }, <UnsubscribeView />);
    const button = await screen.findByRole('button', { name: 'Unsubscribe' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByText(/This unsubscribe link is invalid or expired/)).toBeInTheDocument();
    cleanup();

    window.history.pushState({}, '', '/study-groups/unsubscribe');
    renderWith({ 'GET /me': { user: null } }, <UnsubscribeView />);
    expect(await screen.findByText(/This unsubscribe link is invalid or expired/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unsubscribe' })).toBeDisabled();
  });
});

describe('welcome (2.2, D9, Q4)', () => {
  it('creates the account only after the three explicit confirmations', async () => {
    let attempt = 0;
    const fetchMock = renderWith({
      'GET /auth/signup': { displayName: 'Olivia' },
      'POST /auth/signup': () => (attempt++ === 0 ? apiError(404, 'No pending sign-up') : { returnTo: '/study-groups/g/devtalk' })
    }, <WelcomeView />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Welcome, Olivia' })).toBeInTheDocument();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.every((box) => !(box as HTMLInputElement).checked)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }));
    // The message is announced and the focus moves to the first unchecked box, marked invalid.
    expect(screen.getByRole('alert')).toHaveTextContent('Check all three boxes to create your account.');
    expect(boxes[0]).toHaveFocus();
    expect(boxes[0]).toHaveAttribute('aria-invalid', 'true');
    expect(boxes[0]).toHaveAttribute('aria-describedby', 'welcome-error');
    fireEvent.click(boxes[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }));
    expect(boxes[1]).toHaveFocus();
    expect(boxes[0]).not.toHaveAttribute('aria-invalid');
    fireEvent.click(boxes[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }));
    expect(boxes[2]).toHaveFocus();
    fireEvent.click(boxes[2]);
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }));
    expect(await screen.findByText('No pending sign-up')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create my account' }));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('/study-groups/g/devtalk'));
    expect(bodyOf(fetchMock, 'POST /auth/signup')).toEqual({ acceptTerms: true, acceptPrivacy: true, confirmAge: true });
  });

  it('declines without keeping anything', async () => {
    const fetchMock = renderWith({ 'GET /auth/signup': { displayName: 'Olivia' }, 'POST /auth/signup/cancel': null }, <WelcomeView />);
    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('/study-groups'));
    expect(calls(fetchMock)).toContain('POST /auth/signup/cancel');
  });

  it('asks to sign in again when the pending sign-up expired', async () => {
    renderWith({ 'GET /auth/signup': apiError(404, 'No pending sign-up') }, <WelcomeView />);
    expect(await screen.findByRole('heading', { name: 'Your sign-in expired' })).toBeInTheDocument();
  });
});

describe('admin console (5.2, 5.5)', () => {
  const adminGroup = (id: string, extra: Partial<AdminGroup> = {}): AdminGroup => ({ id, name: `Group ${id}`, summary: 's', ownerName: 'Olivia', listed: true, memberCount: 3, createdAt: '2026-11-01T00:00:00Z', ...extra });
  const action = (id: number, extra: Partial<ModerationAction> = {}): ModerationAction => ({ id, action: 'delete_material', groupId: 'g1', label: `Item ${id}`, reason: 'Reason text', createdAt: '2026-11-01T00:00:00Z', actorName: 'Ada', targetType: 'material', targetId: String(id), ...extra });

  it('pages all groups and the moderation log', async () => {
    renderWith({
      'GET /me': { user: admin },
      'GET /admin/groups': { groups: [adminGroup('aaa'), adminGroup('bbb', { ownerName: null, listed: false })], nextCursor: 'c1' },
      'GET /admin/groups?cursor=c1': { groups: [adminGroup('ccc')], nextCursor: null },
      'GET /admin/moderation-log': { actions: [action(3, { action: 'unban_user', targetType: 'user', groupId: null, actorName: null, reason: 'Ban expired' }), action(2), action(1, { groupId: null, actorName: null })], nextCursor: '1' },
      'GET /admin/moderation-log?cursor=1': { actions: [action(0)], nextCursor: null }
    }, <AdminConsoleView />);
    const groups = await screen.findByRole('region', { name: 'All groups' });
    expect(await within(groups).findByText('Group aaa')).toBeInTheDocument();
    expect(within(groups).getByText(/Owner: unclaimed · 3 members · unlisted/)).toBeInTheDocument();
    expect(within(groups).getAllByRole('link', { name: 'Settings' })[0]).toHaveAttribute('href', '/study-groups/g/aaa/settings');
    fireEvent.click(within(groups).getByRole('button', { name: 'Load more' }));
    expect(await within(groups).findByText('Group ccc')).toBeInTheDocument();
    expect(within(groups).queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();

    const log = screen.getByRole('region', { name: 'Moderation log' });
    expect(await within(log).findByText(/Material deleted · material 2 in g1 · “Item 2”/)).toBeInTheDocument();
    expect(within(log).getByText(/Former admin/)).toBeInTheDocument();
    expect(within(log).getByText(/Automatic · .* · Reason: Ban expired/)).toBeInTheDocument();
    expect(within(log).getByText(/Ban lifted · user 3/)).toBeInTheDocument();
    fireEvent.click(within(log).getByRole('button', { name: 'Load more' }));
    expect(await within(log).findByText(/“Item 0”/)).toBeInTheDocument();
  });

  it('shows the status message a group deletion left for the admin page', async () => {
    window.sessionStorage.setItem('study-groups:flash', '“Spam” was deleted permanently.');
    renderWith({ 'GET /me': { user: admin }, 'GET /admin/groups': { groups: [], nextCursor: null }, 'GET /admin/users': { users: [], nextCursor: null }, 'GET /admin/moderation-log': { actions: [], nextCursor: null } }, <AdminConsoleView />);
    expect(await screen.findByText('“Spam” was deleted permanently.')).toBeInTheDocument();
  });

  it('shows empty and error states, and refuses non-admins', async () => {
    renderWith({ 'GET /me': { user: admin }, 'GET /admin/groups': { groups: [], nextCursor: null }, 'GET /admin/moderation-log': { actions: [], nextCursor: null } }, <AdminConsoleView />);
    expect(await screen.findByText('No groups yet.')).toBeInTheDocument();
    expect(await screen.findByText('No moderation actions yet.')).toBeInTheDocument();
    cleanup();
    renderWith({ 'GET /me': { user: admin }, 'GET /admin/groups': apiError(500, 'x'), 'GET /admin/moderation-log': apiError(500, 'x') }, <AdminConsoleView />);
    expect(await screen.findByText("Couldn't load the groups.")).toBeInTheDocument();
    expect(await screen.findByText("Couldn't load the moderation log.")).toBeInTheDocument();
    cleanup();
    renderWith({ 'GET /me': { user } }, <AdminConsoleView />);
    expect(await screen.findByText('Only the platform admin can open this page.')).toBeInTheDocument();
  });
});

describe('program landing (1.1, 1.2)', () => {
  it('offers sign-in to visitors and sends card clicks through sign-in', async () => {
    window.history.pushState({}, '', '/study-groups?signin=failed');
    renderWith({
      'GET /me': { user: null },
      'GET /groups': { groups: [{ id: 'aaa1234567', name: 'Go Talk', summary: 'About Go', iconUrl: '/api/study-group/icons/aaa1234567/abcdefghjkmnpqrs.png?exp=1&sig=s' }], nextCursor: 'next' },
      'GET /groups?cursor=next': { groups: [{ id: 'bbb1234567', name: 'Rust Talk', summary: 'About Rust', iconUrl: null }], nextCursor: null }
    }, <><ProgramActions locale="en" /><GroupDirectory locale="en" /></>);
    expect(await screen.findByText("Sign-in didn't work. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Join a free English study group' })).toHaveAttribute('href', '/api/study-group/auth/login?returnTo=%2Fstudy-groups%2Fmy');
    expect(screen.getByText("You'll sign in with Google")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create a group' })).toHaveAttribute('href', '/api/study-group/auth/login?returnTo=%2Fstudy-groups%2Fnew');
    expect(await screen.findByRole('link', { name: 'Sign in to join: Go Talk' })).toHaveAttribute('href', '/api/study-group/auth/login?returnTo=%2Fstudy-groups%2Fg%2Faaa1234567');
    fireEvent.click(screen.getByRole('button', { name: 'Load more groups' }));
    expect(await screen.findByText('Rust Talk')).toBeInTheDocument();
    expect(screen.getByText('Go Talk')).toBeInTheDocument();
    // A listed group's icon shows on its card; a group without one shows its first letter.
    const [goCard, rustCard] = screen.getAllByRole('listitem');
    expect(goCard.querySelector('img')).toHaveAttribute('src', '/api/study-group/icons/aaa1234567/abcdefghjkmnpqrs.png?exp=1&sig=s');
    expect(rustCard.querySelector('img')).toBeNull();
    expect(rustCard.querySelector('[data-placeholder]')).toHaveTextContent('R');
  });

  it('links signed-in users straight to their groups, in Portuguese too', async () => {
    renderWith({ 'GET /me': { user }, 'GET /groups': { groups: [{ id: 'aaa1234567', name: 'Go Talk', summary: 'About Go', iconUrl: null }], nextCursor: null } }, <><ProgramActions locale="pt-BR" /><GroupDirectory locale="pt-BR" /></>);
    expect(await screen.findByRole('link', { name: 'Meus grupos' })).toHaveAttribute('href', '/study-groups/my');
    expect(screen.getByRole('link', { name: 'Criar um grupo' })).toHaveAttribute('href', '/study-groups/new');
    expect(await screen.findByRole('link', { name: 'Abrir grupo: Go Talk' })).toHaveAttribute('href', '/study-groups/g/aaa1234567');
    expect(screen.queryByText('Não foi possível entrar. Tente novamente.')).not.toBeInTheDocument();
  });

  it('shows loading, empty and error states', async () => {
    renderWith({ 'GET /me': { user: null }, 'GET /groups': { groups: [], nextCursor: null } }, <GroupDirectory locale="en" />);
    expect(screen.getByText('Loading groups…')).toBeInTheDocument();
    expect(await screen.findByText('No groups are listed yet. Be the first to create one.')).toBeInTheDocument();
    cleanup();
    renderWith({ 'GET /me': { user: null }, 'GET /groups': apiError(500, 'x') }, <GroupDirectory locale="en" />);
    expect(await screen.findByText("Couldn't load the groups. Please try again later.")).toBeInTheDocument();
  });
});
