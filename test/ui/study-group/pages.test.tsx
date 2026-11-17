import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AccountPage, AdminPage, GroupBoardPage, GroupSettingsPage, MyGroupsPage, NewGroupPage, WelcomePage } from '@/site-pages/study-group-pages';
import { StudyGroupsLandingPage } from '@/site-pages/study-groups-landing-page';
import { StudyGroupsPolicyPage } from '@/site-pages/study-groups-policy-page';

import { stubApi, user } from './fake-api';

vi.stubGlobal('React', React);

vi.mock('@/components/layout/site-shell', () => ({
  SiteShell: ({ children, locale, activePage, pathname }: { children: React.ReactNode; locale: string; activePage: string; pathname: string }) => <div data-locale={locale} data-page={activePage} data-path={pathname}>{children}</div>
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('React', React);
});

describe('program pages', () => {
  it.each([['en', 'English study groups for developers', '/study-groups/terms'], ['pt-BR', 'Grupos de estudo de inglês para desenvolvedores', '/pt-br/study-groups/terms']] as const)('renders the %s landing page', async (locale, title, termsPath) => {
    stubApi({ 'GET /me': { user: null }, 'GET /groups': { groups: [], nextCursor: null } });
    const { container } = render(<StudyGroupsLandingPage locale={locale} />);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(container.querySelector('[data-page="studyGroups"]')).toHaveAttribute('data-path', '/study-groups');
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(8);
    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(links).toEqual(expect.arrayContaining([termsPath, `${termsPath}#content-policy`, termsPath.replace('terms', 'privacy')]));
    expect(await screen.findByRole('complementary')).toBeInTheDocument();
  });

  it.each([['en', 'terms', 'Terms of Use'], ['en', 'privacy', 'Privacy Policy'], ['pt-BR', 'terms', 'Termos de Uso'], ['pt-BR', 'privacy', 'Política de Privacidade']] as const)('renders the %s %s page', (locale, document, title) => {
    const { container } = render(<StudyGroupsPolicyPage locale={locale} document={document} />);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(/2026-11-16/)).toBeInTheDocument();
    expect(container.querySelector('[data-path]')).toHaveAttribute('data-path', `/study-groups/${document}`);
    expect(container.querySelector(document === 'terms' ? '#content-policy' : '#cookies')).not.toBeNull();
  });
});

describe('app pages', () => {
  it.each([
    ['board', GroupBoardPage], ['settings', GroupSettingsPage], ['new group', NewGroupPage], ['my groups', MyGroupsPage],
    ['account', AccountPage], ['welcome', WelcomePage], ['admin', AdminPage]
  ] as const)('renders the %s page inside the English study group shell', async (_name, Page) => {
    stubApi({ 'GET /me': { user }, 'GET /auth/signup': { displayName: 'Olivia' }, 'GET /me/groups': { groups: [], pending: [], notices: [] } });
    window.history.pushState({}, '', '/study-groups/my');
    const { container } = render(<Page apiUrl="/api/study-group" />);
    expect(container.querySelector('[lang="en"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'fbrissi.dev home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('navigation', { name: 'Policies' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Account' })).toBeInTheDocument();
  });
});
