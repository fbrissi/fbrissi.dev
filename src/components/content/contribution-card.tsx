import { Link } from 'react-router';

import type { Contribution } from '@/lib/contributions';
import { localizedPath, type Locale } from '@/lib/i18n';
import { getMessages } from '@/lib/site';

export function ContributionCard({ locale, item }: { locale: Locale; item: Contribution }) {
  const messages = getMessages(locale);
  const contributionPath = localizedPath(locale, `/open-source/${item.slug}`);

  return (
    <article className="group flex h-full flex-col rounded-xl border border-line bg-bg-soft p-6 shadow-lg transition-all duration-250 hover:-translate-y-1 hover:border-line-bright hover:shadow-xl">
      <Link className="flex flex-1 flex-col" to={contributionPath}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 font-mono text-xs text-accent">{item.repository}</p>
            <h3 className="text-xl font-normal tracking-tight text-text">{item.title}</h3>
          </div>
          <span className="shrink-0 rounded-full border border-line px-3 py-1 text-xs text-text-muted">{item.period}</span>
        </div>
        <p className="mb-5 flex-1 text-sm leading-relaxed text-text-secondary">{item.description}</p>
        <div className="mb-6 flex flex-wrap gap-2">
          {item.tags.map((tag) => <span key={tag} className="rounded-md bg-bg-card px-3 py-1 text-xs font-light tracking-wide text-text-secondary">{tag}</span>)}
        </div>
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
        <Link className="text-sm font-light tracking-wide text-accent transition-colors duration-250 hover:text-accent-hover" to={contributionPath}>
          {messages.labels.readContribution}
        </Link>
        <a className="text-xs text-text-muted transition-colors duration-250 hover:text-text" href={item.evidence[0].url} target="_blank" rel="noreferrer">
          {item.evidence[0].label} <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}
