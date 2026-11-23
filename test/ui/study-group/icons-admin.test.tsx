import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminConsoleView } from '@/features/study-group/admin-console';
import { createStudyGroupApi } from '@/features/study-group/api';
import { GroupIcon, IconSettings } from '@/features/study-group/group-icon';
import { ProgramActions } from '@/features/study-group/program-landing';
import { SessionProvider } from '@/features/study-group/session';
import type { AdminUser } from '@/workers/study-group/contract';

import { admin, answerConfirm, answerReason, apiError, bodyOf, calls, stubApi, type Routes } from './fake-api';

vi.stubGlobal('React', React);

const iconUrl = '/api/study-group/icons/gotalk1234/abcdefghjkmnpqrs.png?exp=1&sig=s';

function renderIcons(routes: Routes, isOwner = true, initial: string | null = null) {
  const fetchMock = stubApi(routes);
  const onChange = vi.fn();
  const api = createStudyGroupApi();
  render(<IconSettings api={api} groupId="gotalk1234" iconUrl={initial} isOwner={isOwner} onChange={onChange} />);
  return { fetchMock, onChange };
}

const file = (type: string, size = 10) => new File([new Uint8Array(size)], 'icon', { type });

beforeEach(() => {
  window.history.pushState({}, '', '/study-groups');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.stubGlobal('React', React);
});

describe('group icon', () => {
  it('renders nothing without a URL and a sized image with one', () => {
    const { container, rerender } = render(<GroupIcon url={null} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<GroupIcon url={iconUrl} size={40} className="x" />);
    const image = container.querySelector('img')!;
    expect(image).toHaveAttribute('src', iconUrl);
    expect(image).toHaveAttribute('width', '40');
    expect(image).toHaveAttribute('alt', '');
  });

  it('uploads a checked file as the request body, with client-side type and size checks', async () => {
    const { fetchMock, onChange } = renderIcons({ 'PUT /groups/gotalk1234/icon': apiError(422, 'Use an image of at most 512 × 512 pixels.') });
    const section = screen.getByRole('region', { name: 'Group icon' });
    expect(within(section).getByText('No icon yet.')).toBeInTheDocument();
    expect(within(section).getByText(/Offensive or political images are removed/)).toBeInTheDocument();
    const input = section.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');

    fireEvent.change(input, { target: { files: [file('image/gif')] } });
    expect(within(section).getByText('Use a PNG, JPEG or WebP image.')).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [file('image/png', 300 * 1024)] } });
    expect(within(section).getByText('Use an image of at most 256 KB.')).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [] } });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { files: [file('image/png')] } });
    expect(await within(section).findByText('Use an image of at most 512 × 512 pixels.')).toBeInTheDocument();
    stubApi({ 'PUT /groups/gotalk1234/icon': { iconUrl } });
    fireEvent.change(input, { target: { files: [file('image/webp')] } });
    expect(await within(section).findByText('Icon saved.')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(iconUrl);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(init).toMatchObject({ method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'image/png' } });
    expect(init.body).toBeInstanceOf(File);
  });

  it('reports an upload failure without a JSON body', async () => {
    renderIcons({ 'PUT /groups/gotalk1234/icon': new Response('down', { status: 502 }) });
    const input = screen.getByRole('region', { name: 'Group icon' }).querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file('image/png')] } });
    expect(await screen.findByText('Request failed with status 502')).toBeInTheDocument();
  });

  it('lets the owner remove the icon after an irreversible-delete confirmation', async () => {
    const { fetchMock, onChange } = renderIcons({ 'DELETE /groups/gotalk1234/icon': null }, true, iconUrl);
    fireEvent.click(screen.getByRole('button', { name: 'Remove icon' }));
    const dialog = await answerConfirm(false);
    expect(dialog).toHaveTextContent('Remove the group icon permanently?');
    expect(dialog).toHaveTextContent('The image is deleted permanently. This can’t be undone.');
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove icon' }));
    await answerConfirm(true);
    expect(await screen.findByText('Icon removed.')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(null);
    expect(bodyOf(fetchMock, 'DELETE /groups/gotalk1234/icon')).toEqual({});
    expect(screen.getByText('Replace icon')).toBeInTheDocument();
  });

  it('lets the platform admin remove it only with a reason, and not upload', async () => {
    const { fetchMock } = renderIcons({ 'DELETE /groups/gotalk1234/icon': null }, false, iconUrl);
    expect(screen.queryByText(/Upload icon|Replace icon/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove icon' }));
    expect(await answerReason(null)).toHaveTextContent('Remove the group icon permanently?');
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove icon' }));
    await answerReason(' Offensive image ');
    await waitFor(() => expect(bodyOf(fetchMock, 'DELETE /groups/gotalk1234/icon')).toEqual({ reason: 'Offensive image' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Group icon' })).toHaveFocus());
  });
});

describe('admin users', () => {
  const person = (id: string, extra: Partial<AdminUser> = {}): AdminUser => ({ id, displayName: `User ${id}`, createdAt: '2026-11-01T00:00:00Z', ownedGroups: 2, isPlatformAdmin: false, ban: null, ...extra });

  function renderConsole(routes: Routes) {
    return stubApi({
      'GET /me': { user: admin },
      'GET /admin/groups': { groups: [], nextCursor: null },
      'GET /admin/moderation-log': { actions: [], nextCursor: null },
      ...routes
    });
  }

  it('searches, bans, renews and unbans with a reason, and pages results', async () => {
    let failBan = true;
    // The ban dialog re-reads the user: a failed or empty lookup falls back to the list, then a fresh count is used.
    const lookups = [apiError(500, 'x'), { users: [], nextCursor: null }];
    const fetchMock = renderConsole({
      'GET /admin/users?q=u4': { users: [person('u4', { ownedGroups: 0 })], nextCursor: null },
      'GET /admin/users?q=u1': () => lookups.shift() ?? { users: [person('u1', { ownedGroups: 1 })], nextCursor: null },
      'GET /admin/users': { users: [person('u1'), person('u2', { ban: { reason: 'Spam groups', createdAt: '2026-11-02T00:00:00Z', expiresAt: '2028-11-02T00:00:00Z' } }), person('u3', { isPlatformAdmin: true })], nextCursor: 'c1' },
      'GET /admin/users?cursor=c1': { users: [person('u4')], nextCursor: null },
      'GET /admin/users?q=ana': { users: [], nextCursor: null },
      'POST /admin/users/u1/ban': () => (failBan ? apiError(409, 'A platform admin can’t be banned') : null),
      'POST /admin/users/u2/ban/renew': null,
      'DELETE /admin/users/u2/ban': null
    });
    render(<SessionProvider><AdminConsoleView /></SessionProvider>);
    const section = await screen.findByRole('region', { name: 'Users' });
    expect(await within(section).findByText('User u1')).toBeInTheDocument();
    expect(within(section).getByText(/Banned .*, until .*2028.*: Spam groups/)).toBeInTheDocument();
    expect(within(section).getByText(/Platform admin/)).toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: 'Ban User u3' })).not.toBeInTheDocument();
    expect(within(section).getByText(/Emails are matched but never shown/)).toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: 'Ban User u1' }));
    const banDialog = await answerReason(null);
    expect(banDialog).toHaveTextContent('The 2 groups they own are deleted permanently and can’t be restored.');
    expect(banDialog).toHaveTextContent('The ban lasts 2 years unless you renew or lift it.');
    fireEvent.click(within(section).getByRole('button', { name: 'Ban User u1' }));
    expect(await answerReason(' Political propaganda ')).toHaveTextContent('The 2 groups they own');
    expect(await within(section).findByText('A platform admin can’t be banned')).toBeInTheDocument();
    failBan = false;
    fireEvent.click(within(section).getByRole('button', { name: 'Ban User u1' }));
    expect(await answerReason('Political propaganda')).toHaveTextContent('The 1 group they own is deleted permanently and can’t be restored.');
    expect(await within(section).findByText('User u1 is banned.')).toBeInTheDocument();
    // The new button gets the focus, and the moderation log is loaded again.
    await waitFor(() => expect(within(section).getByRole('button', { name: 'Unban User u1' })).toHaveFocus());
    await waitFor(() => expect(calls(fetchMock).filter((call) => call === 'GET /admin/moderation-log')).toHaveLength(2));
    expect(within(section).getByText(/0 owned groups.*Banned .*: Political propaganda/)).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'POST /admin/users/u1/ban')).toEqual({ reason: 'Political propaganda' });

    fireEvent.click(within(section).getByRole('button', { name: 'Renew ban for User u2' }));
    expect(await answerReason('Still posting spam elsewhere')).toHaveTextContent('Renew the ban on User u2?');
    expect(await within(section).findByText('The ban on User u2 was renewed.')).toBeInTheDocument();
    expect(within(section).getByText(/Banned .*: Still posting spam elsewhere/)).toBeInTheDocument();
    expect(bodyOf(fetchMock, 'POST /admin/users/u2/ban/renew')).toEqual({ reason: 'Still posting spam elsewhere' });

    fireEvent.click(within(section).getByRole('button', { name: 'Unban User u2' }));
    expect(await answerReason('Appeal accepted')).toHaveTextContent('Lift the ban on User u2?');
    expect(await within(section).findByText('User u2 is no longer banned.')).toBeInTheDocument();
    await waitFor(() => expect(within(section).getByRole('button', { name: 'Ban User u2' })).toHaveFocus());

    fireEvent.click(within(section).getByRole('button', { name: 'Load more' }));
    expect(await within(section).findByText('User u4')).toBeInTheDocument();
    fireEvent.click(within(section).getByRole('button', { name: 'Ban User u4' }));
    expect(await answerReason(null)).toHaveTextContent('They own no groups.');

    fireEvent.change(within(section).getByLabelText('Search users'), { target: { value: ' ana ' } });
    fireEvent.click(within(section).getByRole('button', { name: 'Search' }));
    expect(await within(section).findByText('No users found.')).toBeInTheDocument();
    expect(calls(fetchMock)).toContain('GET /admin/users?q=ana');
  });

  it('shows an error when the users can’t be loaded', async () => {
    renderConsole({ 'GET /admin/users': apiError(500, 'x') });
    render(<SessionProvider><AdminConsoleView /></SessionProvider>);
    expect(await screen.findByText("Couldn't load the users.")).toBeInTheDocument();
  });
});

describe('banned sign-in', () => {
  it('explains a refused sign-in for a banned account', async () => {
    window.history.pushState({}, '', '/study-groups?signin=banned');
    stubApi({ 'GET /me': { user: null } });
    render(<SessionProvider><ProgramActions locale="en" /></SessionProvider>);
    expect(await screen.findByText(/This Google account is banned from the study groups/)).toBeInTheDocument();
  });
});
