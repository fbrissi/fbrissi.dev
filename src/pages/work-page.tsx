import { Markdown } from '@/components/content/markdown';
import { StructuredData } from '@/components/content/structured-data';
import { SiteShell } from '@/components/layout/site-shell';
import { localizedPath, type Locale } from '@/lib/i18n';
import { absoluteUrl } from '@/lib/seo';
import { getMessages } from '@/lib/site';
import { getWork } from '@/lib/works';

export function WorkPage({ locale, slug }: { locale: Locale; slug: string }) {
  const messages = getMessages(locale);
  const work = getWork(locale, slug);
  if (!work) return null;

  return (
    <SiteShell locale={locale} activePage="works">
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          mainEntity: {
            '@type': 'Person',
            name: 'Filipe Bojikian Rissi',
            url: absoluteUrl(localizedPath(locale, `/works/${slug}`)),
            hasOccupation: {
              '@type': 'Occupation',
              name: work.title,
              description: work.summary,
              skills: work.skills.join(', '),
              occupationLocation: { '@type': 'Place', name: work.location }
            },
            affiliation: {
              '@type': 'Organization',
              name: work.company,
              url: work.companyUrl,
              logo: absoluteUrl(work.logo)
            }
          }
        }}
      />
      <section className="mb-16">
        <Link className="mb-6 inline-flex items-center gap-2 text-sm font-light tracking-wide text-accent transition-colors duration-250 hover:text-accent-hover" to={localizedPath(locale, '/works')}>
          {messages.labels.backToWorks}
        </Link>
        <p className="mb-4 text-xs font-light uppercase tracking-widest text-text-muted">{work.dateRange}</p>
        <div className="mb-6 flex items-center gap-5">
          <img className="h-20 w-20 rounded-xl bg-white object-contain p-2" src={work.logo} alt={`${work.company} logo`} />
          <div>
            <h1 className="text-3xl font-normal tracking-tight sm:text-5xl">{work.company}</h1>
            <a className="mt-2 inline-block text-sm text-accent hover:text-accent-hover" href={work.companyUrl} target="_blank" rel="noreferrer">
              {locale === 'pt-BR' ? 'Site oficial' : 'Official website'}
            </a>
          </div>
        </div>
        <p className="text-lg leading-relaxed text-text-secondary">{work.summary}</p>
      </section>
      <article className="rounded-xl border border-line bg-bg-soft p-6 shadow-lg sm:p-10">
        <div className="mb-6 flex flex-wrap gap-2">
          <span className="rounded-md bg-bg-card px-3 py-1 text-xs font-light tracking-wide text-text-secondary">{work.title}</span>
          <span className="rounded-md bg-bg-card px-3 py-1 text-xs font-light tracking-wide text-text-secondary">{work.dateRange}</span>
          <span className="rounded-md bg-bg-card px-3 py-1 text-xs font-light tracking-wide text-text-secondary">{work.employmentType}</span>
          <span className="rounded-md bg-bg-card px-3 py-1 text-xs font-light tracking-wide text-text-secondary">{work.location}</span>
        </div>
        <Markdown content={work.content} />
        <div className="mt-8 flex flex-wrap gap-2" aria-label={locale === 'pt-BR' ? 'Competências' : 'Skills'}>
          {work.skills.map((skill) => <span key={skill} className="rounded-md bg-bg-card px-3 py-1 text-xs font-light tracking-wide text-text-secondary">{skill}</span>)}
        </div>
      </article>
    </SiteShell>
  );
}
import { Link } from 'react-router';
