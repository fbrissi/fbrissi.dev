import Link from 'next/link';

import { getArticle, getArticles } from '@/lib/articles';
import { localizedPath, type Locale } from '@/lib/i18n';
import { getProject, getProjects } from '@/lib/projects';
import { getMessages, getProfile } from '@/lib/site';
import { getWork, getWorks } from '@/lib/works';

import { ArticleCard, ProjectCard, WorksCard } from './content-cards';
import { ContactForm } from './contact-form';
import { Markdown } from './markdown';
import { SiteShell } from './site-shell';
import { StructuredData } from './structured-data';
import { ViewAllLink } from './view-all-link';

type PageProps = {
  locale: Locale;
};

type ArticlePageProps = PageProps & {
  slug: string;
};

type ProjectPageProps = PageProps & {
  slug: string;
};

type WorkPageProps = PageProps & {
  slug: string;
};

export function HomePage({ locale }: PageProps) {
  const messages = getMessages(locale);
  const profile = getProfile(locale);
  const posts = getArticles(locale).slice(0, 6);
  const featuredProjects = getProjects(locale).slice(0, 6);
  const featuredWorks = getWorks(locale).slice(0, 6);

  return (
    <SiteShell locale={locale} activePage="home">
      <StructuredData
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: profile.name,
            jobTitle: profile.headline,
            description: profile.summary,
            url: localizedPath(locale, '/'),
            sameAs: profile.publicLinks.map((link) => link.url)
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: profile.name,
            description: messages.site.description,
            url: localizedPath(locale, '/')
          }
        ]}
      />

      <section className="mb-16">
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{profile.headline}</h1>
        <p className="mb-4 text-lg leading-relaxed text-text-secondary">{profile.summary}</p>
        <p className="mb-4 text-lg leading-relaxed text-text-secondary">
          {messages.home.eyebrow} {profile.location}.
        </p>
        <p className="text-lg leading-relaxed text-text-secondary">
          Find me on{' '}
          {profile.publicLinks.slice(0, 2).map((link, index) => (
            <span key={link.url}>
              {index > 0 && ' and '}
              <a className="text-accent transition-colors duration-300 hover:text-accent-hover" href={link.url} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            </span>
          ))}.
        </p>
      </section>

      <section className="mb-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-normal tracking-tight">{messages.labels.featuredProjects}</h2>
          <ViewAllLink href={localizedPath(locale, '/projects')} label={messages.labels.viewAllProjects} />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featuredProjects.map((project) => (
            <ProjectCard key={project.slug} locale={locale} item={project} />
          ))}
        </div>
      </section>

      {featuredWorks.length > 0 && (
        <section className="mb-16">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-normal tracking-tight">{messages.labels.experience}</h2>
            <ViewAllLink href={localizedPath(locale, '/works')} label={messages.labels.viewAllWorks} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredWorks.map((item) => (
              <WorksCard key={item.slug} locale={locale} item={item} />
            ))}
          </div>
        </section>
      )}

      {posts.length > 0 && (
        <section className="mb-16">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-normal tracking-tight">{messages.labels.articlesPreview}</h2>
            <ViewAllLink href={localizedPath(locale, '/articles')} label={messages.labels.viewAllArticles} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <ArticleCard key={post.slug} locale={locale} item={post} />
            ))}
          </div>
        </section>
      )}
    </SiteShell>
  );
}

export function ProjectsPage({ locale }: PageProps) {
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
          {projects.map((project) => (
            <ProjectCard key={project.slug} locale={locale} item={project} />
          ))}
        </div>
      </section>
    </SiteShell>
  );
}

export function WorksPage({ locale }: PageProps) {
  const messages = getMessages(locale);
  const works = getWorks(locale);

  return (
    <SiteShell locale={locale} activePage="works">
      <section className="mb-16">
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{messages.pages.works.title}</h1>
        <p className="text-lg leading-relaxed text-text-secondary">{messages.pages.works.description}</p>
      </section>

      <section className="mb-16">
        <div className="mb-8">
          <h2 className="text-2xl font-normal tracking-tight">{messages.labels.experience}</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {works.map((item) => (
            <WorksCard key={item.slug} locale={locale} item={item} />
          ))}
        </div>
      </section>
    </SiteShell>
  );
}

export function ProjectPage({ locale, slug }: ProjectPageProps) {
  const messages = getMessages(locale);
  const profile = getProfile(locale);
  const project = getProject(locale, slug);

  if (!project) {
    return null;
  }

  return (
    <SiteShell locale={locale} activePage="projects">
      <section className="mb-16">
        <Link className="mb-6 inline-flex items-center gap-2 text-sm font-light tracking-wide text-accent transition-colors duration-250 hover:text-accent-hover" href={localizedPath(locale, '/projects')}>
          {messages.labels.backToProjects}
        </Link>
        <p className="mb-4 text-xs font-light uppercase tracking-widest text-text-muted">
          {project.stack.join(' · ')}
        </p>
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{project.title}</h1>
        <p className="text-lg leading-relaxed text-text-secondary">{project.description}</p>
      </section>

      <article className="rounded-xl border border-line bg-bg-soft p-6 shadow-lg sm:p-10">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <a className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-light tracking-wide text-bg transition-all duration-250 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent-glow" href={project.url} target="_blank" rel="noreferrer">
            {messages.labels.openProject}
            <span aria-hidden="true">↗</span>
          </a>
          <span className="text-sm text-text-muted">{profile.location}</span>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {project.stack.map((tech) => (
            <span key={tech} className="rounded-md bg-bg-card px-3 py-1 text-xs font-light tracking-wide text-text-secondary">
              {tech}
            </span>
          ))}
        </div>

        <Markdown content={project.content} />
      </article>
    </SiteShell>
  );
}

export function WorkDetailPage({ locale, slug }: WorkPageProps) {
  const messages = getMessages(locale);
  const work = getWork(locale, slug);

  if (!work) {
    return null;
  }

  return (
    <SiteShell locale={locale} activePage="works">
      <section className="mb-16">
        <Link className="mb-6 inline-flex items-center gap-2 text-sm font-light tracking-wide text-accent transition-colors duration-250 hover:text-accent-hover" href={localizedPath(locale, '/works')}>
          {messages.labels.backToWorks}
        </Link>
        <p className="mb-4 text-xs font-light uppercase tracking-widest text-text-muted">{work.dateRange}</p>
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{work.company}</h1>
        <p className="text-lg leading-relaxed text-text-secondary">{work.summary}</p>
      </section>

      <article className="rounded-xl border border-line bg-bg-soft p-6 shadow-lg sm:p-10">
        <div className="mb-6 flex flex-wrap gap-2">
          <span className="rounded-md bg-bg-card px-3 py-1 text-xs font-light tracking-wide text-text-secondary">{work.title}</span>
          <span className="rounded-md bg-bg-card px-3 py-1 text-xs font-light tracking-wide text-text-secondary">{work.dateRange}</span>
        </div>

        <Markdown content={work.content} />
      </article>
    </SiteShell>
  );
}

export function ArticlesPage({ locale }: PageProps) {
  const messages = getMessages(locale);
  const posts = getArticles(locale);

  return (
    <SiteShell locale={locale} activePage="articles">
      <section className="mb-16">
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{messages.pages.articles.title}</h1>
        <p className="text-lg leading-relaxed text-text-secondary">{messages.pages.articles.description}</p>
      </section>

      <section className="mb-16">
        <div className="grid gap-6 sm:grid-cols-2">
          {posts.map((post) => (
            <ArticleCard key={post.slug} locale={locale} item={post} />
          ))}
        </div>
      </section>
    </SiteShell>
  );
}

export function ArticlePage({ locale, slug }: ArticlePageProps) {
  const messages = getMessages(locale);
  const profile = getProfile(locale);
  const post = getArticle(locale, slug);

  if (!post) {
    return null;
  }

  return (
    <SiteShell locale={locale} activePage="articles">
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          author: {
            '@type': 'Person',
            name: profile.name
          },
          mainEntityOfPage: localizedPath(locale, `/articles/${slug}`)
        }}
      />

      <section className="mb-16">
        <Link className="mb-6 inline-flex items-center gap-2 text-sm font-light tracking-wide text-accent transition-colors duration-250 hover:text-accent-hover" href={localizedPath(locale, '/articles')}>
          {messages.labels.backToArticles}
        </Link>
        <p className="mb-4 text-xs font-light uppercase tracking-widest text-text-muted">
          {post.dateLabel} · {post.readingTime}
        </p>
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{post.title}</h1>
        <p className="text-lg leading-relaxed text-text-secondary">{post.description}</p>
      </section>

      <article className="rounded-xl border border-line bg-bg-soft p-6 shadow-lg sm:p-10">
        <Markdown content={post.content} />
      </article>
    </SiteShell>
  );
}

export function ContactPage({ locale }: PageProps) {
  const messages = getMessages(locale);
  const profile = getProfile(locale);
  
  // Turnstile site key - should be moved to env variable in production
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

  return (
    <SiteShell locale={locale} activePage="contact">
      <section className="mb-16">
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{messages.pages.contact.title}</h1>
        <p className="text-lg leading-relaxed text-text-secondary">{messages.pages.contact.description}</p>
      </section>

      {/* Contact Form */}
      <section className="mb-16">
        <div className="rounded-xl border border-line bg-bg-soft p-8 shadow-lg">
          <h2 className="mb-6 text-2xl font-normal tracking-tight">{messages.pages.contact.formTitle}</h2>
          <ContactForm locale={locale} turnstileSiteKey={turnstileSiteKey} />
        </div>
      </section>

      {/* Alternative Contact Methods */}
      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-normal tracking-tight">{messages.pages.contact.alternativeTitle}</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-bg-soft p-6 shadow-lg transition-all duration-250 hover:border-line-bright">
            <p className="text-xs font-light uppercase tracking-widest text-text-muted">Email</p>
            <a href={`mailto:${profile.contact.email}`} className="text-xl font-normal tracking-tight text-accent transition-colors duration-300 hover:text-accent-hover">
              {profile.contact.email}
            </a>
            <p className="text-sm leading-relaxed text-text-secondary">{profile.contact.note}</p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-line bg-bg-soft p-6 shadow-lg transition-all duration-250 hover:border-line-bright">
            <p className="text-xs font-light uppercase tracking-widest text-text-muted">{messages.labels.publicLinks}</p>
            <div className="flex flex-col gap-2">
              {profile.publicLinks.map((link) => (
                <a className="text-sm text-accent transition-colors duration-300 hover:text-accent-hover" key={link.url} href={link.url} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

export function AboutPage({ locale }: PageProps) {
  const messages = getMessages(locale);
  const profile = getProfile(locale);

  return (
    <SiteShell locale={locale} activePage="about">
      <section className="mb-16">
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{messages.pages.about.title}</h1>
        <p className="mb-4 text-lg leading-relaxed text-text-secondary">{profile.summary}</p>
        <p className="text-lg leading-relaxed text-text-secondary">{profile.about}</p>
      </section>

      <section className="mb-16">
        <div className="mb-8">
          <h2 className="text-2xl font-normal tracking-tight">{messages.labels.skills}</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {profile.skills.map((group) => (
            <div key={group.group} className="flex flex-col gap-3 rounded-xl border border-line bg-bg-soft p-6 shadow-lg transition-all duration-250 hover:border-line-bright">
              <h3 className="text-xl font-normal tracking-tight">{group.group}</h3>
              <ul className="m-0 list-inside list-disc pl-0 text-text-secondary">
                {group.items.map((item) => (
                  <li key={item} className="text-sm leading-relaxed">{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
