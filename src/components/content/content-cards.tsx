import Link from 'next/link';

import portfolioImage from '@/assets/images/portifolio.png';
import type { Article } from '@/lib/articles';
import type { Locale } from '@/lib/i18n';
import { localizedPath } from '@/lib/i18n';

/* c8 ignore next: Vite and Next expose imported assets with different shapes. */
const portfolioImageUrl = typeof portfolioImage === 'string' ? portfolioImage : portfolioImage.src;
import type { ProjectItem } from '@/lib/projects';
import type { WorkEntry } from '@/lib/works';
import { getMessages } from '@/lib/site';

type ContentCardProps = {
  locale: Locale;
};

type ProjectCardProps = ContentCardProps & {
  item: ProjectItem;
};

type WorksCardProps = {
  locale: Locale;
  item: WorkEntry;
};

type ArticleCardProps = {
  locale: Locale;
  item: Article;
};

const ChevronRight = () => (
  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export function ProjectCard({ locale, item }: ProjectCardProps) {
  const messages = getMessages(locale);
  const href = localizedPath(locale, `/projects/${item.slug}`);

  return (
    <Link href={href} className="group flex flex-col overflow-hidden rounded-xl border border-line bg-bg-soft shadow-lg transition-all duration-250 hover:-translate-y-1 hover:border-line-bright hover:shadow-xl">
      <img
        className="aspect-video w-full border-b border-line object-cover transition-colors duration-250 group-hover:border-line-bright"
        src={portfolioImageUrl}
        alt={locale === 'pt-BR' ? `Prévia do projeto ${item.title}` : `${item.title} project preview`}
      />
      <div className="flex flex-1 flex-col gap-4 p-6">
        <h3 className="text-xl font-normal tracking-tight">{item.title}</h3>
        <p className="flex-1 text-sm leading-relaxed text-text-secondary">{item.description}</p>
        <div className="flex flex-wrap gap-2">
          {item.stack.map((tech) => (
            <span key={tech} className="rounded-md bg-bg-card px-3 py-1 text-xs font-light tracking-wide text-text-secondary">
              {tech}
            </span>
          ))}
        </div>
        <span className="mt-2 inline-flex items-center gap-2 text-sm font-light tracking-wide text-accent transition-colors duration-250 group-hover:text-accent-hover">
          {messages.labels.readProject}
          <ChevronRight />
        </span>
      </div>
    </Link>
  );
}

export function WorksCard({ locale, item }: WorksCardProps) {
  const href = localizedPath(locale, `/works/${item.slug}`);

  return (
    <Link href={href} className="group flex flex-col overflow-hidden rounded-xl border border-line bg-bg-soft p-6 shadow-lg transition-all duration-250 hover:-translate-y-1 hover:border-line-bright hover:shadow-xl">
      <div className="flex flex-col gap-3">
        <img className="mb-2 h-14 w-14 rounded-lg bg-white object-contain p-1" src={item.logo} alt={`${item.company} logo`} loading="lazy" />
        <p className="text-xs font-light uppercase tracking-widest text-text-muted">{item.dateRange}</p>
        <h3 className="text-xl font-normal tracking-tight">{item.company}</h3>
        <p className="text-sm leading-relaxed text-text-secondary">{item.title}</p>
        <p className="text-sm leading-relaxed text-text-secondary">{item.summary}</p>
        <span className="mt-2 inline-flex items-center gap-2 text-sm font-light tracking-wide text-accent transition-colors duration-250 group-hover:text-accent-hover">
          {getMessages(locale).labels.readWork}
          <ChevronRight />
        </span>
      </div>
    </Link>
  );
}

export function ArticleCard({ locale, item }: ArticleCardProps) {
  const messages = getMessages(locale);

  return (
    <Link href={localizedPath(locale, `/articles/${item.slug}`)} className="group flex flex-col overflow-hidden rounded-xl border border-line bg-bg-soft shadow-lg transition-all duration-250 hover:-translate-y-1 hover:border-line-bright hover:shadow-xl">
      {item.image ? (
        <img className="aspect-video w-full border-b border-line object-cover transition-colors duration-250 group-hover:border-line-bright" src={item.image} alt={item.imageAlt ?? ''} />
      ) : (
        <div className="flex aspect-video items-center justify-center border-b border-line bg-gradient-to-br from-bg-card to-bg text-sm text-text-muted transition-colors duration-250 group-hover:border-line-bright">
          <span>Article Image</span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span>{item.dateLabel}</span>
          <span>·</span>
          <span>{item.readingTime}</span>
        </div>
        <h3 className="text-xl font-normal tracking-tight">{item.title}</h3>
        <p className="flex-1 text-sm leading-relaxed text-text-secondary">{item.description}</p>
        <span className="mt-2 inline-flex items-center gap-2 text-sm font-light tracking-wide text-accent transition-colors duration-250 group-hover:text-accent-hover">
          {messages.labels.readArticle}
          <ChevronRight />
        </span>
      </div>
    </Link>
  );
}
