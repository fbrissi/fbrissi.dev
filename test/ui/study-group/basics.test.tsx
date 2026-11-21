import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStudyGroupApi, errorMessage, groupPath, hasStatus, isConsentRequired, isUnauthorized, signInHref, StudyGroupApiError } from '@/features/study-group/api';
import { AccountNav, ConsentBanner } from '@/features/study-group/app-chrome';
import { CookieNotice, cookieNoticeStorageKey } from '@/features/study-group/cookie-notice';
import { applyVote, formatDate, formatMeeting, formatTime, groupIdFromPath, isEligible, linkDomain, pluralize, readStorage, totalVotes, typeLabel, winnerNote, writeStorage } from '@/features/study-group/helpers';
import { currentPath, navigate } from '@/features/study-group/navigation';
import { RequireUser, SessionProvider, SignInPrompt, useSession } from '@/features/study-group/session';
import { getProgramDocument } from '@/lib/study-groups';
import { POLICY_VERSIONS } from '@/workers/study-group/contract';

import { admin, apiError, bodyOf, calls, closedRound, group, material, stubApi, user, votingRound } from './fake-api';

vi.stubGlobal('React', React);

const navigation = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('@/features/study-group/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/study-group/navigation')>()),
  navigate: navigation.navigate
}));

beforeEach(() => {
  window.localStorage.clear();
  navigation.navigate.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.stubGlobal('React', React);
});

describe('api client', () => {
  it('calls every endpoint same-origin with JSON bodies for writes', async () => {
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal('fetch', fetchMock);
    const api = createStudyGroupApi('/api/study-group/');
    const id = 'g1';
    await Promise.all([
      api.getMe(), api.updateMe({ displayName: 'A' }), api.deleteMe(), api.acceptPolicies({ acceptTerms: true, acceptPrivacy: true }), api.myGroups(), api.logout(),
      api.getSignup(), api.completeSignup({ acceptTerms: true, acceptPrivacy: true, confirmAge: true }), api.cancelSignup(),
      api.listGroups(), api.listGroups('cur'), api.createGroup({ ...group, acceptContentPolicy: true }), api.previewGroup(id), api.joinGroup(id, { code: 'c' }),
      api.getGroup(id), api.deleteGroup(id, { confirmName: 'x' }), api.listMembers(id), api.removeMember(id, 'u 1'), api.leaveGroup(id), api.getSettings(id),
      api.updateSettings(id, group), api.rotateAccessCode(id), api.listRequests(id), api.approveRequest(id, 1), api.rejectRequest(id, 1), api.deleteRequestMessage(id, 1, 'reason text'),
      api.listMaterials(id), api.createMaterial(id, { type: 'video', title: 't' }), api.updateMaterial(id, 2, { status: 'open' }), api.approveMaterial(id, 2),
      api.deleteMaterial(id, 2), api.deleteMaterial(id, 2, 'because reasons'), api.listDeletedMaterials(id), api.restoreMaterial(id, 2), api.getCurrentRound(id),
      api.createRound(id, { mode: 'vote' }), api.castVote(id, 3, { materialId: 2 }), api.closeRound(id, 3), api.cancelRound(id, 3), api.adminGroups(), api.adminGroups('c'), api.moderationLog(), api.moderationLog('9')
    ]);
    expect(api.exportUrl()).toBe('/api/study-group/me/export');
    expect(calls(fetchMock as never)).toEqual([
      'GET /me', 'PATCH /me', 'DELETE /me', 'POST /me/consents', 'GET /me/groups', 'POST /auth/logout',
      'GET /auth/signup', 'POST /auth/signup', 'POST /auth/signup/cancel',
      'GET /groups', 'GET /groups?cursor=cur', 'POST /groups', 'GET /groups/g1/preview', 'POST /groups/g1/join',
      'GET /groups/g1', 'DELETE /groups/g1', 'GET /groups/g1/members', 'DELETE /groups/g1/members/u%201', 'POST /groups/g1/leave', 'GET /groups/g1/settings',
      'PUT /groups/g1/settings', 'POST /groups/g1/access-code', 'GET /groups/g1/requests', 'POST /groups/g1/requests/1/approve', 'POST /groups/g1/requests/1/reject', 'DELETE /groups/g1/requests/1/message',
      'GET /groups/g1/materials?status=all', 'POST /groups/g1/materials', 'PATCH /groups/g1/materials/2', 'POST /groups/g1/materials/2/approve',
      'DELETE /groups/g1/materials/2', 'DELETE /groups/g1/materials/2', 'GET /groups/g1/materials/deleted', 'POST /groups/g1/materials/2/restore', 'GET /groups/g1/rounds/current',
      'POST /groups/g1/rounds', 'POST /groups/g1/rounds/3/votes', 'POST /groups/g1/rounds/3/close', 'POST /groups/g1/rounds/3/cancel', 'GET /admin/groups', 'GET /admin/groups?cursor=c', 'GET /admin/moderation-log', 'GET /admin/moderation-log?cursor=9'
    ]);
    const [, get] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(get).toEqual({ method: 'GET', cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' }, body: undefined });
    const [, post] = fetchMock.mock.calls[5] as unknown as [string, RequestInit];
    expect(post).toMatchObject({ method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}' });
    expect(bodyOf(fetchMock as never, 'DELETE /me')).toEqual({ confirm: true });
    expect(bodyOf(fetchMock as never, 'DELETE /groups/g1/requests/1/message')).toEqual({ reason: 'reason text' });
    expect(createStudyGroupApi()).toBeTruthy();
  });

  it('turns failures into typed errors', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(apiError(403, 'consent_required'))
      .mockResolvedValueOnce(new Response('oops', { status: 502 })));
    const api = createStudyGroupApi();
    await expect(api.logout()).resolves.toBeUndefined();
    const consent = await api.getMe().catch((error: unknown) => error);
    expect(isConsentRequired(consent)).toBe(true);
    expect(errorMessage(consent)).toBe('Accept the updated Terms and Privacy Policy to make changes.');
    const gateway = await api.getMe().catch((error: unknown) => error);
    expect(gateway).toEqual(new StudyGroupApiError(502, 'Request failed with status 502'));
    expect(errorMessage(gateway)).toBe('Request failed with status 502');
    expect(errorMessage(new Error('x'))).toBe('Something went wrong. Please try again.');
    expect(isUnauthorized(new StudyGroupApiError(401, 'x'))).toBe(true);
    expect(hasStatus(new Error('x'), 401)).toBe(false);
    expect(isConsentRequired(new StudyGroupApiError(403, 'Forbidden'))).toBe(false);
  });

  it('builds sign-in and group links', () => {
    expect(signInHref('/study-groups/g/abc')).toBe('/api/study-group/auth/login?returnTo=%2Fstudy-groups%2Fg%2Fabc');
    expect(groupPath('abc')).toBe('/study-groups/g/abc');
    expect(groupPath('abc', '/settings')).toBe('/study-groups/g/abc/settings');
  });
});

describe('helpers', () => {
  it('formats board data', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('2026-11-10T12:00:00Z')).toBe('Nov 10');
    expect(linkDomain('https://www.example.com/a')).toBe('example.com');
    expect(linkDomain('not a url')).toBe('not a url');
    expect(typeLabel('podcast')).toBe('Podcast');
    expect(pluralize(1, 'vote')).toBe('1 vote');
    expect(pluralize(2, 'vote')).toBe('2 votes');
    expect(isEligible(material(1), votingRound)).toBe(true);
    expect(isEligible(material(1, { createdAt: '2026-12-01T00:00:00Z' }), votingRound)).toBe(false);
    expect(totalVotes([{ materialId: 1, votes: 2, voters: [] }, { materialId: 2, votes: 1, voters: [] }])).toBe(3);
    expect(formatTime('20:00')).toBe('8 PM');
    expect(formatTime('09:05')).toBe('9:05 AM');
    expect(formatTime('00:30')).toBe('12:30 AM');
    expect(formatMeeting(group)).toBe('Monday 8 PM - 9 PM (BRT)');
    expect(formatMeeting({ ...group, timezone: 'UTC' })).toBe('Monday 8 PM - 9 PM (UTC)');
  });

  it('explains how a round was decided', () => {
    expect(winnerNote({ ...closedRound, mode: 'draw' }, [])).toBe('Picked by random draw');
    expect(winnerNote(closedRound, [])).toBe('No votes, picked by random draw');
    expect(winnerNote(closedRound, [{ materialId: 1, votes: 2, voters: [] }, { materialId: 2, votes: 2, voters: [] }])).toBe('Tie broken by draw');
    expect(winnerNote(closedRound, [{ materialId: 1, votes: 2, voters: [] }, { materialId: 2, votes: 1, voters: [] }])).toBe('Chosen by vote · 2 of 3 votes');
    expect(winnerNote({ ...closedRound, winnerMaterialId: 9 }, [{ materialId: 1, votes: 1, voters: [] }])).toBe('Chosen by vote · 0 of 1 vote');
  });

  it('moves the caller’s vote optimistically', () => {
    const tally = [{ materialId: 1, votes: 2, voters: ['Ana', 'Olivia'] }, { materialId: 2, votes: 1, voters: ['Bo'] }];
    expect(applyVote(tally, 1, 2, 'Olivia')).toEqual([{ materialId: 1, votes: 1, voters: ['Ana'] }, { materialId: 2, votes: 2, voters: ['Bo', 'Olivia'] }]);
    expect(applyVote(tally, null, 3, 'Olivia')).toEqual([...tally, { materialId: 3, votes: 1, voters: ['Olivia'] }]);
    expect(applyVote([{ materialId: 1, votes: 1, voters: ['Ana'] }], 1, 1, 'Olivia')).toEqual([{ materialId: 1, votes: 2, voters: ['Ana', 'Olivia'] }]);
  });

  it('reads the group ID from the static shell URL', () => {
    expect(groupIdFromPath('/study-groups/g/abc123')).toBe('abc123');
    expect(groupIdFromPath('/study-groups/g/abc123/settings')).toBe('abc123');
    expect(groupIdFromPath('/study-groups/g/AB')).toBeNull();
    expect(groupIdFromPath('/study-groups/group')).toBeNull();
  });

  it('tolerates unavailable storage', () => {
    writeStorage('localStorage', 'k', 'v');
    expect(readStorage('localStorage', 'k')).toBe('v');
    writeStorage('localStorage', 'k', null);
    expect(readStorage('localStorage', 'k')).toBe('');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readStorage('localStorage', 'k')).toBe('');
    expect(() => writeStorage('localStorage', 'k', 'v')).not.toThrow();
  });

  it('navigates with full page loads', async () => {
    const original = await vi.importActual<typeof import('@/features/study-group/navigation')>('@/features/study-group/navigation');
    original.navigate('#moved');
    expect(window.location.hash).toBe('#moved');
    window.history.pushState({}, '', '/study-groups/my');
    expect(currentPath()).toBe('/study-groups/my');
    expect(navigate).toBeTypeOf('function');
  });

  it('loads the versioned program documents', () => {
    for (const locale of ['en', 'pt-BR'] as const) {
      for (const name of ['terms', 'privacy'] as const) {
        const document = getProgramDocument(locale, name);
        expect(document.version).toBe(POLICY_VERSIONS[name]);
        expect(document.content.length).toBeGreaterThan(500);
      }
    }
    expect(getProgramDocument('en', 'terms').content).toContain('<span id="content-policy"></span>');
    expect(getProgramDocument('pt-BR', 'privacy').content).toContain('<span id="cookies"></span>');
  });
});

function Probe() {
  const { user: current } = useSession();
  return <p>Probe: {current?.displayName ?? 'nobody'}</p>;
}

describe('session', () => {
  it('requires the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow('useSession must be used inside SessionProvider');
  });

  it('shows loading, error with retry, sign-in prompt and the signed-in content', async () => {
    let fail = true;
    stubApi({ 'GET /me': () => (fail ? apiError(500, 'down') : { user: null }) });
    window.history.pushState({}, '', '/study-groups/new');
    render(<SessionProvider><RequireUser>{(current) => <p>Hello {current.displayName}</p>}</RequireUser></SessionProvider>);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't reach the study groups service.");
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Sign in with Google' })).toHaveAttribute('href', signInHref('/study-groups/new'));
    cleanup();

    stubApi({ 'GET /me': { user } });
    render(<SessionProvider><RequireUser>{(current) => <p>Hello {current.displayName}</p>}</RequireUser><Probe /></SessionProvider>);
    expect(await screen.findByText('Hello Olivia')).toBeInTheDocument();
    expect(screen.getByText('Probe: Olivia')).toBeInTheDocument();
  });

  it('clears the v0.3 access code and name from the browser', async () => {
    window.localStorage.setItem('study-group:code', 'old-code');
    window.localStorage.setItem('study-group:name', 'Old name');
    window.localStorage.setItem('other', 'kept');
    stubApi({ 'GET /me': { user: null } });
    render(<SessionProvider><Probe /></SessionProvider>);
    await waitFor(() => expect(window.localStorage.getItem('study-group:code')).toBeNull());
    expect(window.localStorage.getItem('study-group:name')).toBeNull();
    expect(window.localStorage.getItem('other')).toBe('kept');
  });

  it('renders a custom sign-in prompt', () => {
    render(<SignInPrompt title="Join us" text="Text" returnTo="/study-groups" />);
    expect(screen.getByRole('heading', { name: 'Join us' })).toBeInTheDocument();
  });
});

describe('account navigation and consent', () => {
  it('shows sign-in for visitors and account links for users, and signs out', async () => {
    const fetchMock = stubApi({ 'GET /me': { user: null } });
    window.history.pushState({}, '', '/study-groups/g/abc123');
    const { unmount } = render(<SessionProvider><AccountNav /></SessionProvider>);
    expect(screen.queryByRole('link', { name: 'Sign in with Google' })).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Sign in with Google' })).toHaveAttribute('href', signInHref('/study-groups/g/abc123'));
    unmount();

    stubApi({ 'GET /me': { user: admin }, 'POST /auth/logout': null });
    render(<SessionProvider><AccountNav /></SessionProvider>);
    expect(await screen.findByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/study-groups/admin');
    expect(screen.getByRole('link', { name: 'My groups' })).toHaveAttribute('href', '/study-groups/my');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('/study-groups'));
    expect(fetchMock).toBeDefined();
  });

  it('hides the admin link from regular users', async () => {
    stubApi({ 'GET /me': { user } });
    render(<SessionProvider><AccountNav /></SessionProvider>);
    expect(await screen.findByRole('link', { name: 'Account' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('asks for re-acceptance until both boxes are checked', async () => {
    let attempts = 0;
    const fetchMock = stubApi({
      'GET /me': { user: { ...user, needsConsent: true } },
      'POST /me/consents': () => (attempts++ === 0 ? apiError(500, 'Try later') : { user })
    });
    render(<SessionProvider><ConsentBanner /></SessionProvider>);
    expect(await screen.findByRole('heading', { name: 'We updated our Terms and Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute('href', '/study-groups/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByText(new RegExp(`version ${POLICY_VERSIONS.terms}`))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`version ${POLICY_VERSIONS.privacy}`))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Accept and continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Check both boxes to continue.');
    const [terms, privacy] = screen.getAllByRole('checkbox');
    expect(terms).not.toBeChecked();
    fireEvent.click(terms);
    fireEvent.click(privacy);
    fireEvent.click(screen.getByRole('button', { name: 'Accept and continue' }));
    expect(await screen.findByText('Try later')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Accept and continue' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: /We updated/ })).not.toBeInTheDocument());
    expect(bodyOf(fetchMock, 'POST /me/consents')).toEqual({ acceptTerms: true, acceptPrivacy: true });
  });

  it('renders nothing when consent is current', async () => {
    stubApi({ 'GET /me': { user } });
    const { container } = render(<SessionProvider><ConsentBanner /></SessionProvider>);
    await act(async () => undefined);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('cookie notice', () => {
  it('is informational, localized and remembers the dismissal (Q17)', () => {
    const { unmount } = render(<CookieNotice locale="pt-BR" />);
    expect(screen.getByRole('complementary', { name: 'Política de Privacidade' })).toHaveTextContent('Sem analytics nem anúncios.');
    expect(screen.getByRole('link', { name: 'Saiba mais na Política de Privacidade' })).toHaveAttribute('href', '/pt-br/privacy#cookies');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(cookieNoticeStorageKey)).toBe('1');
    unmount();

    render(<CookieNotice locale="en" />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
    window.localStorage.clear();
    cleanup();
    render(<CookieNotice locale="en" />);
    expect(screen.getByRole('link', { name: 'Learn more in the Privacy Policy' })).toHaveAttribute('href', '/privacy#cookies');
  });
});

