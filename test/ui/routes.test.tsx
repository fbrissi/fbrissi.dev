import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('React', React);
afterEach(cleanup);

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => { throw new Error('not found'); }),
}));

vi.mock('next/navigation', () => ({ notFound }));
vi.mock('@/components/site-pages', () => ({
  HomePage: ({ locale }: { locale: string }) => <div>home:{locale}</div>,
  AboutPage: ({ locale }: { locale: string }) => <div>about:{locale}</div>,
  ArticlesPage: ({ locale }: { locale: string }) => <div>articles:{locale}</div>,
  ArticlePage: ({ locale, slug }: { locale: string; slug: string }) => <div>article:{locale}:{slug}</div>,
  ContactPage: ({ locale }: { locale: string }) => <div>contact:{locale}</div>,
  ProjectsPage: ({ locale }: { locale: string }) => <div>projects:{locale}</div>,
  ProjectPage: ({ locale, slug }: { locale: string; slug: string }) => <div>project:{locale}:{slug}</div>,
  WorksPage: ({ locale }: { locale: string }) => <div>works:{locale}</div>,
  WorkDetailPage: ({ locale, slug }: { locale: string; slug: string }) => <div>work:{locale}:{slug}</div>,
}));
vi.mock('@/components/site-shell', () => ({ SiteShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));

import RootLayout, { metadata as rootMetadata } from '@/app/layout';
import EnHome, { metadata as enHomeMetadata } from '@/app/page';
import EnNotFound from '@/app/not-found';
import EnAbout, { metadata as enAboutMetadata } from '@/app/about/page';
import EnContact, { metadata as enContactMetadata } from '@/app/contact/page';
import EnArticles, { metadata as enArticlesMetadata } from '@/app/articles/page';
import EnProjects, { metadata as enProjectsMetadata } from '@/app/projects/page';
import EnWorks, { metadata as enWorksMetadata } from '@/app/works/page';
import * as EnArticleDetail from '@/app/articles/[slug]/page';
import * as EnProjectDetail from '@/app/projects/[slug]/page';
import * as EnWorkDetail from '@/app/works/[slug]/page';
import PtHome, { metadata as ptHomeMetadata } from '@/app/pt-br/page';
import PtNotFound from '@/app/pt-br/not-found';
import PtAbout, { metadata as ptAboutMetadata } from '@/app/pt-br/about/page';
import PtContact, { metadata as ptContactMetadata } from '@/app/pt-br/contact/page';
import PtArticles, { metadata as ptArticlesMetadata } from '@/app/pt-br/articles/page';
import PtProjects, { metadata as ptProjectsMetadata } from '@/app/pt-br/projects/page';
import PtWorks, { metadata as ptWorksMetadata } from '@/app/pt-br/works/page';
import * as PtArticleDetail from '@/app/pt-br/articles/[slug]/page';
import * as PtProjectDetail from '@/app/pt-br/projects/[slug]/page';
import * as PtWorkDetail from '@/app/pt-br/works/[slug]/page';
import { getArticleSlugs } from '@/lib/articles';
import { getProjectSlugs } from '@/lib/projects';
import { getWorkSlugs } from '@/lib/works';

describe('root and static routes', () => {
  it('sets root document metadata and language', () => {
    render(<RootLayout><p>content</p></RootLayout>);
    expect(rootMetadata.title).toEqual(expect.objectContaining({ default: 'Filipe Bojikian Rissi' }));
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it.each([
    ['en home', EnHome, enHomeMetadata, 'home:en'],
    ['en about', EnAbout, enAboutMetadata, 'about:en'],
    ['en contact', EnContact, enContactMetadata, 'contact:en'],
    ['en articles', EnArticles, enArticlesMetadata, 'articles:en'],
    ['en projects', EnProjects, enProjectsMetadata, 'projects:en'],
    ['en works', EnWorks, enWorksMetadata, 'works:en'],
    ['pt home', PtHome, ptHomeMetadata, 'home:pt-BR'],
    ['pt about', PtAbout, ptAboutMetadata, 'about:pt-BR'],
    ['pt contact', PtContact, ptContactMetadata, 'contact:pt-BR'],
    ['pt articles', PtArticles, ptArticlesMetadata, 'articles:pt-BR'],
    ['pt projects', PtProjects, ptProjectsMetadata, 'projects:pt-BR'],
    ['pt works', PtWorks, ptWorksMetadata, 'works:pt-BR'],
  ])('%s renders its localized page and exports metadata', (_name, Page, metadata, content) => {
    render(<Page />);
    expect(screen.getByText(content)).toBeInTheDocument();
    expect(metadata.description).toEqual(expect.any(String));
    expect(metadata.alternates).toBeDefined();
  });

  it('renders localized not-found recovery links', () => {
    const { rerender } = render(<EnNotFound />);
    expect(screen.getByRole('link', { name: 'Back home' })).toHaveAttribute('href', '/');
    rerender(<PtNotFound />);
    expect(screen.getByRole('link', { name: /voltar para o início/i })).toHaveAttribute('href', '/pt-br');
  });
});

type DetailRoute = {
  default: (props: { params: Promise<{ slug: string }> }) => Promise<React.ReactNode>;
  dynamic: string;
  dynamicParams: boolean;
  generateStaticParams: () => { slug: string }[];
  generateMetadata: (props: { params: Promise<{ slug: string }> }) => Promise<{ description?: string }>;
};

describe('static detail routes', () => {
  it.each([
    ['en article', EnArticleDetail, getArticleSlugs('en'), 'article:en'],
    ['en project', EnProjectDetail, getProjectSlugs('en'), 'project:en'],
    ['en work', EnWorkDetail, getWorkSlugs('en'), 'work:en'],
    ['pt article', PtArticleDetail, getArticleSlugs('pt-BR'), 'article:pt-BR'],
    ['pt project', PtProjectDetail, getProjectSlugs('pt-BR'), 'project:pt-BR'],
    ['pt work', PtWorkDetail, getWorkSlugs('pt-BR'), 'work:pt-BR'],
  ] as const)('%s exports all known params, metadata, and a static rendered page', async (_name, route, slugs, renderedPrefix) => {
    const detailRoute = route as DetailRoute;
    const slug = slugs[0];

    expect(detailRoute.dynamic).toBe('force-static');
    expect(detailRoute.dynamicParams).toBe(false);
    expect(detailRoute.generateStaticParams()).toEqual(slugs.map((value) => ({ slug: value })));
    expect((await detailRoute.generateMetadata({ params: Promise.resolve({ slug }) })).description).toEqual(expect.any(String));
    render(await detailRoute.default({ params: Promise.resolve({ slug }) }));
    expect(screen.getByText(`${renderedPrefix}:${slug}`)).toBeInTheDocument();
  });

  it.each([
    ['en article', EnArticleDetail],
    ['en project', EnProjectDetail],
    ['en work', EnWorkDetail],
    ['pt article', PtArticleDetail],
    ['pt project', PtProjectDetail],
    ['pt work', PtWorkDetail],
  ] as const)('%s returns empty metadata and invokes notFound for unavailable detail slugs', async (_name, route) => {
    const detailRoute = route as unknown as DetailRoute;

    await expect(detailRoute.generateMetadata({ params: Promise.resolve({ slug: 'missing' }) })).resolves.toEqual({});
    await expect(detailRoute.default({ params: Promise.resolve({ slug: 'missing' }) })).rejects.toThrow('not found');
    expect(notFound).toHaveBeenCalled();
  });
});
