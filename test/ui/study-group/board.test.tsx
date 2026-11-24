import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GroupBoardView } from '@/features/study-group/group-page';
import { SessionProvider } from '@/features/study-group/session';
import { highlightMs, pollIntervalMs } from '@/features/study-group/study-group-board';
import type { CurrentRoundResponse, GroupRole, Material, Member, Round, TallyEntry } from '@/workers/study-group/contract';

import { admin, answerConfirm, answerReason, apiError, bodyOf, calls, closedRound, group, material, pending, stubApi, user, votingRound, type Routes } from './fake-api';

vi.stubGlobal('React', React);

const navigation = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('@/features/study-group/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/study-group/navigation')>()),
  navigate: navigation.navigate
}));

const members: Member[] = [
  { userId: 'user0001', displayName: 'Olivia', role: 'owner', joinedAt: null },
  { userId: 'user0002', displayName: 'Max', role: 'member', joinedAt: '2026-11-02T00:00:00Z' }
];
const base = `/groups/${group.id}`;

function setup({ role = 'owner', materials = [material(1), material(2)], round = null, tally = [], myVote = null, routes = {}, me = user }: { role?: GroupRole; materials?: Material[]; round?: Round | null; tally?: TallyEntry[]; myVote?: number | null; routes?: Routes; me?: typeof user } = {}) {
  const fetchMock = stubApi({
    'GET /me': { user: me },
    [`GET ${base}`]: { group, role, canParticipate: role !== 'platform_admin' },
    [`GET ${base}/materials`]: { materials },
    [`GET ${base}/rounds/current`]: { round, tally, myVote } satisfies CurrentRoundResponse,
    [`GET ${base}/members`]: { members },
    ...routes
  });
  const view = render(<SessionProvider><GroupBoardView /></SessionProvider>);
  return { fetchMock, ...view };
}

beforeEach(() => {
  window.history.pushState({}, '', `/study-groups/g/${group.id}`);
  navigation.navigate.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.stubGlobal('React', React);
});

describe('group page shell', () => {
  it('shows not found for a malformed URL and asks visitors to sign in', async () => {
    window.history.pushState({}, '', '/study-groups/group');
    stubApi({ 'GET /me': { user: null } });
    const { unmount } = render(<SessionProvider><GroupBoardView /></SessionProvider>);
    expect(await screen.findByText("This group doesn't exist or was deleted.")).toBeInTheDocument();
    unmount();

    window.history.pushState({}, '', `/study-groups/g/${group.id}`);
    render(<SessionProvider><GroupBoardView /></SessionProvider>);
    expect(await screen.findByRole('link', { name: 'Sign in with Google' })).toHaveAttribute('href', `/api/study-group/auth/login?returnTo=%2Fstudy-groups%2Fg%2F${group.id}`);
  });

  it('handles missing groups and load errors', async () => {
    stubApi({ 'GET /me': { user }, [`GET ${base}`]: apiError(404, 'Group not found') });
    const { unmount } = render(<SessionProvider><GroupBoardView /></SessionProvider>);
    expect(screen.queryByText('Loading the group…')).not.toBeInTheDocument();
    expect(await screen.findByText("This group doesn't exist or was deleted.")).toBeInTheDocument();
    unmount();
    stubApi({ 'GET /me': { user }, [`GET ${base}`]: apiError(500, 'boom') });
    render(<SessionProvider><GroupBoardView /></SessionProvider>);
    expect(await screen.findByText("Couldn't load the group. Please try again.")).toBeInTheDocument();
  });

  it('shows a loading state while the group loads', async () => {
    stubApi({ 'GET /me': { user }, [`GET ${base}`]: pending() });
    render(<SessionProvider><GroupBoardView /></SessionProvider>);
    expect(await screen.findByText('Loading the group…')).toBeInTheDocument();
  });
});

describe('join screen (D5)', () => {
  function join(routes: Routes) {
    return stubApi({ 'GET /me': { user }, [`GET ${base}`]: apiError(403, 'Forbidden'), ...routes });
  }

  it('shows a rejected request and when to ask again instead of the form', async () => {
    join({ [`GET ${base}/preview`]: { group: { id: group.id, name: group.name, summary: group.summary, iconUrl: null }, membership: 'none', canAskAgainAt: '2026-11-29T12:00:00.000Z' } });
    render(<SessionProvider><GroupBoardView /></SessionProvider>);
    const rejection = await screen.findByRole('alert');
    expect(rejection).toHaveTextContent('The owner didn’t approve your request to join this group.');
    expect(rejection).toHaveTextContent('You can ask again after November 29, 2026 at 9:00 AM (Brasília time), or look for another group on the study groups page.');
    expect(screen.queryByLabelText('Access code')).not.toBeInTheDocument();
  });

  it('asks for the code, explains wrong codes and sends the request with an optional message', async () => {
    let attempt = 0;
    const fetchMock = join({
      [`GET ${base}/preview`]: { group: { id: group.id, name: group.name, summary: group.summary, requiresAccessCode: true }, membership: 'none' },
      [`POST ${base}/join`]: () => [
        apiError(403, 'invalid_code'),
        apiError(409, 'Your request to join this group was not approved. You can ask again after November 29, 2026 at 9:00 AM (Brasília time).'),
        { status: 'pending' }
      ][attempt++]
    });
    render(<SessionProvider><GroupBoardView /></SessionProvider>);
    expect(await screen.findByRole('heading', { name: 'Go Talk' })).toBeInTheDocument();
    expect(screen.getByText(group.summary)).toBeInTheDocument();
    expect(screen.getByText("This group only accepts requests with an access code, by its creator's choice. Ask the group for it.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter the access code.');
    fireEvent.change(screen.getByLabelText('Access code'), { target: { value: ' wrong ' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("That code didn't work.");
    expect(screen.getByLabelText('Access code')).toHaveAttribute('aria-invalid', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    // The 7-day wait is about the request, not the code: a form-level error, and the code field stays valid.
    expect(await screen.findByText('Your request to join this group was not approved. You can ask again after November 29, 2026 at 9:00 AM (Brasília time).')).toBeInTheDocument();
    expect(screen.getByLabelText('Access code')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText("That code didn't work.", { exact: false })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Message to the owner/), { target: { value: ' Hi! ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Your request was sent.')).toBeInTheDocument();
    expect(screen.getByText(/this page opens the board; you won.t need the code again\./)).toBeInTheDocument();
    expect(bodyOf(fetchMock, `POST ${base}/join`)).toEqual({ code: 'wrong' });
    expect(JSON.parse((fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/join')).at(-1)![1] as RequestInit).body as string)).toEqual({ code: 'wrong', message: 'Hi!' });
  });

  it('sends a request without a code to a group that does not require one', async () => {
    const fetchMock = join({
      [`GET ${base}/preview`]: { group: { ...group, requiresAccessCode: false }, membership: 'none', canAskAgainAt: null },
      [`POST ${base}/join`]: { status: 'pending' },
    });
    render(<SessionProvider><GroupBoardView /></SessionProvider>);
    expect(await screen.findByRole('heading', { name: 'Ask to join' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Access code')).not.toBeInTheDocument();
    expect(screen.queryByText(/only accepts requests with an access code/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Message to the owner/), { target: { value: ' Hi! ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('The owner reviews each request. Once approved, this page opens the board.')).toBeInTheDocument();
    expect(bodyOf(fetchMock, `POST ${base}/join`)).toEqual({ message: 'Hi!' });
  });

  it('asks for the code when the preview does not say whether the group requires one', async () => {
    const fetchMock = join({
      [`GET ${base}/preview`]: { group: { id: group.id, name: group.name, summary: group.summary }, membership: 'none' },
      [`POST ${base}/join`]: { status: 'pending' },
    });
    render(<SessionProvider><GroupBoardView /></SessionProvider>);
    expect(await screen.findByText("This group only accepts requests with an access code, by its creator's choice. Ask the group for it.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter the access code.');
    fireEvent.change(screen.getByLabelText('Access code'), { target: { value: ' code ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Your request was sent.')).toBeInTheDocument();
    expect(bodyOf(fetchMock, `POST ${base}/join`)).toEqual({ code: 'code' });
  });

  it('shows a pending request and preview errors', async () => {
    join({ [`GET ${base}/preview`]: { group, membership: 'pending' } });
    const { unmount } = render(<SessionProvider><GroupBoardView /></SessionProvider>);
    expect(await screen.findByText('Your request was sent.')).toBeInTheDocument();
    unmount();
    const fetchMock = join({ [`GET ${base}/preview`]: pending() });
    const second = render(<SessionProvider><GroupBoardView /></SessionProvider>);
    await waitFor(() => expect(calls(fetchMock)).toContain(`GET ${base}/preview`));
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    second.unmount();
    join({ [`GET ${base}/preview`]: apiError(500, 'x') });
    render(<SessionProvider><GroupBoardView /></SessionProvider>);
    expect(await screen.findByText("Couldn't load this group. Check the link and try again.")).toBeInTheDocument();
  });
});

describe('board for members', () => {
  it('shows the header, members and suggestions without owner controls (D6)', async () => {
    setup({ role: 'member', materials: [material(1, { status: 'pending', mine: true, url: 'https://www.example.com/x', notes: 'Watch part 1' }), material(2), material(3, { status: 'discussed', discussedAt: '2026-11-05T00:00:00Z' })] });
    expect(await screen.findByRole('heading', { level: 1, name: 'Go Talk' })).toBeInTheDocument();
    expect(screen.getByText('Meeting: Monday 8 PM - 9 PM (BRT)')).toBeInTheDocument();
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Join meeting/ })).toHaveAttribute('href', group.meetingUrl);
    expect(screen.queryByRole('link', { name: 'Group settings' })).not.toBeInTheDocument();
    expect(screen.getByText("Don't speak in Portuguese").closest('ol')).toBeInTheDocument();

    expect(await screen.findByText('Pending review')).toBeInTheDocument();
    expect(screen.getByText('example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark discussed' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Draw at random' })).not.toBeInTheDocument();
    expect(screen.getByText(/The owner starts a random draw/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Already discussed/));
    expect(screen.queryByRole('button', { name: /Revert/ })).not.toBeInTheDocument();

    const membersSection = screen.getByRole('region', { name: 'Members' });
    expect(await within(membersSection).findByText('Max')).toBeInTheDocument();
    expect(within(membersSection).getByText('Owner')).toBeInTheDocument();
  });

  it('lets a member leave after confirming', async () => {
    let leaveResult: unknown = apiError(409, 'Nope');
    setup({ role: 'member', routes: { [`POST ${base}/leave`]: () => leaveResult } });
    const leave = await screen.findByRole('button', { name: 'Leave group' });
    fireEvent.click(leave);
    const dialog = await answerConfirm(false);
    expect(dialog).toHaveTextContent('Leave this group?');
    expect(dialog).toHaveTextContent('You will need the access code and the owner’s approval to come back.');
    expect(navigation.navigate).not.toHaveBeenCalled();
    fireEvent.click(leave);
    await answerConfirm(true);
    expect(await screen.findByText('Nope')).toBeInTheDocument();
    leaveResult = null;
    fireEvent.click(leave);
    await answerConfirm(true);
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('/study-groups/my'));
  });

  it('does not mention the access code when a member leaves a group that does not require one', async () => {
    setup({ role: 'member', routes: { [`GET ${base}`]: { group: { ...group, requiresAccessCode: false }, role: 'member', canParticipate: true } } });
    fireEvent.click(await screen.findByRole('button', { name: 'Leave group' }));
    expect(await answerConfirm(false)).toHaveTextContent('You will need the owner’s approval to come back.');
  });

  it('shows member list errors', async () => {
    setup({ role: 'member', routes: { [`GET ${base}/members`]: apiError(500, 'x') } });
    expect(await screen.findByText("Couldn't load the members.")).toBeInTheDocument();
  });

  it('suggests material as the signed-in user, including review mode and duplicates', async () => {
    let attempt = 0;
    const fetchMock = setup({
      role: 'member',
      materials: [],
      routes: {
        [`POST ${base}/materials`]: () => [
          apiError(409, 'dup'),
          apiError(500, 'x'),
          { material: material(9, { title: 'New talk', status: 'pending', mine: true }) },
          { material: material(10, { title: 'Open talk', mine: true }) }
        ][attempt++]
      }
    }).fetchMock;
    expect(await screen.findByText('Nothing to discuss yet')).toBeInTheDocument();
    expect(screen.getByText('Olivia', { selector: 'b' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add suggestion' }));
    expect(screen.getByText('Please add a title.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'x'.repeat(201) } });
    fireEvent.change(screen.getByLabelText(/^Link/), { target: { value: 'ftp://nope' } });
    fireEvent.change(screen.getByLabelText(/^Notes/), { target: { value: 'n'.repeat(2001) } });
    fireEvent.click(screen.getByRole('button', { name: 'Add suggestion' }));
    expect(screen.getByText('Use 200 characters or fewer.')).toBeInTheDocument();
    expect(screen.getByText('Enter a full link starting with https:// (or http://).')).toBeInTheDocument();
    expect(screen.getByText('Use 2000 characters or fewer.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New talk' } });
    fireEvent.change(screen.getByLabelText(/^Link/), { target: { value: 'https://example.com/t' } });
    fireEvent.change(screen.getByLabelText(/^Notes/), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'podcast' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add suggestion' }));
    expect(await screen.findByText('This link was already suggested.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add suggestion' }));
    expect(await screen.findByText("Couldn't save your suggestion.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add suggestion' }));
    expect(await screen.findByText('Sent for review.')).toBeInTheDocument();
    expect(bodyOf(fetchMock, `POST ${base}/materials`)).toEqual({ type: 'podcast', title: 'New talk', url: 'https://example.com/t' });

    fireEvent.click(screen.getByRole('button', { name: 'Suggest another' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Open talk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add suggestion' }));
    expect(await screen.findByText('Added to the list.')).toBeInTheDocument();
  });

  it('removes the highlight of a new suggestion after a moment', async () => {
    setup({ role: 'member', materials: [], routes: { [`POST ${base}/materials`]: { material: material(9, { title: 'New talk' }) } } });
    await screen.findByText('Nothing to discuss yet');
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New talk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add suggestion' }));
    const card = (await screen.findByRole('heading', { name: 'New talk' })).closest('article')!;
    expect(card.className).toContain('border-green-500');
    await act(async () => undefined);
    await act(async () => vi.advanceTimersByTime(highlightMs));
    expect(card.className).not.toContain('border-green-500');
  });

  it('votes optimistically and rolls back on failure', async () => {
    let fail = true;
    setup({
      role: 'member',
      round: votingRound,
      tally: [{ materialId: 2, votes: 1, voters: ['Ana'] }],
      routes: {
        [`POST ${base}/rounds/7/votes`]: () => (fail ? apiError(422, 'This round is closed') : { round: votingRound, winner: null, tally: [{ materialId: 1, votes: 1, voters: ['Olivia'] }, { materialId: 2, votes: 1, voters: ['Ana'] }], myVote: 1 })
      }
    });
    expect(await screen.findByRole('heading', { name: /Vote for this week/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close vote' })).not.toBeInTheDocument();
    expect(screen.getByText('Voted:', { exact: false })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vote for: Material 1, 0 votes' }));
    expect(await screen.findByText('This round is closed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vote for: Material 1, 0 votes' })).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Vote for: Material 1, 0 votes' }));
    expect(await screen.findByRole('button', { name: 'Your vote: Material 1, 1 vote' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('polls the open round and refreshes on focus, ignoring transient errors', async () => {
    let count = 0;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup({ role: 'member', round: votingRound, routes: { [`GET ${base}/rounds/current`]: () => (count++ === 1 ? apiError(500, 'x') : { round: votingRound, tally: [], myVote: null }) } });
    await screen.findByText('No votes yet. Be the first!');
    await act(async () => undefined);
    await act(async () => vi.advanceTimersByTime(pollIntervalMs));
    await waitFor(() => expect(count).toBeGreaterThanOrEqual(2));
    const polled = count;
    await act(async () => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(count).toBe(polled + 1));
    expect(screen.getByText('No votes yet. Be the first!')).toBeInTheDocument();
  });

  it('marks items not yet eligible for the current vote', async () => {
    setup({ role: 'member', round: votingRound, materials: [material(1), material(2, { createdAt: '2026-12-01T00:00:00Z' })] });
    expect(await screen.findByText('Joins the next round')).toBeInTheDocument();
  });

  it('retries a failed board load', async () => {
    let fail = true;
    setup({ role: 'member', routes: { [`GET ${base}/materials`]: () => (fail ? apiError(500, 'x') : { materials: [material(1)] }) } });
    expect(await screen.findByText("Couldn't load the board")).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Material 1')).toBeInTheDocument();
  });
});

describe('board for owners', () => {
  it('runs draws and votes, closes and cancels rounds', async () => {
    const result = (round: Round, winner = null as Material | null) => ({ round, winner, tally: [{ materialId: 1, votes: 2, voters: ['Ana', 'Bo'] }], myVote: null });
    const { fetchMock } = setup({
      routes: {
        [`POST ${base}/rounds`]: (body: { mode: string }) => (body.mode === 'draw' ? result({ ...closedRound, mode: 'draw' }) : result(votingRound)),
        [`POST ${base}/rounds/7/close`]: result(closedRound),
        [`POST ${base}/rounds/7/cancel`]: { round: { ...closedRound, winnerMaterialId: null }, winner: null, tally: [], myVote: null }
      }
    });
    expect(await screen.findByText('2 open items are eligible.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Group settings' })).toHaveAttribute('href', `/study-groups/g/${group.id}/settings`);

    fireEvent.click(screen.getByRole('button', { name: 'Draw at random' }));
    expect(await screen.findByText('Picked by random draw')).toBeInTheDocument();
    expect(screen.getByText('Voted by Ana, Bo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start vote' }));
    expect(await screen.findByRole('button', { name: 'Close vote' })).toBeInTheDocument();
    expect(screen.getByText('Material 1', { selector: 'span' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close vote' }));
    expect(await answerConfirm(false)).toHaveTextContent('Close the vote and pick the winner?');
    expect(calls(fetchMock)).not.toContain(`POST ${base}/rounds/7/close`);
    fireEvent.click(screen.getByRole('button', { name: 'Close vote' }));
    await answerConfirm(true);
    expect(await screen.findByText('Chosen by vote · 2 of 2 votes')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start vote' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel round' }));
    expect(await answerConfirm(true)).toHaveTextContent('All votes in this round are discarded. This can’t be undone.');
    expect(await screen.findByRole('heading', { name: /topic hasn't been picked yet/ })).toBeInTheDocument();
  });

  it('explains start controls with zero or one item', async () => {
    const { unmount } = setup({ materials: [] });
    expect(await screen.findByText(/Add a suggestion first/)).toBeInTheDocument();
    unmount();
    setup({ materials: [material(1)] });
    expect(await screen.findByText('1 open item is eligible. A vote needs at least 2.')).toBeInTheDocument();
  });

  it('marks, reverts, approves and deletes materials, and shows action errors', async () => {
    let failDelete = true;
    const { fetchMock } = setup({
      materials: [material(1, { status: 'pending' }), material(2), material(3, { status: 'discussed', discussedAt: '2026-11-02T00:00:00Z' })],
      round: closedRound,
      routes: {
        [`POST ${base}/materials/1/approve`]: { material: material(1) },
        [`PATCH ${base}/materials/2`]: (body: { status: string }) => ({ material: material(2, { status: body.status as Material['status'], discussedAt: '2026-11-03T00:00:00Z' }) }),
        [`PATCH ${base}/materials/3`]: apiError(409, 'This URL is already open in another suggestion'),
        [`PATCH ${base}/materials/1`]: { material: material(1, { status: 'discussed', discussedAt: '2026-11-04T00:00:00Z' }) },
        [`DELETE ${base}/materials/2`]: () => (failDelete ? apiError(500, 'Nope') : null)
      }
    });
    expect(await screen.findByText('Pending review')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(screen.queryByText('Pending review')).not.toBeInTheDocument());

    // The closed round shows the winner with owner controls.
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark discussed' })[0]);
    expect(await screen.findByText(/Discussed Nov 4/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revert “Material 3” to open' }));
    expect(await screen.findByText('This URL is already open in another suggestion')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete “Material 2”' }));
    const dialog = await answerConfirm(true);
    expect(dialog).toHaveTextContent('Delete “Material 2” permanently?');
    expect(dialog).toHaveTextContent('The suggestion and its votes are deleted. This can’t be undone.');
    expect(await screen.findByText('Nope')).toBeInTheDocument();
    failDelete = false;
    fireEvent.click(screen.getByRole('button', { name: 'Delete “Material 2”' }));
    // A new action clears the old error; the deletion then shows its own status.
    await waitFor(() => expect(screen.queryByText('Nope')).not.toBeInTheDocument());
    await answerConfirm(true);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Material 2' })).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('“Material 2” was deleted permanently.');
    expect(bodyOf(fetchMock, `DELETE ${base}/materials/2`)).toEqual({});
  });

  it('reverts a discussed winner and shows a deleted winner', async () => {
    const { unmount } = setup({
      materials: [material(1, { status: 'discussed', discussedAt: '2026-11-02T00:00:00Z' })],
      round: closedRound,
      routes: { [`PATCH ${base}/materials/1`]: { material: material(1) } }
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Revert to open' }));
    expect(await screen.findAllByRole('button', { name: 'Mark discussed' })).toHaveLength(2);
    unmount();
    setup({ materials: [], round: closedRound });
    expect(await screen.findByText('The picked item was deleted. Start a new round below.')).toBeInTheDocument();
  });
});

describe('board details', () => {
  it('renders a minimal group profile and the closed round details', async () => {
    stubApi({
      'GET /me': { user },
      [`GET ${base}`]: { group: { ...group, rules: [], meetingUrl: null, moderationMode: 'review' }, role: 'owner', canParticipate: true },
      [`GET ${base}/materials`]: { materials: [material(1, { url: 'https://example.com/win', status: 'discussed', discussedAt: '2026-11-03T00:00:00Z' }), material(2)] },
      [`GET ${base}/rounds/current`]: { round: closedRound, tally: [{ materialId: 2, votes: 1, voters: ['Bo'] }], myVote: null },
      [`GET ${base}/members`]: { members },
      [`PATCH ${base}/materials/2`]: { material: material(2, { status: 'discussed', discussedAt: '2026-11-04T00:00:00Z' }) }
    });
    render(<SessionProvider><GroupBoardView /></SessionProvider>);
    expect(await screen.findByText('Suggestions are reviewed')).toBeInTheDocument();
    expect(screen.queryByText('Group rules')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Join meeting/ })).not.toBeInTheDocument();
    expect((await screen.findAllByRole('link', { name: /Material 1/ }))[0]).toHaveAttribute('href', 'https://example.com/win');
    expect(screen.getByText(/Discussed Nov 3/)).toBeInTheDocument();
    expect(screen.queryByText(/Voted by/)).not.toBeInTheDocument();

    const card = screen.getByRole('heading', { name: 'Material 2' }).closest('article')!;
    fireEvent.click(within(card).getByRole('button', { name: 'Mark discussed' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Material 2' })).not.toBeInTheDocument());
  });

  it('shows the closed round to members without controls', async () => {
    setup({ role: 'member', round: closedRound });
    expect(await screen.findByText('No votes, picked by random draw')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark discussed' })).not.toBeInTheDocument();
  });

  it('hides live results for deleted or vote-less items', async () => {
    setup({ round: votingRound, materials: [material(1)], tally: [{ materialId: 99, votes: 2, voters: ['A', 'B'] }, { materialId: 1, votes: 0, voters: [] }] });
    expect(await screen.findByText('No votes yet. Be the first!')).toBeInTheDocument();
  });
});

describe('board for the platform admin', () => {
  it('asks for a deletion reason and can cancel (D7)', async () => {
    const { fetchMock } = setup({ role: 'platform_admin', me: admin, tally: [{ materialId: 1, votes: 1, voters: ['Bo'] }], routes: { [`DELETE ${base}/materials/1`]: null } });
    expect(await screen.findByRole('button', { name: 'Delete “Material 1”' })).toBeInTheDocument();
    expect(screen.getByText('Platform admin')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete “Material 1”' }));
    const dialog = await answerReason(null);
    expect(dialog).toHaveTextContent('Delete “Material 1” permanently?');
    expect(dialog).toHaveTextContent('This can’t be undone. The reason is recorded in the moderation log and shown to the owner.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls(fetchMock)).not.toContain(`DELETE ${base}/materials/1`);
    fireEvent.click(screen.getByRole('button', { name: 'Delete “Material 1”' }));
    await answerReason('  Spam and self-promotion  ');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Material 1' })).not.toBeInTheDocument());
    expect(bodyOf(fetchMock, `DELETE ${base}/materials/1`)).toEqual({ reason: 'Spam and self-promotion' });
    expect(screen.getByRole('heading', { name: 'Open materials' })).toHaveFocus();
  });

  it('lets the admin manage a group they are not in, without suggesting or voting (decision 3)', async () => {
    setup({ role: 'platform_admin', me: admin, round: votingRound, tally: [{ materialId: 1, votes: 1, voters: ['Bo'] }] });
    expect(await screen.findByText('You manage this group as the platform admin. Only members suggest materials and vote.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add suggestion' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Close vote' })).toBeInTheDocument();
    expect(screen.getByText('Bo', { selector: 'b' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Vote for/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Joins the next round')).not.toBeInTheDocument();
  });
});
