import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GroupSettingsView } from '@/features/study-group/group-settings';
import { SessionProvider } from '@/features/study-group/session';
import type { DeletedMaterial, GroupRole, GroupSettings, JoinRequest, Member, ModerationNotice } from '@/workers/study-group/contract';

import { admin, apiError, bodyOf, calls, group, material, stubApi, user, type Routes } from './fake-api';

vi.stubGlobal('React', React);

const navigation = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('@/features/study-group/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/study-group/navigation')>()),
  navigate: navigation.navigate
}));

const base = `/groups/${group.id}`;
const settings: GroupSettings = { ...group, accessCode: 'code12345678' };
const members: Member[] = [
  { userId: 'user0001', displayName: 'Olivia', role: 'owner', joinedAt: null },
  { userId: 'user0002', displayName: 'Max', role: 'member', joinedAt: '2026-11-02T00:00:00Z' }
];
const requests: JoinRequest[] = [
  { id: 1, displayName: 'Oscar', message: 'Hi, I am Oscar', createdAt: '2026-11-03T00:00:00Z' },
  { id: 2, displayName: 'Uma', message: null, createdAt: '2026-11-04T00:00:00Z' }
];
const notices: ModerationNotice[] = [{ id: 1, action: 'delete_material', groupId: group.id, label: 'Spam', reason: 'Unrelated promotion', createdAt: '2026-11-05T00:00:00Z' }];
const deleted: DeletedMaterial[] = [
  { ...material(5, { title: 'Owner deleted' }), deletedAt: '2026-11-06T00:00:00Z', deletedByAdmin: false },
  { ...material(6, { title: 'Admin deleted' }), deletedAt: '2026-11-06T00:00:00Z', deletedByAdmin: true }
];

function setup({ role = 'owner' as GroupRole, me = user, routes = {} as Routes } = {}) {
  const fetchMock = stubApi({
    'GET /me': { user: me },
    [`GET ${base}/settings`]: { settings, notices, role },
    [`GET ${base}/requests`]: { requests },
    [`GET ${base}/members`]: { members },
    [`GET ${base}/materials/deleted`]: { materials: deleted },
    ...routes
  });
  render(<SessionProvider><GroupSettingsView /></SessionProvider>);
  return fetchMock;
}

beforeEach(() => {
  window.history.pushState({}, '', `/study-groups/g/${group.id}/settings`);
  navigation.navigate.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.stubGlobal('React', React);
});

describe('group settings', () => {
  it('handles a malformed URL, forbidden users, missing groups and errors', async () => {
    window.history.pushState({}, '', '/study-groups/group/settings');
    stubApi({ 'GET /me': { user } });
    const first = render(<SessionProvider><GroupSettingsView /></SessionProvider>);
    expect(await screen.findByText("This group doesn't exist or was deleted.")).toBeInTheDocument();
    first.unmount();

    window.history.pushState({}, '', `/study-groups/g/${group.id}/settings`);
    for (const [status, text] of [[403, 'Only the group owner can open the settings.'], [404, "This group doesn't exist or was deleted."], [500, "Couldn't load the settings."]] as const) {
      stubApi({ 'GET /me': { user }, [`GET ${base}/settings`]: apiError(status, 'x'), [`GET ${base}/requests`]: { requests }, [`GET ${base}/members`]: { members }, [`GET ${base}/materials/deleted`]: { materials: [] } });
      const view = render(<SessionProvider><GroupSettingsView /></SessionProvider>);
      expect(await screen.findByText(text)).toBeInTheDocument();
      view.unmount();
    }
  });

  it('saves the profile with validation (4.4)', async () => {
    let attempt = 0;
    const fetchMock = setup({ routes: { [`PUT ${base}/settings`]: () => (attempt++ === 0 ? apiError(403, 'consent_required') : { settings: { ...settings, name: 'Go Talk 2', moderationMode: 'review', listed: false }, notices: [], role: 'owner' }) } });
    expect(await screen.findByRole('heading', { name: 'Group settings' })).toBeInTheDocument();
    const form = screen.getByRole('region', { name: 'Group profile' });
    const name = within(form).getByLabelText('Group name');
    expect(name).toHaveValue('Go Talk');

    fireEvent.change(name, { target: { value: 'ab' } });
    fireEvent.change(within(form).getByLabelText('Meeting link (optional)'), { target: { value: 'nope' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Save settings' }));
    expect(within(form).getByText('Please fix the highlighted fields.')).toBeInTheDocument();
    expect(within(form).getByText('Use 3 to 60 characters.')).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(name, { target: { value: 'Go Talk 2' } });
    fireEvent.change(within(form).getByLabelText('Meeting link (optional)'), { target: { value: '' } });
    fireEvent.change(within(form).getByLabelText('Rules'), { target: { value: 'One\n\n Two ' } });
    fireEvent.change(within(form).getByLabelText('Suggestions'), { target: { value: 'review' } });
    fireEvent.click(within(form).getByRole('checkbox'));
    fireEvent.click(within(form).getByRole('button', { name: 'Save settings' }));
    expect(await within(form).findByText('Accept the updated Terms and Privacy Policy to make changes.')).toBeInTheDocument();
    fireEvent.click(within(form).getByRole('button', { name: 'Save settings' }));
    expect(await within(form).findByText('Settings saved.')).toBeInTheDocument();
    expect(bodyOf(fetchMock, `PUT ${base}/settings`)).toEqual({ ...group, id: undefined, name: 'Go Talk 2', rules: ['One', 'Two'], meetingUrl: null, moderationMode: 'review', listed: false });
    expect(screen.getByText('Go Talk 2', { selector: 'p' })).toBeInTheDocument();
  });

  it('shows admin deletion notices', async () => {
    setup();
    const section = await screen.findByRole('region', { name: 'Moderation notices' });
    expect(section).toHaveTextContent('“Spam” · Nov 5');
    expect(section).toHaveTextContent('Reason: Unrelated promotion');
  });

  it('copies and rotates the access code (4.3)', async () => {
    let rotateFails = true;
    setup({ routes: { [`POST ${base}/access-code`]: () => (rotateFails ? apiError(500, 'Rotate failed') : { settings: { ...settings, accessCode: 'newcode98765' }, notices: [], role: 'owner' }) } });
    const section = await screen.findByRole('region', { name: 'Access code' });
    expect(within(section).getByLabelText('Access code')).toHaveTextContent('code12345678');

    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    fireEvent.click(within(section).getByRole('button', { name: 'Copy' }));
    expect(await within(section).findByText('Copied to the clipboard.')).toBeInTheDocument();
    fireEvent.click(within(section).getByRole('button', { name: 'Copy' }));
    expect(await within(section).findByText("Couldn't copy. Select the code and copy it manually.")).toBeInTheDocument();

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(within(section).getByRole('button', { name: 'Create a new code' }));
    confirm.mockReturnValue(true);
    fireEvent.click(within(section).getByRole('button', { name: 'Create a new code' }));
    expect(await within(section).findByText('Rotate failed')).toBeInTheDocument();
    rotateFails = false;
    fireEvent.click(within(section).getByRole('button', { name: 'Create a new code' }));
    expect(await within(section).findByText('New code created.')).toBeInTheDocument();
    expect(within(section).getByLabelText('Access code')).toHaveTextContent('newcode98765');
  });

  it('approves and rejects join requests, without showing emails (3.3)', async () => {
    let approveFails = true;
    setup({
      routes: {
        [`POST ${base}/requests/1/approve`]: () => (approveFails ? apiError(409, 'A group can have at most 50 members') : null),
        [`POST ${base}/requests/2/reject`]: null
      }
    });
    const section = await screen.findByRole('region', { name: 'Join requests' });
    expect(within(section).getByText('Hi, I am Oscar')).toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: /Delete the message/ })).not.toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: 'Approve Oscar' }));
    expect(await within(section).findByText('A group can have at most 50 members')).toBeInTheDocument();
    approveFails = false;
    stubApi({
      [`POST ${base}/requests/1/approve`]: null,
      [`POST ${base}/requests/2/reject`]: null,
      [`GET ${base}/members`]: { members: [...members, { userId: 'user0003', displayName: 'Oscar', role: 'member', joinedAt: '2026-11-07T00:00:00Z' }] }
    });
    fireEvent.click(within(section).getByRole('button', { name: 'Approve Oscar' }));
    expect(await within(section).findByText('Oscar is now a member.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Members' })).getByText(/Oscar/)).toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: 'Reject Uma' }));
    expect(await within(section).findByText('Rejected the request from Uma.')).toBeInTheDocument();
    expect(within(section).getByText('No pending requests.')).toBeInTheDocument();
  });

  it('lets the platform admin delete join request messages with a reason (5.3)', async () => {
    const fetchMock = setup({ role: 'platform_admin', me: admin, routes: { [`DELETE ${base}/requests/1/message`]: null } });
    expect(await screen.findByText(/You are moderating this group as the platform admin/)).toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'Join requests' });
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null);
    fireEvent.click(within(section).getByRole('button', { name: 'Delete the message from Oscar' }));
    expect(calls(fetchMock)).not.toContain(`DELETE ${base}/requests/1/message`);
    prompt.mockReturnValue('Personal data in the message');
    fireEvent.click(within(section).getByRole('button', { name: 'Delete the message from Oscar' }));
    expect(await within(section).findByText('Message deleted.')).toBeInTheDocument();
    expect(within(section).queryByText('Hi, I am Oscar')).not.toBeInTheDocument();
    expect(bodyOf(fetchMock, `DELETE ${base}/requests/1/message`)).toEqual({ reason: 'Personal data in the message' });
  });

  it('removes members after confirming (3.5)', async () => {
    let fail = true;
    setup({ routes: { [`DELETE ${base}/members/user0002`]: () => (fail ? apiError(404, 'Member not found') : null) } });
    const section = await screen.findByRole('region', { name: 'Members' });
    expect(within(section).queryByRole('button', { name: 'Remove Olivia' })).not.toBeInTheDocument();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(within(section).getByRole('button', { name: 'Remove Max' }));
    confirm.mockReturnValue(true);
    fireEvent.click(within(section).getByRole('button', { name: 'Remove Max' }));
    expect(await within(section).findByText('Member not found')).toBeInTheDocument();
    fail = false;
    fireEvent.click(within(section).getByRole('button', { name: 'Remove Max' }));
    await waitFor(() => expect(within(section).queryByText(/Max/)).not.toBeInTheDocument());
  });

  it('restores deleted materials, except admin deletions for owners (Q6)', async () => {
    let fail = true;
    setup({ routes: { [`POST ${base}/materials/5/restore`]: () => (fail ? apiError(409, 'This URL is already open in another suggestion') : { material: material(5) }) } });
    const section = await screen.findByRole('region', { name: 'Deleted materials' });
    expect(within(section).getByRole('button', { name: 'Restore “Admin deleted”' })).toBeDisabled();
    expect(within(section).getByText(/by the platform admin/)).toBeInTheDocument();
    fireEvent.click(within(section).getByRole('button', { name: 'Restore “Owner deleted”' }));
    expect(await within(section).findByText('This URL is already open in another suggestion')).toBeInTheDocument();
    fail = false;
    fireEvent.click(within(section).getByRole('button', { name: 'Restore “Owner deleted”' }));
    expect(await within(section).findByText('Restored “Owner deleted”.')).toBeInTheDocument();
  });

  it('shows an empty deleted list and no notices', async () => {
    stubApi({ 'GET /me': { user }, [`GET ${base}/settings`]: { settings: { ...settings, meetingUrl: null }, notices: [], role: 'owner' }, [`GET ${base}/requests`]: { requests: [] }, [`GET ${base}/members`]: { members }, [`GET ${base}/materials/deleted`]: { materials: [] } });
    render(<SessionProvider><GroupSettingsView /></SessionProvider>);
    expect(await screen.findByText('No deleted materials.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Moderation notices' })).not.toBeInTheDocument();
  });

  it('deletes the group after typing its name (4.5)', async () => {
    let fail = true;
    const fetchMock = setup({ routes: { [`DELETE ${base}`]: () => (fail ? apiError(400, 'Type the group name to confirm') : null) } });
    const section = await screen.findByRole('region', { name: 'Delete the group' });
    const button = within(section).getByRole('button', { name: 'Delete group' });
    expect(button).toBeDisabled();
    fireEvent.change(within(section).getByLabelText('Type “Go Talk” to confirm'), { target: { value: ' go talk ' } });
    expect(button).toBeEnabled();
    expect(within(section).queryByLabelText(/Reason/)).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(await within(section).findByText('Type the group name to confirm')).toBeInTheDocument();
    fail = false;
    fireEvent.click(button);
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('/study-groups/my'));
    expect(bodyOf(fetchMock, `DELETE ${base}`)).toEqual({ confirmName: ' go talk ' });
  });

  it('asks the platform admin for a reason when deleting a group (D7)', async () => {
    const fetchMock = setup({ role: 'platform_admin', me: admin, routes: { [`DELETE ${base}`]: null } });
    const section = await screen.findByRole('region', { name: 'Delete the group' });
    fireEvent.change(within(section).getByLabelText('Type “Go Talk” to confirm'), { target: { value: 'Go Talk' } });
    fireEvent.change(within(section).getByLabelText(/Reason/), { target: { value: 'Breaks the content policy' } });
    fireEvent.click(within(section).getByRole('button', { name: 'Delete group' }));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('/study-groups/admin'));
    expect(bodyOf(fetchMock, `DELETE ${base}`)).toEqual({ confirmName: 'Go Talk', reason: 'Breaks the content policy' });
  });
});
