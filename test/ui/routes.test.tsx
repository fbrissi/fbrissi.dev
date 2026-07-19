import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('React', React);
vi.mock('@/pages/home-page', () => ({ HomePage: ({ locale }: { locale: string }) => <div>home:{locale}</div> }));
vi.mock('@/pages/about-page', () => ({ AboutPage: ({ locale }: { locale: string }) => <div>about:{locale}</div> }));
vi.mock('@/pages/articles-page', () => ({ ArticlesPage: ({ locale }: { locale: string }) => <div>articles:{locale}</div> }));
vi.mock('@/pages/article-page', () => ({ ArticlePage: ({ locale, slug }: { locale: string; slug: string }) => <div>article:{locale}:{slug}</div> }));
vi.mock('@/pages/contact-page', () => ({ ContactPage: ({ locale }: { locale: string }) => <div>contact:{locale}</div> }));
vi.mock('@/pages/contributions-page', () => ({ ContributionsPage: ({ locale }: { locale: string }) => <div>contributions:{locale}</div> }));
vi.mock('@/pages/contribution-page', () => ({ ContributionPage: ({ locale, slug }: { locale: string; slug: string }) => <div>contribution:{locale}:{slug}</div> }));
vi.mock('@/pages/projects-page', () => ({ ProjectsPage: ({ locale }: { locale: string }) => <div>projects:{locale}</div> }));
vi.mock('@/pages/project-page', () => ({ ProjectPage: ({ locale, slug }: { locale: string; slug: string }) => <div>project:{locale}:{slug}</div> }));
vi.mock('@/pages/works-page', () => ({ WorksPage: ({ locale }: { locale: string }) => <div>works:{locale}</div> }));
vi.mock('@/pages/work-page', () => ({ WorkPage: ({ locale, slug }: { locale: string; slug: string }) => <div>work:{locale}:{slug}</div> }));
vi.mock('@/components/layout/site-shell', () => ({ SiteShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));

import App from '@/app/App';
import { appRoutes } from '@/app/router';

afterEach(cleanup);

function renderPath(pathname: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [pathname] });
  return render(<RouterProvider router={router} />);
}

describe('application routes', () => {
  it.each([
    ['/', 'home:en'],
    ['/about', 'about:en'],
    ['/articles', 'articles:en'],
    ['/contact', 'contact:en'],
    ['/open-source', 'contributions:en'],
    ['/projects', 'projects:en'],
    ['/works', 'works:en'],
    ['/pt-br', 'home:pt-BR'],
    ['/pt-br/about/', 'about:pt-BR']
  ])('renders %s', (pathname, content) => {
    renderPath(pathname);
    expect(screen.getByText(content)).toBeInTheDocument();
  });

  it.each([
    ['/articles/registry-lookup-with-digital-certificates', 'article:en:registry-lookup-with-digital-certificates'],
    ['/open-source/keycloak', 'contribution:en:keycloak'],
    ['/projects/fbrissi-dev', 'project:en:fbrissi-dev'],
    ['/works/mega-bilheteria', 'work:en:mega-bilheteria'],
    ['/pt-br/articles/consulta-de-cadastros-com-certificacao-digital', 'article:pt-BR:consulta-de-cadastros-com-certificacao-digital'],
    ['/pt-br/open-source/keycloak', 'contribution:pt-BR:keycloak'],
    ['/pt-br/projects/fbrissi-dev', 'project:pt-BR:fbrissi-dev'],
    ['/pt-br/works/mega-bilheteria', 'work:pt-BR:mega-bilheteria']
  ])('renders detail route %s', (pathname, content) => {
    renderPath(pathname);
    expect(screen.getByText(content)).toBeInTheDocument();
  });

  it('renders the browser router provider', () => {
    render(<App />);
    expect(screen.getByText('home:en')).toBeInTheDocument();
  });

  it('updates document metadata', async () => {
    renderPath('/projects');
    await waitFor(() => expect(document.title).toContain('Projects'));
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://fbrissi.dev/projects');
  });

  it('uses the localized profile summary for home SEO metadata', async () => {
    renderPath('/');
    await waitFor(() => expect(document.head.querySelector('meta[name="description"]')).toHaveAttribute('content', expect.stringContaining('15+ years')));
  });

  it.each([
    ['/missing', 'Back home', '/'],
    ['/articles/missing', 'Back home', '/'],
    ['/open-source/missing', 'Back home', '/'],
    ['/projects/missing', 'Back home', '/'],
    ['/works/missing', 'Back home', '/'],
    ['/pt-br/missing', 'Voltar para o início', '/pt-br']
  ])('renders localized not-found route %s', (pathname, label, href) => {
    renderPath(pathname);
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
  });
});
