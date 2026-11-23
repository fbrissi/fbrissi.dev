import { Markdown } from '@/components/content/markdown';
import { StructuredData } from '@/components/content/structured-data';
import { SiteShell } from '@/components/layout/site-shell';
import { localizedPath, type Locale } from '@/lib/i18n';
import { getProject } from '@/lib/projects';
import { getMessages } from '@/lib/site';
import { breadcrumbList, pageUrl, personId } from '@/lib/structured-data';

const openProjectClass = 'inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm tracking-wide text-bg transition-all duration-250 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent-glow';

export function ProjectPage({ locale, slug }: { locale: Locale; slug: string }) {
  const messages = getMessages(locale);
  const project = getProject(locale, slug);
  if (!project) return null;
  const isInternal = project.url.startsWith('/');
  const breadcrumb = breadcrumbList(locale, [{ name: messages.pages.projects.title, path: '/projects' }, { name: project.title, path: `/projects/${slug}` }]);

  return (
    <SiteShell locale={locale} activePage="projects" pathname={`/projects/${slug}`}>
      <StructuredData
        data={project.url.startsWith('https://github.com/')
          ? [breadcrumb, {
              '@context': 'https://schema.org',
              '@type': 'SoftwareSourceCode',
              name: project.title,
              description: project.description,
              url: pageUrl(locale, `/projects/${slug}`),
              codeRepository: project.url,
              keywords: project.stack.join(', '),
              author: { '@id': personId }
            }]
          : breadcrumb}
      />
      <section className="mb-16">
        <Link className="mb-6 inline-flex items-center gap-2 text-sm font-light tracking-wide text-accent transition-colors duration-250 hover:text-accent-hover" href={localizedPath(locale, '/projects')}>
          {messages.labels.backToProjects}
        </Link>
        <p className="mb-4 text-xs font-light uppercase tracking-widest text-text-muted">{project.stack.join(' · ')}</p>
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{project.title}</h1>
        <p className="text-lg leading-relaxed text-text-secondary">{project.description}</p>
      </section>
      <article className="rounded-xl border border-line bg-bg-soft p-6 shadow-lg sm:p-10">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          {isInternal ? (
            <Link className={openProjectClass} href={project.url}>
              {messages.labels.openProject}
            </Link>
          ) : (
            <a className={openProjectClass} href={project.url} target="_blank" rel="noopener noreferrer">
              {messages.labels.openProject}<span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
        <div className="mb-6 flex flex-wrap gap-2">
          {project.stack.map((tech) => <span key={tech} className="rounded-md bg-bg-card px-3 py-1 text-xs font-light tracking-wide text-text-secondary">{tech}</span>)}
        </div>
        <Markdown content={project.content} />
      </article>
    </SiteShell>
  );
}
import Link from 'next/link';
