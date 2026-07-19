import { ProjectCard } from '@/components/content/content-cards';
import { SiteShell } from '@/components/layout/site-shell';
import type { Locale } from '@/lib/i18n';
import { getProjects } from '@/lib/projects';
import { getMessages } from '@/lib/site';

export function ProjectsPage({ locale }: { locale: Locale }) {
  const messages = getMessages(locale);
  const projects = getProjects(locale);
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
    </SiteShell>
  );
}
