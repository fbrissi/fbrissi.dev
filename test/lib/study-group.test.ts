import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GroupInfo, Material, Round } from '@/workers/study-group/contract';
import { createStudyGroupAdminApi, createStudyGroupApi, errorMessage, isUnauthorized, StudyGroupApiError } from '@/features/study-group/api';
import { applyVote, findVote, formatDate, formatMeeting, formatTime, generateAccessCode, isEligible, linkDomain, readStorage, readStoredName, storeName, typeLabel, winnerNote, writeStorage } from '@/features/study-group/helpers';

function jsonResponse(status: number, body: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const round: Round = { id: 1, mode: 'vote', status: 'closed', createdAt: '2026-11-10T20:00:00Z', closedAt: '2026-11-10T21:00:00Z', winnerMaterialId: 2 };

describe('study group api client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends requests to the configured base URL with JSON bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { materials: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const api = createStudyGroupApi('https://api.example.com/api/study-group/', () => 'code-123');

    await expect(api.listMaterials()).resolves.toEqual({ materials: [] });
    await api.getGroup();
    await api.getCurrentRound();
    await api.createMaterial({ suggestedBy: 'Ana', type: 'video', title: 'Talk' });
    await api.updateMaterial(3, { status: 'discussed' });
    await api.createRound({ mode: 'vote' });
    await api.castVote(4, { materialId: 3, voterName: 'Ana' });
    await api.closeRound(4);
    await api.cancelRound(4);

    const calls = fetchMock.mock.calls.map(([url, init]) => `${init.method} ${url}`);
    expect(calls).toEqual([
      'GET https://api.example.com/api/study-group/materials?status=all',
      'GET https://api.example.com/api/study-group/group',
      'GET https://api.example.com/api/study-group/rounds/current',
      'POST https://api.example.com/api/study-group/materials',
      'PATCH https://api.example.com/api/study-group/materials/3',
      'POST https://api.example.com/api/study-group/rounds',
      'POST https://api.example.com/api/study-group/rounds/4/votes',
      'POST https://api.example.com/api/study-group/rounds/4/close',
      'POST https://api.example.com/api/study-group/rounds/4/cancel'
    ]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ body: undefined, headers: { Accept: 'application/json', 'X-Study-Group-Code': 'code-123' } });
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Content-Type');
    expect(fetchMock.mock.calls[3][1]).toMatchObject({ body: JSON.stringify({ suggestedBy: 'Ana', type: 'video', title: 'Talk' }), headers: { 'Content-Type': 'application/json' } });
  });

  it('resolves empty responses and raises typed errors', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(jsonResponse(409, { error: 'Already suggested' }))
      .mockResolvedValueOnce(jsonResponse(500, { message: 'nope' }))
      .mockResolvedValueOnce(new Response('not json', { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = createStudyGroupApi('/api/study-group', () => '');

    await expect(api.deleteMaterial(1)).resolves.toBeUndefined();
    await expect(api.createRound({ mode: 'draw' })).rejects.toMatchObject({ status: 409, message: 'Already suggested', name: 'StudyGroupApiError' });
    await expect(api.listMaterials()).rejects.toMatchObject({ status: 500, message: 'Request failed with status 500' });
    await expect(api.listMaterials()).rejects.toMatchObject({ status: 502 });
  });

  it('sends admin requests with a bearer token only when logged in', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(200, {}));
    vi.stubGlobal('fetch', fetchMock);
    let token = '';
    const api = createStudyGroupAdminApi('/api/study-group', () => token);

    await api.login({ email: 'admin@example.test', password: 'secret' });
    token = 'jwt';
    await api.getSettings();
    await api.updateSettings({ name: 'DevTalk', description: '', rules: [], meetingDay: 'Monday', meetingStart: '20:00', meetingEnd: '21:00', timezone: 'America/Sao_Paulo', meetingUrl: null, accessCode: 'abcdef' });
    await api.listDeletedMaterials();
    await api.restoreMaterial(5);

    expect(fetchMock.mock.calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      'POST /api/study-group/admin/login',
      'GET /api/study-group/admin/settings',
      'PUT /api/study-group/admin/settings',
      'GET /api/study-group/admin/materials/deleted',
      'POST /api/study-group/admin/materials/5/restore'
    ]);
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({ Authorization: 'Bearer jwt' });
  });

  it('maps errors to user-facing messages', () => {
    expect(isUnauthorized(new StudyGroupApiError(401, 'access_code_required'))).toBe(true);
    expect(isUnauthorized(new StudyGroupApiError(403, 'forbidden'))).toBe(false);
    expect(isUnauthorized(new Error('401'))).toBe(false);
    expect(errorMessage(new StudyGroupApiError(422, 'Round is closed'))).toBe('Round is closed');
    expect(errorMessage(new Error('network'))).toBe('Something went wrong. Please try again.');
  });
});

describe('study group helpers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('remembers the name and tolerates unavailable storage', () => {
    window.localStorage.clear();
    expect(readStoredName()).toBe('');
    storeName('Ana');
    expect(readStoredName()).toBe('Ana');

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(readStoredName()).toBe('');
    expect(() => storeName('Bruno')).not.toThrow();
  });

  it('reads, writes and removes values in session storage', () => {
    writeStorage('sessionStorage', 'key', 'value');
    expect(readStorage('sessionStorage', 'key')).toBe('value');
    writeStorage('sessionStorage', 'key', null);
    expect(readStorage('sessionStorage', 'key')).toBe('');
  });

  it('generates unambiguous access codes', () => {
    const code = generateAccessCode();
    expect(code).toMatch(/^[a-hjkmnp-z2-9]{10}$/);
    expect(generateAccessCode(6)).toHaveLength(6);
  });

  it('formats dates, domains, labels and meeting times', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('2026-11-13T12:00:00Z')).toBe('Nov 13');
    expect(linkDomain('https://www.youtube.com/watch?v=1')).toBe('youtube.com');
    expect(linkDomain('not a url')).toBe('not a url');
    expect(typeLabel('podcast')).toBe('Podcast');
    expect(formatTime('00:00')).toBe('12 AM');
    expect(formatTime('09:05')).toBe('9:05 AM');
    expect(formatTime('12:30')).toBe('12:30 PM');
    const group: GroupInfo = { name: 'DevTalk', description: '', rules: [], meetingDay: 'Monday', meetingStart: '20:00', meetingEnd: '21:00', timezone: 'America/Sao_Paulo', meetingUrl: null };
    expect(formatMeeting(group)).toBe('Monday 8 PM - 9 PM (BRT)');
    expect(formatMeeting({ ...group, timezone: 'Europe/Lisbon' })).toBe('Monday 8 PM - 9 PM (Europe/Lisbon)');
  });

  it('checks eligibility against the round start', () => {
    const material = { status: 'open', createdAt: '2026-11-10T19:00:00Z' } as Material;
    expect(isEligible(material, round)).toBe(true);
    expect(isEligible({ ...material, createdAt: '2026-11-10T20:30:00Z' }, round)).toBe(false);
    expect(isEligible({ ...material, status: 'discussed' }, round)).toBe(false);
  });

  it('moves votes between materials by normalized name', () => {
    const tally = [{ materialId: 1, votes: 2, voters: ['Ana', 'Bruno'] }];
    expect(findVote(tally, ' ana ')).toBe(1);
    expect(findVote(tally, '  ')).toBeUndefined();
    expect(findVote(tally, 'Carla')).toBeUndefined();
    expect(applyVote(tally, 2, 'ANA')).toEqual([{ materialId: 1, votes: 1, voters: ['Bruno'] }, { materialId: 2, votes: 1, voters: ['ANA'] }]);
    expect(applyVote(tally, 1, 'Carla')).toEqual([{ materialId: 1, votes: 3, voters: ['Ana', 'Bruno', 'Carla'] }]);
  });

  it('explains how the winner was chosen', () => {
    expect(winnerNote({ ...round, mode: 'draw' }, [])).toBe('Picked by random draw');
    expect(winnerNote(round, [])).toBe('No votes, picked by random draw');
    expect(winnerNote(round, [{ materialId: 2, votes: 2, voters: [] }, { materialId: 3, votes: 2, voters: [] }])).toBe('Tie broken by draw');
    expect(winnerNote(round, [{ materialId: 2, votes: 3, voters: [] }, { materialId: 3, votes: 1, voters: [] }])).toBe('Chosen by vote · 3 of 4 votes');
    expect(winnerNote(round, [{ materialId: 3, votes: 1, voters: [] }])).toBe('Chosen by vote · 0 of 1 vote');
  });
});
