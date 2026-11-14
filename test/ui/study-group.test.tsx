import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CurrentRoundResponse, GroupInfo, Material, Round, TallyEntry } from '@/workers/study-group/contract';
import { createStudyGroupApi, StudyGroupApiError } from '@/features/study-group/api';
import { highlightMs, pollIntervalMs, StudyGroupBoard } from '@/features/study-group/study-group-board';
import { createUnlistedNextMetadata } from '@/lib/next-metadata';
import { StudyGroupPage } from '@/site-pages/study-group-page';

const api = vi.hoisted(() => ({
  getGroup: vi.fn(),
  listMaterials: vi.fn(),
  createMaterial: vi.fn(),
  updateMaterial: vi.fn(),
  deleteMaterial: vi.fn(),
  getCurrentRound: vi.fn(),
  createRound: vi.fn(),
  castVote: vi.fn(),
  closeRound: vi.fn(),
  cancelRound: vi.fn()
}));

vi.mock('@/features/study-group/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/study-group/api')>()),
  createStudyGroupApi: vi.fn(() => api)
}));

vi.stubGlobal('React', React);

const group: GroupInfo = {
  name: 'DevTalk',
  description: 'This group gives us a chance to improve our English skills.',
  rules: ["Don't speak in Portuguese", 'Do your best to practice in our meeting'],
  meetingDay: 'Monday',
  meetingStart: '20:00',
  meetingEnd: '21:00',
  timezone: 'America/Sao_Paulo',
  meetingUrl: 'https://meet.example.com/abc'
};

function material(id: number, overrides: Partial<Material> = {}): Material {
  return { id, suggestedBy: `Person ${id}`, type: 'video', title: `Material ${id}`, url: null, notes: null, status: 'open', createdAt: '2026-11-01T12:00:00Z', discussedAt: null, ...overrides };
}

const votingRound: Round = { id: 7, mode: 'vote', status: 'open', createdAt: '2026-11-10T20:00:00Z', closedAt: null, winnerMaterialId: null };
const closedRound: Round = { ...votingRound, status: 'closed', closedAt: '2026-11-10T21:00:00Z', winnerMaterialId: 1 };

function setup({ materials = [material(1), material(2)], round = null, tally = [] }: { materials?: Material[]; round?: Round | null; tally?: TallyEntry[] } = {}) {
  api.getGroup.mockResolvedValue({ group });
  api.listMaterials.mockResolvedValue({ materials });
  api.getCurrentRound.mockResolvedValue({ round, tally } satisfies CurrentRoundResponse);
  return render(<StudyGroupBoard apiUrl="/api/study-group" />);
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem('study-group:code', 'group-code');
  Object.values(api).forEach((fn) => fn.mockReset());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('study group page', () => {
  it('uses the default same-origin API URL or the configured override', async () => {
    setup();
    const { unmount } = render(<StudyGroupPage />);
    expect(createStudyGroupApi).toHaveBeenLastCalledWith('/api/study-group', expect.any(Function));
    expect(screen.getAllByRole('link', { name: 'fbrissi.dev home' })[0]).toHaveAttribute('href', '/');
    unmount();

    vi.stubEnv('NEXT_PUBLIC_STUDY_GROUP_API_URL', 'http://localhost:8788/api/study-group');
    render(<StudyGroupPage />);
    expect(createStudyGroupApi).toHaveBeenLastCalledWith('http://localhost:8788/api/study-group', expect.any(Function));
    await screen.findAllByText('Material 1');
  });

  it('builds unlisted metadata without canonical or social tags', () => {
    const metadata = createUnlistedNextMetadata({ title: 'Study group', description: 'Board' });
    expect(metadata).toMatchObject({ referrer: 'no-referrer', robots: { index: false, follow: false, nocache: true } });
    expect(metadata).not.toHaveProperty('alternates');
    expect(metadata).not.toHaveProperty('openGraph');
    expect(metadata).not.toHaveProperty('twitter');
  });
});

describe('access code gate', () => {
  it('asks for the code before loading anything and remembers it', async () => {
    window.localStorage.removeItem('study-group:code');
    setup();
    expect(await screen.findByRole('heading', { level: 1, name: 'Enter the group code' })).toBeInTheDocument();
    expect(api.listMaterials).not.toHaveBeenCalled();
    expect(api.getGroup).not.toHaveBeenCalled();

    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(api.getCurrentRound).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Open the board' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter the group code.');
    expect(screen.getByLabelText('Group code')).toHaveAttribute('aria-invalid', 'true');

    fireEvent.change(screen.getByLabelText('Group code'), { target: { value: '  secret  ' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open the board' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'DevTalk' })).toBeInTheDocument();
    expect(window.localStorage.getItem('study-group:code')).toBe('secret');
    expect(vi.mocked(createStudyGroupApi).mock.lastCall?.[1]()).toBe('secret');
  });

  it('clears a rejected code and asks again', async () => {
    api.getCurrentRound.mockResolvedValue({ round: null, tally: [] });
    api.listMaterials.mockRejectedValueOnce(new StudyGroupApiError(401, 'access_code_required'));
    render(<StudyGroupBoard apiUrl="/api" />);
    expect(await screen.findByText("That code didn't work. Check the latest code with the group.")).toBeInTheDocument();
    expect(window.localStorage.getItem('study-group:code')).toBeNull();
    expect(api.getGroup).not.toHaveBeenCalled();
  });

  it('locks the board when the code is revoked during actions, votes, polling or suggestions', async () => {
    const revoked = () => new StudyGroupApiError(401, 'access_code_required');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    setup();
    await screen.findByText('Material 1');
    api.deleteMaterial.mockRejectedValueOnce(revoked());
    fireEvent.click(screen.getByRole('button', { name: 'Delete “Material 1”' }));
    expect(await screen.findByText('Enter the group code')).toBeInTheDocument();
    cleanup();

    window.localStorage.setItem('study-group:code', 'group-code');
    window.localStorage.setItem('study-group:name', 'Ana');
    setup({ round: votingRound });
    await screen.findByText('0 votes so far');
    api.castVote.mockRejectedValueOnce(revoked());
    fireEvent.click(screen.getByRole('button', { name: 'Vote for: Material 1, 0 votes' }));
    expect(await screen.findByText('Enter the group code')).toBeInTheDocument();
    cleanup();

    window.localStorage.setItem('study-group:code', 'group-code');
    setup({ round: votingRound });
    await screen.findByText('0 votes so far');
    api.getCurrentRound.mockRejectedValueOnce(revoked());
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(await screen.findByText('Enter the group code')).toBeInTheDocument();
    cleanup();

    window.localStorage.setItem('study-group:code', 'group-code');
    setup();
    await screen.findByText('Material 1');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Talk' } });
    api.createMaterial.mockRejectedValueOnce(revoked());
    fireEvent.click(screen.getByRole('button', { name: 'Add suggestion' }));
    expect(await screen.findByText('Enter the group code')).toBeInTheDocument();
  });
});

describe('group header', () => {
  it('shows the group info, rules, schedule and meeting link', async () => {
    setup();
    expect(await screen.findByRole('heading', { level: 1, name: 'DevTalk' })).toBeInTheDocument();
    expect(screen.getByText(group.description)).toBeInTheDocument();
    expect(screen.getByText("Don't speak in Portuguese")).toBeInTheDocument();
    expect(screen.getByText('Meeting: Monday 8 PM - 9 PM (BRT)')).toBeInTheDocument();
    const join = screen.getByRole('link', { name: /join meeting/i });
    expect(join).toHaveAttribute('href', group.meetingUrl);
    expect(join).toHaveAttribute('target', '_blank');
    expect(join).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('hides the meeting link and rules when they are missing', async () => {
    setup();
    api.getGroup.mockResolvedValue({ group: { ...group, rules: [], meetingUrl: null } });
    cleanup();
    render(<StudyGroupBoard apiUrl="/api" />);
    expect(await screen.findByText('Meeting: Monday 8 PM - 9 PM (BRT)')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /join meeting/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Group rules')).not.toBeInTheDocument();
  });

  it('falls back to a generic title when the group cannot be loaded', async () => {
    setup();
    api.getGroup.mockRejectedValue(new Error('offline'));
    cleanup();
    render(<StudyGroupBoard apiUrl="/api" />);
    await screen.findByText('Material 1');
    expect(screen.getByRole('heading', { level: 1, name: 'Study group' })).toBeInTheDocument();
    expect(screen.queryByText(/^Meeting:/)).not.toBeInTheDocument();
  });
});

describe('materials board', () => {
  it('shows a loading skeleton, then materials with links, notes and the discussed history', async () => {
    setup({
      materials: [
        material(1, { url: 'https://www.youtube.com/watch?v=1', notes: 'Line one\nLine two' }),
        material(2),
        material(3, { status: 'discussed', discussedAt: '2026-11-06T12:00:00Z', url: 'https://example.com/a', type: 'podcast' }),
        material(4, { status: 'discussed', discussedAt: '2026-11-08T12:00:00Z' })
      ]
    });
    expect(screen.getByRole('status')).toHaveTextContent('Loading materials…');

    const link = await screen.findByRole('link', { name: /Material 1/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    expect(screen.getByText('youtube.com')).toBeInTheDocument();
    expect(screen.getByText(/Line one/)).toHaveClass('whitespace-pre-line');
    expect(screen.getByText('2 items · newest first')).toBeInTheDocument();

    const history = screen.getByRole('region', { name: 'Already discussed' });
    const rows = within(history).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Material 4');
    expect(rows[1]).toHaveTextContent('Podcast · by Person 3 · discussed Nov 6');
  });

  it('shows the empty state and the load error with retry', async () => {
    setup({ materials: [] });
    expect(await screen.findByText('Nothing to discuss yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Suggest material' })).toHaveAttribute('href', '#suggest');
    expect(screen.getByText('Add a suggestion first: there are no open items to pick from.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /draw at random/i })).toBeDisabled();
    cleanup();

    api.listMaterials.mockRejectedValueOnce(new Error('offline'));
    render(<StudyGroupBoard apiUrl="/api" />);
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the board");
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Nothing to discuss yet')).toBeInTheDocument();
  });

  it('marks, reverts and deletes materials with confirmation', async () => {
    setup({ materials: [material(1), material(2, { status: 'discussed', discussedAt: '2026-11-06T12:00:00Z' })] });
    await screen.findByText('Material 1');

    api.updateMaterial.mockResolvedValueOnce({ material: material(1, { status: 'discussed', discussedAt: '2026-11-13T12:00:00Z' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Mark discussed' }));
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Already discussed' })).getAllByRole('listitem')).toHaveLength(2));
    expect(api.updateMaterial).toHaveBeenCalledWith(1, { status: 'discussed' });

    api.updateMaterial.mockResolvedValueOnce({ material: material(2) });
    fireEvent.click(screen.getByRole('button', { name: 'Revert “Material 2” to open' }));
    expect(await screen.findByRole('button', { name: 'Delete “Material 2”' })).toBeInTheDocument();

    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete “Material 2”' }));
    expect(api.deleteMaterial).not.toHaveBeenCalled();

    api.deleteMaterial.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Delete “Material 2”' }));
    await waitFor(() => expect(screen.queryByText('Material 2')).not.toBeInTheDocument());
    expect(confirm).toHaveBeenLastCalledWith('Delete “Material 2”? It will be removed from the board.');
  });

  it('shows action errors from the API and a generic fallback', async () => {
    setup();
    await screen.findByText('Material 1');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    api.deleteMaterial.mockRejectedValueOnce(new StudyGroupApiError(404, 'Material not found'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete “Material 1”' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Material not found');

    api.updateMaterial.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark discussed' })[0]);
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });
});

describe('weekly round', () => {
  it('explains eligibility and runs a random draw', async () => {
    setup({ materials: [material(1)] });
    expect(await screen.findByText('1 open item is eligible. A vote needs at least 2.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start vote' })).toBeDisabled();

    api.createRound.mockResolvedValueOnce({ round: { ...closedRound, mode: 'draw' }, winner: material(1), tally: [] });
    fireEvent.click(screen.getByRole('button', { name: /draw at random/i }));
    expect(await screen.findByText('Picked by random draw')).toBeInTheDocument();
    expect(api.createRound).toHaveBeenCalledWith({ mode: 'draw' });
    expect(screen.getByRole('heading', { name: "This week's topic" })).toBeInTheDocument();

    api.updateMaterial.mockResolvedValueOnce({ material: material(1, { status: 'discussed', discussedAt: '2026-11-13T12:00:00Z' }) });
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark discussed' })[0]);
    expect(await screen.findByText('Discussed Nov 13')).toBeInTheDocument();

    api.updateMaterial.mockResolvedValueOnce({ material: material(1) });
    fireEvent.click(screen.getByRole('button', { name: 'Revert to open' }));
    expect(await screen.findByText('Mark it once the group has talked about it.')).toBeInTheDocument();
  });

  it('shows the vote winner with voters and handles a deleted winner or cancelled round', async () => {
    const tally = [{ materialId: 1, votes: 2, voters: ['Ana', 'Bruno'] }, { materialId: 2, votes: 2, voters: ['Carla', 'Diego'] }];
    setup({ materials: [material(1, { url: 'https://example.com/w' }), material(2), material(3)], round: closedRound, tally });
    expect(await screen.findByText('Tie broken by draw')).toBeInTheDocument();
    expect(screen.getByText('Voted by Ana, Bruno')).toBeInTheDocument();
    expect(screen.getByText('Round closed · Nov 10')).toBeInTheDocument();
    expect(screen.getByText('3 open items are eligible.')).toBeInTheDocument();
    cleanup();

    setup({ materials: [material(2)], round: closedRound });
    expect(await screen.findByText('The picked item was deleted. Start a new round below.')).toBeInTheDocument();
    cleanup();

    setup({ round: { ...closedRound, winnerMaterialId: null } });
    expect(await screen.findByText('No round in progress')).toBeInTheDocument();
  });

  it('starts a vote and lets members vote with a remembered name', async () => {
    setup({ materials: [material(1), material(2), material(3, { createdAt: '2026-11-11T12:00:00Z' })] });
    await screen.findByText('Material 1');

    api.createRound.mockResolvedValueOnce({ round: votingRound, winner: null, tally: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Start vote' }));
    expect(await screen.findByText('Vote for this week\'s topic')).toBeInTheDocument();
    expect(screen.getByText('No votes yet. Be the first!')).toBeInTheDocument();
    expect(screen.getByText('Joins the next round')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vote for: Material 1, 0 votes' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter your name to vote.');
    expect(screen.getByLabelText('Voting as')).toHaveFocus();
    expect(api.castVote).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Voting as'), { target: { value: 'Ana' } });
    expect(window.localStorage.getItem('study-group:name')).toBe('Ana');
    expect(screen.getByLabelText('Your name')).toHaveValue('Ana');

    api.castVote.mockResolvedValueOnce({ round: votingRound, winner: null, tally: [{ materialId: 1, votes: 2, voters: ['Bruno', 'Ana'] }, { materialId: 99, votes: 1, voters: ['Ghost'] }] });
    fireEvent.click(screen.getByRole('button', { name: 'Vote for: Material 1, 0 votes' }));
    expect(screen.getByRole('button', { name: 'Your vote: Material 1, 1 vote' })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByRole('button', { name: 'Your vote: Material 1, 2 votes' })).toBeInTheDocument();
    expect(api.castVote).toHaveBeenCalledWith(7, { materialId: 1, voterName: 'Ana' });
    expect(screen.getByText('3 votes so far')).toBeInTheDocument();
    expect(within(screen.getByRole('group', { name: 'Live results' })).getAllByText(/votes?$/)).toHaveLength(1);

    api.castVote.mockRejectedValueOnce(new StudyGroupApiError(422, 'Round is closed'));
    fireEvent.click(screen.getByRole('button', { name: 'Vote for: Material 2, 0 votes' }));
    expect(await screen.findByText('Round is closed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Your vote: Material 1, 2 votes' })).toBeInTheDocument();
  });

  it('closes or cancels an open vote after confirmation', async () => {
    const tally = [{ materialId: 1, votes: 3, voters: ['Ana', 'Bruno', 'Carla'] }, { materialId: 2, votes: 1, voters: ['Diego'] }];
    setup({ round: votingRound, tally });
    expect(await screen.findByText('4 votes so far')).toBeInTheDocument();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);

    fireEvent.click(screen.getByRole('button', { name: 'Close vote' }));
    expect(api.closeRound).not.toHaveBeenCalled();

    api.deleteMaterial.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Delete “Material 2”' }));
    expect(await screen.findByText('3 votes so far')).toBeInTheDocument();

    api.cancelRound.mockResolvedValueOnce({ round: { ...votingRound, status: 'closed', closedAt: '2026-11-10T21:00:00Z' }, winner: null, tally: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel round' }));
    expect(await screen.findByText('No round in progress')).toBeInTheDocument();
    expect(confirm).toHaveBeenLastCalledWith('Cancel this round? All votes will be discarded.');
    cleanup();

    setup({ round: votingRound, tally });
    await screen.findByText('4 votes so far');
    api.closeRound.mockResolvedValueOnce({ round: closedRound, winner: material(1), tally });
    fireEvent.click(screen.getByRole('button', { name: 'Close vote' }));
    expect(await screen.findByText('Chosen by vote · 3 of 4 votes')).toBeInTheDocument();
    expect(api.closeRound).toHaveBeenCalledWith(7);
  });

  it('polls the round while a vote is open and refreshes on focus', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    setup({ round: votingRound });
    await screen.findByText('0 votes so far');
    expect(api.getCurrentRound).toHaveBeenCalledTimes(1);

    api.getCurrentRound.mockResolvedValueOnce({ round: votingRound, tally: [{ materialId: 2, votes: 1, voters: ['Ana'] }] });
    await act(async () => { vi.advanceTimersByTime(pollIntervalMs); });
    expect(await screen.findByText('1 vote so far')).toBeInTheDocument();

    api.getCurrentRound.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { vi.advanceTimersByTime(pollIntervalMs); });
    expect(screen.getByText('1 vote so far')).toBeInTheDocument();

    api.getCurrentRound.mockResolvedValueOnce({ round: closedRound, tally: [] });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(await screen.findByText('No votes, picked by random draw')).toBeInTheDocument();

    const calls = api.getCurrentRound.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(pollIntervalMs * 2); });
    expect(api.getCurrentRound).toHaveBeenCalledTimes(calls);
  });
});

describe('suggest form', () => {
  async function renderForm() {
    setup();
    await screen.findByText('Material 1');
    return {
      name: screen.getByLabelText('Your name'),
      title: screen.getByLabelText('Title'),
      url: screen.getByLabelText(/^Link/),
      notes: screen.getByLabelText(/^Notes/),
      submit: () => fireEvent.click(screen.getByRole('button', { name: 'Add suggestion' }))
    };
  }

  it('pre-fills the remembered name', async () => {
    window.localStorage.setItem('study-group:name', 'Rafael');
    const { name } = await renderForm();
    expect(name).toHaveValue('Rafael');
  });

  it('validates fields on submit and focuses the first invalid one', async () => {
    const form = await renderForm();
    form.submit();
    expect(screen.getByText('Please enter your name.')).toBeInTheDocument();
    expect(screen.getByText('Please add a title.')).toBeInTheDocument();
    expect(form.name).toHaveFocus();
    expect(form.name).toHaveAttribute('aria-invalid', 'true');
    expect(form.name).toHaveAttribute('aria-describedby', 'suggest-suggestedBy-error');

    fireEvent.change(form.name, { target: { value: 'x'.repeat(61) } });
    fireEvent.change(form.title, { target: { value: 'y'.repeat(201) } });
    fireEvent.change(form.url, { target: { value: 'youtube.com/watch' } });
    fireEvent.change(form.notes, { target: { value: 'z'.repeat(2001) } });
    expect(screen.queryByText('Please enter your name.')).not.toBeInTheDocument();
    form.submit();
    expect(screen.getByText('Use 60 characters or fewer.')).toBeInTheDocument();
    expect(screen.getByText('Use 200 characters or fewer.')).toBeInTheDocument();
    expect(screen.getByText('Enter a full link starting with https:// (or http://).')).toBeInTheDocument();
    expect(screen.getByText('Use 2000 characters or fewer.')).toBeInTheDocument();
    expect(screen.getByText('2001 / 2000')).toBeInTheDocument();
    expect(api.createMaterial).not.toHaveBeenCalled();
  });

  it('adds a suggestion, highlights it, and resets for another', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const form = await renderForm();
    fireEvent.change(form.name, { target: { value: ' Rafael ' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'podcast' } });
    fireEvent.change(form.title, { target: { value: 'Money idioms' } });
    fireEvent.change(form.url, { target: { value: 'https://example.com/idioms' } });
    fireEvent.change(form.notes, { target: { value: '  ' } });

    let resolve: (value: unknown) => void = () => undefined;
    api.createMaterial.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    form.submit();
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
    expect(api.createMaterial).toHaveBeenCalledWith({ suggestedBy: 'Rafael', type: 'podcast', title: 'Money idioms', url: 'https://example.com/idioms' });

    await act(async () => resolve({ material: material(10, { title: 'Money idioms', url: 'https://example.com/idioms' }) }));
    expect(screen.getByRole('status')).toHaveTextContent("Thanks, Rafael! It's at the top of Open materials.");
    const card = screen.getByRole('link', { name: /Money idioms/ }).closest('article');
    expect(card).toHaveClass('border-green-500');
    expect(screen.getByText('3 items · newest first')).toBeInTheDocument();

    await act(async () => { vi.advanceTimersByTime(highlightMs); });
    expect(card).not.toHaveClass('border-green-500');

    fireEvent.click(screen.getByRole('button', { name: 'Suggest another' }));
    expect(screen.getByLabelText('Title')).toHaveValue('');
    expect(screen.getByLabelText('Type')).toHaveValue('article');
  });

  it('maps duplicate links to the URL field and keeps values on server errors', async () => {
    const form = await renderForm();
    fireEvent.change(form.name, { target: { value: 'Ana' } });
    fireEvent.change(form.title, { target: { value: 'Talk' } });
    fireEvent.change(form.url, { target: { value: 'https://example.com/dup' } });

    api.createMaterial.mockRejectedValueOnce(new StudyGroupApiError(409, 'Duplicate'));
    form.submit();
    expect(await screen.findByText('This link was already suggested.')).toBeInTheDocument();
    expect(form.url).toHaveFocus();

    api.createMaterial.mockRejectedValueOnce(new StudyGroupApiError(500, 'Boom'));
    form.submit();
    expect(await screen.findByText("Couldn't save your suggestion.")).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Talk');
  });
});
