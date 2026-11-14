import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DeletedMaterial, GroupSettings } from '@/workers/study-group/contract';
import { createStudyGroupAdminApi, StudyGroupApiError } from '@/features/study-group/api';
import { AdminSettings } from '@/features/study-group/admin-settings';
import { StudyGroupSettingsPage } from '@/site-pages/study-group-settings-page';

const api = vi.hoisted(() => ({
  login: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  listDeletedMaterials: vi.fn(),
  restoreMaterial: vi.fn()
}));

vi.mock('@/features/study-group/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/study-group/api')>()),
  createStudyGroupAdminApi: vi.fn(() => api)
}));

vi.stubGlobal('React', React);

const settings: GroupSettings = {
  name: 'DevTalk',
  description: 'Practice English.',
  rules: ["Don't speak in Portuguese", 'Share your ideas'],
  meetingDay: 'Monday',
  meetingStart: '20:00',
  meetingEnd: '21:00',
  timezone: 'America/Sao_Paulo',
  meetingUrl: null,
  accessCode: null
};

const deleted: DeletedMaterial[] = [
  { id: 4, suggestedBy: 'Ana', type: 'video', title: 'Old talk', url: null, notes: null, status: 'open', createdAt: '2026-11-01T12:00:00Z', discussedAt: null, deletedAt: '2026-11-05T12:00:00Z' },
  { id: 5, suggestedBy: 'Bruno', type: 'book', title: 'Old book', url: null, notes: null, status: 'open', createdAt: '2026-11-01T12:00:00Z', discussedAt: null, deletedAt: '2026-11-06T12:00:00Z' }
];

const unauthorized = () => new StudyGroupApiError(401, 'unauthorized');

function loggedIn(overrides: Partial<GroupSettings> = {}, materials = deleted) {
  window.sessionStorage.setItem('study-group:admin-token', 'token-1');
  api.getSettings.mockResolvedValue({ settings: { ...settings, ...overrides } });
  api.listDeletedMaterials.mockResolvedValue({ materials });
}

beforeEach(() => {
  window.sessionStorage.clear();
  Object.values(api).forEach((fn) => fn.mockReset());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('study group settings login', () => {
  it('renders the page with the default API URL and validates the login form', () => {
    render(<StudyGroupSettingsPage />);
    expect(createStudyGroupAdminApi).toHaveBeenLastCalledWith('/api/study-group', expect.any(Function));
    expect(screen.getByRole('heading', { level: 1, name: 'Settings login' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email and your password.');
    expect(api.login).not.toHaveBeenCalled();
  });

  it('logs in, keeps the token for the session and sends it with requests', async () => {
    api.login.mockResolvedValueOnce({ token: 'token-2', expiresAt: '2026-11-14T00:00:00Z' });
    api.getSettings.mockResolvedValue({ settings });
    api.listDeletedMaterials.mockResolvedValue({ materials: [] });
    render(<AdminSettings apiUrl="/api" />);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByRole('button', { name: 'Logging in…' })).toBeDisabled();

    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(await screen.findByText('No deleted materials.')).toBeInTheDocument();
    expect(api.login).toHaveBeenCalledWith({ email: 'admin@example.test', password: 'secret' });
    expect(window.sessionStorage.getItem('study-group:admin-token')).toBe('token-2');
    expect(vi.mocked(createStudyGroupAdminApi).mock.lastCall?.[1]()).toBe('token-2');
  });

  it('shows wrong credentials and other login errors', async () => {
    render(<AdminSettings apiUrl="/api" />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });

    api.login.mockRejectedValueOnce(unauthorized());
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Email or password is incorrect.')).toBeInTheDocument();

    api.login.mockRejectedValueOnce(new StudyGroupApiError(429, 'Too many attempts'));
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Too many attempts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled();
  });

  it('returns to the login screen when the session expires or on logout', async () => {
    loggedIn();
    api.getSettings.mockRejectedValueOnce(unauthorized());
    render(<AdminSettings apiUrl="/api" />);
    expect(await screen.findByText('Your session expired. Please log in again.')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('study-group:admin-token')).toBeNull();
    cleanup();

    loggedIn();
    render(<AdminSettings apiUrl="/api" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Settings login' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('study-group:admin-token')).toBeNull();
  });

  it('shows a load error with retry', async () => {
    loggedIn();
    api.getSettings.mockRejectedValueOnce(new Error('offline'));
    render(<AdminSettings apiUrl="/api" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading settings…');
    expect(await screen.findByText("Couldn't load the settings.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Group name')).toHaveValue('DevTalk');
  });
});

describe('study group settings form', () => {
  it('pre-fills the settings and saves them', async () => {
    loggedIn({ meetingUrl: 'https://meet.example.com/x', accessCode: 'abcdef' });
    render(<AdminSettings apiUrl="/api" />);
    expect(await screen.findByLabelText('Group name')).toHaveValue('DevTalk');
    expect(screen.getByLabelText('Rules')).toHaveValue("Don't speak in Portuguese\nShare your ideas");
    expect(screen.getByLabelText('Meeting link (optional)')).toHaveValue('https://meet.example.com/x');
    expect(screen.getByLabelText('Access code')).toHaveValue('abcdef');

    fireEvent.change(screen.getByLabelText('Rules'), { target: { value: ' Rule one \n\n Rule two ' } });
    fireEvent.change(screen.getByLabelText('Meeting link (optional)'), { target: { value: '  ' } });
    let resolve: (value: unknown) => void = () => undefined;
    api.updateSettings.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(api.updateSettings).toHaveBeenCalledWith({ ...settings, rules: ['Rule one', 'Rule two'], meetingUrl: null, accessCode: 'abcdef' });

    await act(async () => resolve({ settings: { ...settings, rules: ['Rule one', 'Rule two'], accessCode: 'abcdef' } }));
    expect(screen.getByText('Settings saved.')).toBeInTheDocument();
    expect(screen.getByLabelText('Rules')).toHaveValue('Rule one\nRule two');
  });

  it('validates fields before saving', async () => {
    loggedIn();
    render(<AdminSettings apiUrl="/api" />);
    await screen.findByLabelText('Group name');
    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: ' ' } });
    fireEvent.change(screen.getByLabelText('Starts at'), { target: { value: '25:00' } });
    fireEvent.change(screen.getByLabelText('Meeting link (optional)'), { target: { value: 'meet.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(screen.getByText('Please fix the highlighted fields.')).toBeInTheDocument();
    expect(screen.getByText('Enter a group name (up to 80 characters).')).toBeInTheDocument();
    expect(screen.getByText('Use the HH:MM format.')).toBeInTheDocument();
    expect(screen.getByText('Enter a full link starting with https://, or leave it empty.')).toBeInTheDocument();
    expect(screen.getByText('Use 6 to 100 characters.')).toBeInTheDocument();
    expect(screen.getByLabelText('Group name')).toHaveAttribute('aria-describedby', 'settings-name-error');
    expect(api.updateSettings).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'DevTalk' } });
    expect(screen.queryByText('Enter a group name (up to 80 characters).')).not.toBeInTheDocument();
  });

  it('shows save errors and logs out when the session expired', async () => {
    loggedIn({ accessCode: 'abcdef' });
    render(<AdminSettings apiUrl="/api" />);
    await screen.findByLabelText('Group name');

    api.updateSettings.mockRejectedValueOnce(new StudyGroupApiError(400, 'invalid_settings'));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText('invalid_settings')).toBeInTheDocument();

    api.updateSettings.mockRejectedValueOnce(unauthorized());
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText('Your session expired. Please log in again.')).toBeInTheDocument();
  });

  it('generates and copies the access code', async () => {
    loggedIn();
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(((array: Uint32Array) => array.fill(0)) as unknown as typeof crypto.getRandomValues);
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<AdminSettings apiUrl="/api" />);
    await screen.findByLabelText('Group name');

    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(screen.getByLabelText('Access code')).toHaveValue('aaaaaaaaaa');

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByText('Copied to the clipboard.')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith('aaaaaaaaaa');

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByText("Couldn't copy. Select the code and copy it manually.")).toBeInTheDocument();
  });
});

describe('deleted materials', () => {
  it('restores deleted materials and reports errors', async () => {
    loggedIn();
    render(<AdminSettings apiUrl="/api" />);
    const section = await screen.findByRole('region', { name: 'Deleted materials' });
    expect(within(section).getByText('Video · by Ana · deleted Nov 5')).toBeInTheDocument();

    api.restoreMaterial.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(within(section).getByRole('button', { name: 'Restore “Old talk”' }));
    expect(await within(section).findByText('Something went wrong. Please try again.')).toBeInTheDocument();

    api.restoreMaterial.mockResolvedValueOnce({ material: deleted[0] });
    fireEvent.click(within(section).getByRole('button', { name: 'Restore “Old talk”' }));
    expect(await within(section).findByText('Restored “Old talk”.')).toBeInTheDocument();
    expect(within(section).queryByText('Old talk')).not.toBeInTheDocument();
    expect(api.restoreMaterial).toHaveBeenLastCalledWith(4);
  });
});
