import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AccountPage, AdminPage, GroupBoardPage, GroupSettingsPage, MyGroupsPage, NewGroupPage, WelcomePage } from '@/site-pages/study-group-pages';
import { StudyGroupsLandingPage } from '@/site-pages/study-groups-landing-page';
import { PrivacyPage } from '@/site-pages/privacy-page';
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
  it.each([['en', 'Free English study groups for developers', '/study-groups/terms', '/privacy', 'https://fbrissi.dev/study-groups'], ['pt-BR', 'Grupos de estudo de inglês para desenvolvedores', '/pt-br/study-groups/terms', '/pt-br/privacy', 'https://fbrissi.dev/pt-br/grupos-de-estudo-de-ingles']] as const)('renders the %s landing page', async (locale, title, termsPath, privacyPath, url) => {
    stubApi({ 'GET /me': { user: null }, 'GET /groups': { groups: [], nextCursor: null } });
    const { container } = render(<StudyGroupsLandingPage locale={locale} />);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(container.querySelector('[data-page="studyGroups"]')).toHaveAttribute('data-path', '/study-groups');
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(8);
    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(links).toEqual(expect.arrayContaining([termsPath, `${termsPath}#content-policy`, privacyPath]));
    expect(screen.queryByText(/funcionam em inglês/)).toSatisfy((note: HTMLElement | null) => (locale === 'pt-BR') === (note !== null));
    // Indexable copy: the H2 outline, a 7-question FAQ (H3s) and the no-JS text of the client-rendered list.
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7);
    expect(container.querySelector('noscript')).not.toBeNull();
    expect(container.querySelector('noscript')!.textContent).not.toMatch(/start your own|monte o seu/);
    expect(screen.getByRole('heading', { level: 3, name: locale === 'pt-BR' ? 'Quais dados são guardados?' : 'What data do you keep?' })).toBeInTheDocument();
    expect(screen.getByText(locale === 'pt-BR' ? /hash do token da sua sessão.*log de moderação/ : /hash of your session token.*moderation log/)).toBeInTheDocument();
    expect(await screen.findByText(locale === 'pt-BR' ? 'Você entra com a sua conta Google' : "You'll sign in with Google")).toBeInTheDocument();
    const [graph] = Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map((script) => JSON.parse(script.textContent!)['@graph']);
    expect(graph.map((node: { '@type': string }) => node['@type'])).toEqual(['WebPage', 'BreadcrumbList']);
    expect(graph[0]).toMatchObject({ url, inLanguage: locale, author: { name: 'Filipe Bojikian Rissi' } });
    expect(graph[1].itemListElement[1]).toMatchObject({ item: url });
    expect(JSON.stringify(graph)).not.toMatch(/FAQPage|ItemList"|Course|Event/);
    expect(await screen.findByRole('complementary')).toBeInTheDocument();
  });

  it.each([['en', 'Terms of Use'], ['pt-BR', 'Termos de Uso']] as const)('renders the %s terms page', (locale, title) => {
    const { container } = render(<StudyGroupsPolicyPage locale={locale} document="terms" />);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(/2026-11-16/)).toBeInTheDocument();
    expect(container.querySelector('[data-path]')).toHaveAttribute('data-path', '/study-groups/terms');
    expect(container.querySelector('#content-policy')).not.toBeNull();
  });

  it.each([['en', 'Privacy Policy', /Contact form/], ['pt-BR', 'Política de Privacidade', /Formulário de contato/]] as const)('renders the site-wide %s privacy policy with the contact form and cookie sections (D-7)', (locale, title, contactSection) => {
    const { container } = render(<PrivacyPage locale={locale} />);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(/2026-11-21/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: contactSection })).toBeInTheDocument();
    expect(container.querySelector('[data-page="privacy"]')).toHaveAttribute('data-path', '/privacy');
    expect(container.querySelector('#cookies')).not.toBeNull();
    expect(container.querySelector('script[type="application/ld+json"]')).toHaveTextContent('BreadcrumbList');
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
