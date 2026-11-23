import Link from 'next/link';

import { Markdown } from '@/components/content/markdown';
import { StructuredData } from '@/components/content/structured-data';
import { SiteShell } from '@/components/layout/site-shell';
import { getContribution } from '@/lib/contributions';
import { localizedPath, type Locale } from '@/lib/i18n';
import { getMessages } from '@/lib/site';
import { breadcrumbList } from '@/lib/structured-data';

export function ContributionPage({ locale, slug }: { locale: Locale; slug: string }) {
  const messages = getMessages(locale);
  const contribution = getContribution(locale, slug);
  if (!contribution) return null;

  return (
    <SiteShell locale={locale} activePage="projects" pathname={`/open-source/${slug}`}>
      <StructuredData data={breadcrumbList(locale, [{ name: messages.pages.projects.title, path: '/projects' }, { name: contribution.title, path: `/open-source/${slug}` }])} />
      <section className="mb-12 max-w-4xl">
        <Link className="mb-6 inline-flex text-sm font-light tracking-wide text-accent transition-colors duration-250 hover:text-accent-hover" href={`${localizedPath(locale, '/projects')}#open-source`}>
          {messages.labels.backToContributions}
        </Link>
        <p className="mb-4 font-mono text-xs text-accent">{contribution.repository} · {contribution.period}</p>
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{contribution.title}</h1>
        <p className="text-lg leading-relaxed text-text-secondary">{contribution.description}</p>
      </section>
      <article className="rounded-xl border border-line bg-bg-soft p-6 shadow-lg sm:p-10">
        <div className="mb-8 flex flex-wrap gap-3">
          <a className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-light tracking-wide text-bg transition-all duration-250 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent-glow" href={contribution.repositoryUrl} target="_blank" rel="noreferrer">
            {messages.labels.openRepository}<span aria-hidden="true">↗</span>
          </a>
          {contribution.evidence.map((item) => (
            <a key={item.url} className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-text-secondary transition-colors duration-250 hover:border-line-bright hover:text-text" href={item.url} target="_blank" rel="noreferrer">
              {item.label}<span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
        <div className="mb-8 flex flex-wrap gap-2">
          {contribution.tags.map((tag) => <span key={tag} className="rounded-md bg-bg-card px-3 py-1 text-xs font-light tracking-wide text-text-secondary">{tag}</span>)}
        </div>
        <Markdown content={contribution.content} />
      </article>
    </SiteShell>
  );
}
