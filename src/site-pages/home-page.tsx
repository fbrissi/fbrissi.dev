import Link from 'next/link';

import { ArticleCard, ProjectCard, WorksCard } from '@/components/content/content-cards';
import { ContributionCard } from '@/components/content/contribution-card';
import { StructuredData } from '@/components/content/structured-data';
import { ViewAllLink } from '@/components/content/view-all-link';
import { SiteShell } from '@/components/layout/site-shell';
import { getArticles } from '@/lib/articles';
import { getContributions } from '@/lib/contributions';
import { localizedPath, type Locale } from '@/lib/i18n';
import { getProjects } from '@/lib/projects';
import { getMessages, getProfile } from '@/lib/site';
import { pageUrl, personId, personNode, websiteId } from '@/lib/structured-data';
import { getWorks } from '@/lib/works';

const notaProfileSignupUrl = (locale: Locale) => `https://app.notaprofile.com.br/cadastro?utm_source=fbrissi.dev&utm_medium=referral&utm_campaign=portfolio&utm_content=home-featured-${locale.toLowerCase()}`;
// Nota Profile has its own featured card, so the projects grid skips it (it still leads /projects).
const featuredCardSlug = 'notaprofile';
const resumeFiles = { en: '/resume/filipe-bojikian-rissi-resume-en.pdf', 'pt-BR': '/resume/filipe-bojikian-rissi-curriculo-pt-br.pdf' } as const;

const primaryButtonClass = 'inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm tracking-wide text-bg transition-all duration-250 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent-glow';
const secondaryButtonClass = 'inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm tracking-wide text-text-secondary transition-colors duration-250 hover:border-line-bright hover:text-text';

export function HomePage({ locale }: { locale: Locale }) {
  const messages = getMessages(locale);
  const profile = getProfile(locale);
  const posts = getArticles(locale).slice(0, 6);
  const featuredProjects = getProjects(locale).filter((project) => project.slug !== featuredCardSlug).slice(0, 6);
  const featuredContributions = getContributions(locale).filter((contribution) => contribution.featured).slice(0, 4);
  const featuredWorks = getWorks(locale).slice(0, 6);

  return (
    <SiteShell locale={locale} activePage="home">
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              ...personNode(locale),
              description: profile.summary,
              address: { '@type': 'PostalAddress', addressLocality: 'Bauru', addressRegion: 'SP', addressCountry: 'BR' },
              knowsAbout: ['Java', 'Kotlin', 'Go', 'AWS', 'Kubernetes', 'Terraform', 'Keycloak', 'Open Finance']
            },
            {
              '@type': 'WebSite',
              '@id': websiteId,
              url: pageUrl(locale, '/'),
              name: messages.site.name,
              description: messages.site.description,
              inLanguage: locale,
              publisher: { '@id': personId }
            }
          ]
        }}
      />

      <section className="mb-16 max-w-4xl">
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{messages.home.title}</h1>
        <p className="mb-8 text-lg leading-relaxed text-text-secondary">{messages.home.subhead}</p>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link className={primaryButtonClass} href={localizedPath(locale, '/works')}>{messages.home.ctaPrimary}</Link>
          <Link className={secondaryButtonClass} href={localizedPath(locale, '/contact')}>{messages.home.ctaSecondary}</Link>
          <a className={secondaryButtonClass} href={resumeFiles[locale]} download>{messages.home.ctaResume}</a>
        </div>
        <p className="text-text-secondary">
          <Link className="text-accent transition-colors duration-300 hover:text-accent-hover" href={localizedPath(locale, '/about')}>{messages.home.aboutLink}</Link>
          {' · '}
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

      <section className="mb-16" aria-labelledby="proof-title">
        <h2 id="proof-title" className="mb-6 text-2xl font-normal tracking-tight">{messages.home.proofTitle}</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {messages.home.proofPoints.map((point) => (
            <li key={point.path}>
              <Link className="flex h-full rounded-xl border border-line bg-bg-soft p-5 leading-relaxed text-text-secondary shadow-lg transition-all duration-250 hover:border-line-bright hover:text-text" href={localizedPath(locale, point.path)}>
                {point.text}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-16 rounded-xl border border-line bg-bg-soft p-6 shadow-lg sm:p-10" aria-labelledby="featured-product-title">
        <p className="mb-3 text-xs font-light uppercase tracking-widest text-accent">{messages.home.featuredProduct.eyebrow}</p>
        <h2 id="featured-product-title" className="mb-4 text-2xl font-normal tracking-tight sm:text-3xl">{messages.home.featuredProduct.title}</h2>
        <p className="mb-8 max-w-3xl text-lg leading-relaxed text-text-secondary">{messages.home.featuredProduct.pitch}</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <a className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-light tracking-wide text-bg transition-all duration-250 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent-glow" href={notaProfileSignupUrl(locale)} target="_blank" rel="noopener noreferrer">
            {messages.home.featuredProduct.cta}<span aria-hidden="true">↗</span>
          </a>
          <Link className="text-sm font-light tracking-wide text-accent transition-colors duration-250 hover:text-accent-hover" href={localizedPath(locale, `/projects/${featuredCardSlug}`)}>
            {messages.home.featuredProduct.details}
          </Link>
        </div>
      </section>

      <section className="mb-16 rounded-xl border border-line bg-bg-soft p-6 shadow-lg sm:p-10" aria-labelledby="study-groups-title">
        <h2 id="study-groups-title" className="mb-4 text-2xl font-normal tracking-tight">{messages.home.studyGroups.title}</h2>
        <p className="mb-6 max-w-3xl leading-relaxed text-text-secondary">{messages.home.studyGroups.text}</p>
        <ViewAllLink href={localizedPath(locale, '/study-groups')} label={messages.home.studyGroups.cta} />
      </section>

      <section className="mb-16">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-normal tracking-tight">{messages.labels.featuredProjects}</h2>
          <ViewAllLink href={localizedPath(locale, '/projects')} label={messages.labels.viewAllProjects} />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featuredProjects.map((project) => <ProjectCard key={project.slug} locale={locale} item={project} />)}
        </div>
      </section>

      {featuredContributions.length > 0 && (
        <section className="mb-16">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-normal tracking-tight">{messages.labels.featuredContributions}</h2>
            <ViewAllLink href={`${localizedPath(locale, '/projects')}#open-source`} label={messages.labels.viewAllContributions} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            {featuredContributions.map((contribution) => <ContributionCard key={contribution.slug} locale={locale} item={contribution} />)}
          </div>
        </section>
      )}

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
