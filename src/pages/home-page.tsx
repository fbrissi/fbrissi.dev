import portfolioImage from '@/assets/images/portifolio.png';
import { ArticleCard, ProjectCard, WorksCard } from '@/components/content/content-cards';
import { Markdown } from '@/components/content/markdown';
import { StructuredData } from '@/components/content/structured-data';
import { ViewAllLink } from '@/components/content/view-all-link';
import { SiteShell } from '@/components/layout/site-shell';
import { getArticles } from '@/lib/articles';
import { localizedPath, type Locale } from '@/lib/i18n';
import { getProjects } from '@/lib/projects';
import { getMessages, getProfile } from '@/lib/site';
import { getWorks } from '@/lib/works';

export function HomePage({ locale }: { locale: Locale }) {
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
        <img
          className="mb-10 w-full rounded-xl border border-line shadow-xl"
          src={portfolioImage}
          alt={locale === 'pt-BR' ? 'Tecnologias e áreas de atuação de Filipe' : "Filipe's engineering technologies and focus areas"}
        />
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{profile.headline}</h1>
        <div className="mb-8">
          <Markdown content={profile.about} />
        </div>
        <p className="mb-4 text-lg leading-relaxed text-text-secondary">
          {messages.home.eyebrow} {profile.location}.
        </p>
        <p className="text-lg leading-relaxed text-text-secondary">
          {messages.home.findMeOn}{' '}
          {profile.publicLinks.slice(0, 2).map((link, index) => (
            <span key={link.url}>
              {index > 0 && ` ${messages.home.linkConjunction} `}
              <a className="text-accent transition-colors duration-300 hover:text-accent-hover" href={link.url} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            </span>
          ))}.
        </p>
      </section>

      <div className="mb-16 flex justify-center">
        <a href="https://commit-history.com/fbrissi">
          <picture>
            <source media="(prefers-color-scheme: dark)" srcSet="https://commit-history.com/embed/fbrissi?theme=dark" />
            <img className="max-w-full" alt="fbrissi's commit history" src="https://commit-history.com/embed/fbrissi" loading="lazy" />
          </picture>
        </a>
      </div>

      <section className="mb-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-normal tracking-tight">{messages.labels.featuredProjects}</h2>
          <ViewAllLink href={localizedPath(locale, '/projects')} label={messages.labels.viewAllProjects} />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featuredProjects.map((project) => <ProjectCard key={project.slug} locale={locale} item={project} />)}
        </div>
      </section>

      {featuredWorks.length > 0 && (
        <section className="mb-16">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-normal tracking-tight">{messages.labels.experience}</h2>
            <ViewAllLink href={localizedPath(locale, '/works')} label={messages.labels.viewAllWorks} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredWorks.map((item) => <WorksCard key={item.slug} locale={locale} item={item} />)}
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
            {posts.map((post) => <ArticleCard key={post.slug} locale={locale} item={post} />)}
          </div>
        </section>
      )}
    </SiteShell>
  );
}
