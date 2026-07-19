import { createBrowserRouter, type RouteObject, useLocation, useParams } from 'react-router';

import { getArticle } from '@/lib/articles';
import { normalizeRoute, type Locale } from '@/lib/i18n';
import { getProject } from '@/lib/projects';
import { createPageMetadata } from '@/lib/seo';
import { getMessages, getProfile } from '@/lib/site';
import { getWork } from '@/lib/works';
import { AboutPage } from '@/pages/about-page';
import { ArticlePage } from '@/pages/article-page';
import { ArticlesPage } from '@/pages/articles-page';
import { ContactPage } from '@/pages/contact-page';
import { HomePage } from '@/pages/home-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { ProjectPage } from '@/pages/project-page';
import { ProjectsPage } from '@/pages/projects-page';
import { WorkPage } from '@/pages/work-page';
import { WorksPage } from '@/pages/works-page';

import { DocumentMetadata } from './metadata';

function StaticRoute({ locale, pathname, page }: { locale: Locale; pathname: '/' | '/about' | '/articles' | '/contact' | '/projects' | '/works'; page: React.ReactNode }) {
  const messages = getMessages(locale);
  const pageName = pathname.slice(1) as keyof typeof messages.pages;
  const title = pathname === '/'
    ? `Filipe Bojikian Rissi | ${locale === 'pt-BR' ? 'Portfólio' : 'Portfolio'}`
    : `${messages.pages[pageName].title} | ${messages.site.name}`;
  const description = pathname === '/' ? getProfile(locale).summary : messages.pages[pageName].description;
  return <DocumentMetadata locale={locale} metadata={createPageMetadata({ locale, pathname, title, description })}>{page}</DocumentMetadata>;
}

function ArticleRoute({ locale }: { locale: Locale }) {
  const { slug = '' } = useParams();
  const article = getArticle(locale, slug);
  if (!article) return <NotFoundRoute locale={locale} />;
  const metadata = createPageMetadata({ locale, pathname: `/articles/${slug}`, title: `${article.title} | ${getMessages(locale).site.name}`, description: article.description });
  return <DocumentMetadata locale={locale} metadata={metadata}><ArticlePage locale={locale} slug={slug} /></DocumentMetadata>;
}

function ProjectRoute({ locale }: { locale: Locale }) {
  const { slug = '' } = useParams();
  const project = getProject(locale, slug);
  if (!project) return <NotFoundRoute locale={locale} />;
  const metadata = createPageMetadata({ locale, pathname: `/projects/${slug}`, title: `${project.title} | ${getMessages(locale).site.name}`, description: project.description });
  return <DocumentMetadata locale={locale} metadata={metadata}><ProjectPage locale={locale} slug={slug} /></DocumentMetadata>;
}

function WorkRoute({ locale }: { locale: Locale }) {
  const { slug = '' } = useParams();
  const work = getWork(locale, slug);
  if (!work) return <NotFoundRoute locale={locale} />;
  const title = locale === 'pt-BR'
    ? `${work.title} na ${work.company} | ${getMessages(locale).site.name}`
    : `${work.title} at ${work.company} | ${getMessages(locale).site.name}`;
  const metadata = createPageMetadata({ locale, pathname: `/works/${slug}`, title, description: work.summary, keywords: work.skills });
  return <DocumentMetadata locale={locale} metadata={metadata}><WorkPage locale={locale} slug={slug} /></DocumentMetadata>;
}

function NotFoundRoute({ locale }: { locale: Locale }) {
  const location = useLocation();
  const title = locale === 'pt-BR' ? 'Página não encontrada' : 'Page not found';
  const description = locale === 'pt-BR' ? 'A página solicitada não existe.' : 'The requested page does not exist.';
  const metadata = createPageMetadata({ locale, pathname: normalizeRoute(location.pathname), title, description });
  return <DocumentMetadata locale={locale} metadata={metadata}><NotFoundPage locale={locale} /></DocumentMetadata>;
}

function localizedRoutes(locale: Locale, prefix: '' | '/pt-br'): RouteObject[] {
  return [
    { path: prefix || '/', element: <StaticRoute locale={locale} pathname="/" page={<HomePage locale={locale} />} /> },
    { path: `${prefix}/about`, element: <StaticRoute locale={locale} pathname="/about" page={<AboutPage locale={locale} />} /> },
    { path: `${prefix}/articles`, element: <StaticRoute locale={locale} pathname="/articles" page={<ArticlesPage locale={locale} />} /> },
    { path: `${prefix}/articles/:slug`, element: <ArticleRoute locale={locale} /> },
    { path: `${prefix}/contact`, element: <StaticRoute locale={locale} pathname="/contact" page={<ContactPage locale={locale} />} /> },
    { path: `${prefix}/projects`, element: <StaticRoute locale={locale} pathname="/projects" page={<ProjectsPage locale={locale} />} /> },
    { path: `${prefix}/projects/:slug`, element: <ProjectRoute locale={locale} /> },
    { path: `${prefix}/works`, element: <StaticRoute locale={locale} pathname="/works" page={<WorksPage locale={locale} />} /> },
    { path: `${prefix}/works/:slug`, element: <WorkRoute locale={locale} /> }
  ];
}

export const appRoutes: RouteObject[] = [
  ...localizedRoutes('en', ''),
  ...localizedRoutes('pt-BR', '/pt-br'),
  { path: '/pt-br/*', element: <NotFoundRoute locale="pt-BR" /> },
  { path: '*', element: <NotFoundRoute locale="en" /> }
];

export const router = createBrowserRouter(appRoutes);
