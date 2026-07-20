import { cleanup, render as renderComponent, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('React', React);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function render(ui: React.ReactNode) {
  return renderComponent(ui, { wrapper: MemoryRouter });
}

vi.mock('@/components/layout/site-shell', () => ({
  SiteShell: ({ children, locale, activePage }: { children: React.ReactNode; locale: string; activePage: string }) => <main data-locale={locale} data-page={activePage}>{children}</main>,
}));
vi.mock('@/features/contact/contact-form', () => ({ ContactForm: ({ locale, turnstileSiteKey }: { locale: string; turnstileSiteKey: string }) => <p data-site-key={turnstileSiteKey}>Contact form ({locale})</p> }));

import { AboutPage } from '@/pages/about-page';
import { ArticlePage } from '@/pages/article-page';
import { ArticlesPage } from '@/pages/articles-page';
import { ContactPage } from '@/pages/contact-page';
import { ContributionPage } from '@/pages/contribution-page';
import { ContributionsPage } from '@/pages/contributions-page';
import { HomePage } from '@/pages/home-page';
import { ProjectPage } from '@/pages/project-page';
import { ProjectsPage } from '@/pages/projects-page';
import { WorkPage } from '@/pages/work-page';
import { WorksPage } from '@/pages/works-page';
import { getArticles } from '@/lib/articles';
import * as articles from '@/lib/articles';
import { getContributions } from '@/lib/contributions';
import { getProjects } from '@/lib/projects';
import { getWorks } from '@/lib/works';

describe('composed site pages', () => {
  it('renders home content and omits optional collections when they are empty', () => {
    render(<HomePage locale="en" />);
    expect(screen.getByRole('main')).toHaveAttribute('data-page', 'home');
    expect(screen.getByRole('img', { name: /engineering technologies and focus areas/i })).toHaveAttribute('src', expect.stringContaining('portifolio.png'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Staff Software Engineer');
    expect(screen.getByRole('heading', { name: /cloud-native engineering/i })).toBeInTheDocument();
    expect(screen.getByText(/PagBank \(PagSeguro\)/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /featured projects/i })).toBeInTheDocument();
  });

  it('localizes the portfolio banner description', () => {
    render(<HomePage locale="pt-BR" />);
    expect(screen.getByRole('img', { name: /tecnologias e áreas de atuação/i })).toBeInTheDocument();
  });

  it.each([
    ['projects', ProjectsPage, getProjects('en')[0].title],
    ['contributions', ContributionsPage, getContributions('en')[0].title],
    ['works', WorksPage, getWorks('en')[0].company],
    ['articles', ArticlesPage, getArticles('en')[0].title],
  ] as const)('renders the %s index with its content cards', (_name, Page, cardTitle) => {
    render(<Page locale="en" />);
    expect(screen.getAllByText(cardTitle).length).toBeGreaterThan(0);
  });

  it('renders detail pages, structured data, and localized return links', () => {
    const project = getProjects('pt-BR')[0];
    const contribution = getContributions('pt-BR')[0];
    const work = getWorks('en')[0];
    const article = getArticles('en')[0];
    const { container } = render(<><ProjectPage locale="pt-BR" slug={project.slug} /><ContributionPage locale="pt-BR" slug={contribution.slug} /><WorkPage locale="en" slug={work.slug} /><ArticlePage locale="en" slug={article.slug} /></>);

    expect(screen.getByRole('link', { name: /voltar aos projetos/i })).toHaveAttribute('href', '/pt-br/projects');
    expect(screen.getByRole('link', { name: /voltar para open source/i })).toHaveAttribute('href', '/pt-br/open-source');
    expect(screen.getAllByText(work.company).length).toBeGreaterThan(0);
    expect(screen.getAllByText(article.title).length).toBeGreaterThan(0);
    expect(Array.from(container.querySelectorAll('script[type="application/ld+json"]')).some((script) => script.textContent?.includes(article.title))).toBe(true);
  });

  it('returns no content for unknown detail slugs', () => {
    const { container } = render(<><ProjectPage locale="en" slug="missing" /><ContributionPage locale="en" slug="missing" /><WorkPage locale="en" slug="missing" /><ArticlePage locale="en" slug="missing" /></>);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders articles with optional image metadata omitted', () => {
    const article = getArticles('en')[0];
    vi.spyOn(articles, 'getArticle').mockReturnValue({ ...article, image: undefined, imageAlt: undefined });
    const { container, rerender } = render(<ArticlePage locale="en" slug={article.slug} />);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(container.querySelector('script[type="application/ld+json"]')).not.toHaveTextContent('"image"');

    vi.mocked(articles.getArticle).mockReturnValue({ ...article, image: '/article.svg', imageAlt: undefined });
    rerender(<ArticlePage locale="en" slug={article.slug} />);
    expect(container.querySelector('img[src="/article.svg"]')).toHaveAttribute('alt', '');
  });

  it('renders localized work labels and a configured Turnstile key', () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'site-key');
    const work = getWorks('pt-BR')[0];
    render(<><WorkPage locale="pt-BR" slug={work.slug} /><ContactPage locale="en" /></>);

    expect(screen.getByRole('link', { name: 'Site oficial' })).toBeInTheDocument();
    expect(screen.getByLabelText('Competências')).toBeInTheDocument();
    expect(screen.getByText('Contact form (en)')).toHaveAttribute('data-site-key', 'site-key');
  });

  it('renders the contact form without a Turnstile key', () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', undefined);
    render(<ContactPage locale="en" />);
    expect(screen.getByText('Contact form (en)')).toHaveAttribute('data-site-key', '');
  });

  it('renders contact and about page content in Portuguese', () => {
    render(<><ContactPage locale="pt-BR" /><AboutPage locale="pt-BR" /></>);
    expect(screen.getByText('Contact form (pt-BR)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'contact@fbrissi.dev' })).toHaveAttribute('href', 'mailto:contact@fbrissi.dev');
    expect(screen.getByRole('link', { name: '+55 (14) 99143-4121' })).toHaveAttribute('href', 'https://wa.me/5514991434121');
    expect(screen.getByRole('heading', { level: 1, name: /sobre/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /engenharia cloud-native/i })).toBeInTheDocument();
    expect(screen.getByText(/PagBank \(PagSeguro\)/i)).toBeInTheDocument();
  });
});
