import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('React', React);
afterEach(cleanup);

vi.mock('@/components/site-shell', () => ({
  SiteShell: ({ children, locale, activePage }: { children: React.ReactNode; locale: string; activePage: string }) => <main data-locale={locale} data-page={activePage}>{children}</main>,
}));
vi.mock('@/components/contact-form', () => ({ ContactForm: ({ locale }: { locale: string }) => <p>Contact form ({locale})</p> }));

import { AboutPage, ArticlePage, ArticlesPage, ContactPage, HomePage, ProjectPage, ProjectsPage, WorkDetailPage, WorksPage } from '@/components/site-pages';
import { getArticles } from '@/lib/articles';
import { getProjects } from '@/lib/projects';
import { getWorks } from '@/lib/works';

describe('composed site pages', () => {
  it('renders home content and omits optional collections when they are empty', () => {
    render(<HomePage locale="en" />);
    expect(screen.getByRole('main')).toHaveAttribute('data-page', 'home');
    expect(screen.getByRole('heading', { level: 2, name: /featured projects/i })).toBeInTheDocument();
  });

  it.each([
    ['projects', ProjectsPage, getProjects('en')[0].title],
    ['works', WorksPage, getWorks('en')[0].company],
    ['articles', ArticlesPage, getArticles('en')[0].title],
  ] as const)('renders the %s index with its content cards', (_name, Page, cardTitle) => {
    render(<Page locale="en" />);
    expect(screen.getAllByText(cardTitle).length).toBeGreaterThan(0);
  });

  it('renders detail pages, structured data, and localized return links', () => {
    const project = getProjects('pt-BR')[0];
    const work = getWorks('en')[0];
    const article = getArticles('en')[0];
    const { container } = render(<><ProjectPage locale="pt-BR" slug={project.slug} /><WorkDetailPage locale="en" slug={work.slug} /><ArticlePage locale="en" slug={article.slug} /></>);

    expect(screen.getByRole('link', { name: /voltar aos projetos/i })).toHaveAttribute('href', '/pt-br/projects');
    expect(screen.getAllByText(work.company).length).toBeGreaterThan(0);
    expect(screen.getAllByText(article.title).length).toBeGreaterThan(0);
    expect(container.querySelector('script[type="application/ld+json"]')).toHaveTextContent(article.title);
  });

  it('returns no content for unknown detail slugs', () => {
    const { container } = render(<><ProjectPage locale="en" slug="missing" /><WorkDetailPage locale="en" slug="missing" /><ArticlePage locale="en" slug="missing" /></>);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders contact and about page content in Portuguese', () => {
    render(<><ContactPage locale="pt-BR" /><AboutPage locale="pt-BR" /></>);
    expect(screen.getByText('Contact form (pt-BR)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /sobre/i })).toBeInTheDocument();
  });
});
