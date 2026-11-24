import { ProjectCard } from '@/components/content/content-cards';
import { ContributionCard } from '@/components/content/contribution-card';
import { SiteShell } from '@/components/layout/site-shell';
import { getContributions } from '@/lib/contributions';
import type { Locale } from '@/lib/i18n';
import { getProjects } from '@/lib/projects';
import { getMessages } from '@/lib/site';

/** Projects and upstream open-source contributions on one page (D-3); `/open-source` redirects here. */
export function ProjectsPage({ locale }: { locale: Locale }) {
  const messages = getMessages(locale);
  const projects = getProjects(locale);
  const contributions = getContributions(locale);
  return (
    <SiteShell locale={locale} activePage="projects">
      <section className="mb-16">
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{messages.pages.projects.title}</h1>
        <p className="text-lg leading-relaxed text-text-secondary">{messages.pages.projects.description}</p>
      </section>
      <section className="mb-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => <ProjectCard key={project.slug} locale={locale} item={project} />)}
        </div>
      </section>
      <section id="open-source" className="mb-16 scroll-mt-32" aria-labelledby="open-source-title">
        <h2 id="open-source-title" className="mb-4 text-2xl font-normal tracking-tight sm:text-3xl">{messages.pages.openSource.title}</h2>
        <p className="mb-8 max-w-3xl text-lg leading-relaxed text-text-secondary">{messages.pages.openSource.description}</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {contributions.map((contribution) => <ContributionCard key={contribution.slug} locale={locale} item={contribution} />)}
        </div>
      </section>
    </SiteShell>
  );
}
