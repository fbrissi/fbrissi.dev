import { cleanup, render as renderComponent, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('React', React);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function render(ui: React.ReactNode) {
  return renderComponent(ui);
}

vi.mock('@/components/layout/site-shell', () => ({
  SiteShell: ({ children, locale, activePage }: { children: React.ReactNode; locale: string; activePage: string }) => <main data-locale={locale} data-page={activePage}>{children}</main>,
}));
vi.mock('@/features/contact/contact-form', () => ({ ContactForm: ({ locale, turnstileSiteKey }: { locale: string; turnstileSiteKey: string }) => <p data-site-key={turnstileSiteKey}>Contact form ({locale})</p> }));

import { AboutPage } from '@/site-pages/about-page';
import { ArticlePage } from '@/site-pages/article-page';
import { ArticlesPage } from '@/site-pages/articles-page';
import { ContactPage } from '@/site-pages/contact-page';
import { ContributionPage } from '@/site-pages/contribution-page';
import { HomePage } from '@/site-pages/home-page';
import { ProjectPage } from '@/site-pages/project-page';
import { ProjectsPage } from '@/site-pages/projects-page';
import { WorkPage } from '@/site-pages/work-page';
import { WorksPage } from '@/site-pages/works-page';
import { getArticles } from '@/lib/articles';
import * as articles from '@/lib/articles';
import { getContributions } from '@/lib/contributions';
import { getProjects } from '@/lib/projects';
import { getWorks } from '@/lib/works';

describe('composed site pages', () => {
  it('renders a type-only hero with proof points, calls to action and no banner or duplicated bio (C-1, D-5)', () => {
    const { container } = render(<HomePage locale="en" />);
    expect(screen.getByRole('main')).toHaveAttribute('data-page', 'home');
    expect(container.querySelector('img[src*="portifolio"], img[src*="commit-history"]')).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('I build and run backend systems on AWS and Kubernetes.');
    expect(screen.getByText(/Based in Bauru, Brazil \(UTC-3\)\.$/)).toBeInTheDocument();
    expect(screen.queryByText(/remote/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /cloud-native engineering/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See my experience' })).toHaveAttribute('href', '/works');
    expect(screen.getByRole('link', { name: 'Email me' })).toHaveAttribute('href', 'mailto:contact@fbrissi.dev');
    expect(screen.getByRole('link', { name: 'Download resume (PDF)' })).toHaveAttribute('href', '/resume/filipe-bojikian-rissi-resume-en.pdf');
    expect(screen.getByRole('link', { name: 'Read more about me' })).toHaveAttribute('href', '/about');
    expect(screen.getByRole('link', { name: /Keycloak contributor/ })).toHaveAttribute('href', '/open-source/keycloak');
    expect(screen.queryByAltText(/commit history/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /featured projects/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all contributions' })).toHaveAttribute('href', '/projects#open-source');
  });

  it('links the study groups program from a home card in each locale (D-3)', () => {
    render(<HomePage locale="pt-BR" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Grupos de estudo de inglês para desenvolvedores' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /entre em um grupo de estudo de inglês grátis/i })).toHaveAttribute('href', '/pt-br/grupos-de-estudo-de-ingles');
    // The card sits right after the Nota Profile card.
    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(headings.indexOf('Grupos de estudo de inglês para desenvolvedores')).toBe(headings.indexOf('Nota Profile') + 1);
    expect(screen.getByRole('link', { name: 'Baixar currículo (PDF)' })).toHaveAttribute('href', '/resume/filipe-bojikian-rissi-curriculo-pt-br.pdf');
  });

  it('describes the person with absolute URLs, a stable @id and no WhatsApp or widget links (SD-1, D-6)', () => {
    const { container } = render(<HomePage locale="en" />);
    const graph = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!)['@graph'];
    expect(graph[0]).toMatchObject({ '@type': 'Person', '@id': 'https://fbrissi.dev/#person', url: 'https://fbrissi.dev/', jobTitle: 'Backend & Cloud Engineer', image: 'https://fbrissi.dev/images/avatar.png' });
    expect(graph[0].sameAs).toEqual(['https://github.com/fbrissi', 'https://www.linkedin.com/in/fbrissi/', 'https://gitlab.com/fbrissi']);
    expect(graph[1]).toMatchObject({ '@type': 'WebSite', url: 'https://fbrissi.dev/', publisher: { '@id': 'https://fbrissi.dev/#person' } });
  });

  it.each([
    ['en', /create your free account/i, /read about the project/i, '/projects/notaprofile', 'home-featured-en'],
    ['pt-BR', /crie sua conta grátis/i, /saiba mais sobre o projeto/i, '/pt-br/projects/notaprofile', 'home-featured-pt-br'],
  ] as const)('features Nota Profile on the %s home with a tracked sign-up link', (locale, cta, details, projectPath, utmContent) => {
    const { container } = render(<HomePage locale={locale} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Nota Profile' })).toBeInTheDocument();
    const signup = screen.getByRole('link', { name: cta });
    expect(signup).toHaveAttribute('href', `https://app.notaprofile.com.br/cadastro?utm_source=fbrissi.dev&utm_medium=referral&utm_campaign=portfolio&utm_content=${utmContent}`);
    expect(signup).toHaveAttribute('rel', 'noopener noreferrer');
    // The featured card replaces its card in the projects grid.
    expect(container.querySelectorAll('a[href$="/projects/notaprofile"]')).toHaveLength(1);
    expect(screen.getByRole('link', { name: details })).toHaveAttribute('href', projectPath);
  });

  it.each([
    ['projects', ProjectsPage, getProjects('en')[0].title],
    ['projects (open source section)', ProjectsPage, getContributions('en')[0].title],
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
    expect(screen.getByRole('link', { name: /voltar para open source/i })).toHaveAttribute('href', '/pt-br/projects#open-source');
    expect(screen.getAllByText(work.company).length).toBeGreaterThan(0);
    expect(screen.getAllByText(article.title).length).toBeGreaterThan(0);
    expect(Array.from(container.querySelectorAll('script[type="application/ld+json"]')).some((script) => script.textContent?.includes(article.title))).toBe(true);
    expect(Array.from(container.querySelectorAll('script[type="application/ld+json"]')).filter((script) => script.textContent?.includes('BreadcrumbList'))).toHaveLength(4);
  });

  it('marks up works as web pages about the person and articles with absolute URLs (SD-2, SD-3)', () => {
    const work = getWorks('en')[0];
    const article = getArticles('en')[0];
    const { container } = render(<><WorkPage locale="en" slug={work.slug} /><ArticlePage locale="en" slug={article.slug} /></>);
    const [workData, articleData] = Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map((script) => JSON.parse(script.textContent!)[0]);

    expect(workData).toMatchObject({ '@type': 'WebPage', about: { '@id': 'https://fbrissi.dev/#person' }, mentions: { '@type': 'Organization', name: work.company } });
    expect(articleData).toMatchObject({ '@type': 'BlogPosting', author: { '@id': 'https://fbrissi.dev/#person', name: 'Filipe Bojikian Rissi' }, inLanguage: 'en', image: 'https://fbrissi.dev/images/og/tcc-digital-certificates.png', mainEntityOfPage: `https://fbrissi.dev/articles/${article.slug}`, dateModified: article.date });
    expect(screen.getByText(`${work.dateRange} · ${work.employmentType}`)).toBeInTheDocument();
  });

  it.each([
    ['notaprofile', 'https://notaprofile.com.br/', '_blank', false],
    ['english-study-groups', '/study-groups', null, false],
    ['fbrissi-dev', 'https://github.com/fbrissi/fbrissi.dev', '_blank', true]
  ] as const)('opens the %s project link in the right tab and marks up source repositories', (slug, href, target, sourceCode) => {
    const { container } = render(<ProjectPage locale="en" slug={slug} />);
    const link = screen.getByRole('link', { name: /open project/i });
    expect(link.getAttribute('href')).toContain(href);
    expect(link.getAttribute('target')).toBe(target);
    expect(link.textContent?.includes('↗')).toBe(target !== null);
    expect(link.getAttribute('rel')).toBe(target ? 'noopener noreferrer' : null);
    expect(container.querySelector('script[type="application/ld+json"]')!.textContent!.includes('SoftwareSourceCode')).toBe(sourceCode);
    expect(screen.queryByText(/Bauru/)).not.toBeInTheDocument();
  });

  it('tags the Nota Profile links with the page locale and opens external body links in a new tab', () => {
    const { container } = render(<><ProjectPage locale="en" slug="notaprofile" /><ProjectPage locale="pt-BR" slug="notaprofile" /></>);
    const external = Array.from(container.querySelectorAll('article a[href^="https://"]'));
    expect(external.length).toBeGreaterThan(0);
    expect(external.every((link) => link.getAttribute('target') === '_blank' && link.getAttribute('rel') === 'noopener noreferrer')).toBe(true);
    expect(container.querySelector('a[href*="utm_content=project-page-en"]')).not.toBeNull();
    expect(container.querySelector('a[href*="utm_content=project-page-pt-br"]')).not.toBeNull();
    expect(container.querySelector('a[href*="utm_content=project-page&"], a[href$="utm_content=project-page"]')).toBeNull();
  });

  it('returns no content for unknown detail slugs', () => {
    const { container } = render(<><ProjectPage locale="en" slug="missing" /><ContributionPage locale="en" slug="missing" /><WorkPage locale="en" slug="missing" /><ArticlePage locale="en" slug="missing" /></>);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders articles with optional image metadata omitted', () => {
    const article = getArticles('en')[0];
    vi.spyOn(articles, 'getArticle').mockReturnValue({ ...article, image: undefined, imageAlt: undefined, socialImage: undefined, updated: '2024-01-01' });
    vi.spyOn(articles, 'getArticleTranslationSlug').mockReturnValue(null);
    const { container, rerender } = render(<ArticlePage locale="en" slug={article.slug} />);

    expect(container.querySelector('img')).not.toBeInTheDocument();
    const [posting] = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(posting.image).toBeUndefined();
    expect(posting.author).toMatchObject({ '@type': 'Person', '@id': 'https://fbrissi.dev/#person', name: 'Filipe Bojikian Rissi', url: 'https://fbrissi.dev/' });
    expect(posting.publisher).toMatchObject({ name: 'Filipe Bojikian Rissi' });
    expect(container.querySelector('script[type="application/ld+json"]')).toHaveTextContent('"dateModified":"2024-01-01"');

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
    const { container } = render(<><ContactPage locale="pt-BR" /><AboutPage locale="pt-BR" /></>);
    expect(screen.getByText('Contact form (pt-BR)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute('href', '/pt-br/privacy');
    expect(screen.getByRole('heading', { level: 2, name: 'Certificações e palestras' })).toBeInTheDocument();
    expect(screen.getByText(/Inglês — proficiência profissional/)).toBeInTheDocument();
    expect(screen.getByText(/Atualmente, na/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'programa gratuito de grupos de estudo de inglês para desenvolvedores' })).toHaveAttribute('href', '/pt-br/grupos-de-estudo-de-ingles');
    expect(screen.queryByText(/Também mantenho/)).not.toBeInTheDocument();
    expect(JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!)).toMatchObject({ '@type': 'ProfilePage', url: 'https://fbrissi.dev/pt-br/about', mainEntity: { '@type': 'Person', '@id': 'https://fbrissi.dev/#person', name: 'Filipe Bojikian Rissi', url: 'https://fbrissi.dev/', jobTitle: 'Engenheiro Backend e Cloud', sameAs: ['https://github.com/fbrissi', 'https://www.linkedin.com/in/fbrissi/', 'https://gitlab.com/fbrissi'] } });
    expect(screen.getByText('MBA em Engenharia de Software (IGTI, 2017–2018)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'contact@fbrissi.dev' })).toHaveAttribute('href', 'mailto:contact@fbrissi.dev');
    expect(screen.getByRole('link', { name: '+55 (14) 99143-4121' })).toHaveAttribute('href', 'https://wa.me/5514991434121');
    expect(screen.getByRole('heading', { level: 1, name: /sobre/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /engenharia cloud-native/i })).toBeInTheDocument();
    expect(screen.getByText(/PagBank \(PagSeguro\)/i)).toBeInTheDocument();
  });
});
