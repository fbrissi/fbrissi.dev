import { Markdown } from '@/components/content/markdown';
import { StructuredData } from '@/components/content/structured-data';
import { SiteShell } from '@/components/layout/site-shell';
import { getArticle } from '@/lib/articles';
import { localizedPath, type Locale } from '@/lib/i18n';
import { getMessages, getProfile } from '@/lib/site';

export function ArticlePage({ locale, slug }: { locale: Locale; slug: string }) {
  const messages = getMessages(locale);
  const profile = getProfile(locale);
  const post = getArticle(locale, slug);
  if (!post) return null;

  return (
    <SiteShell locale={locale} activePage="articles">
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          author: { '@type': 'Person', name: profile.name },
          ...(post.image ? { image: post.image } : {}),
          mainEntityOfPage: localizedPath(locale, `/articles/${slug}`)
        }}
      />
      <section className="mb-16">
        <Link className="mb-6 inline-flex items-center gap-2 text-sm font-light tracking-wide text-accent transition-colors duration-250 hover:text-accent-hover" to={localizedPath(locale, '/articles')}>
          {messages.labels.backToArticles}
        </Link>
        <p className="mb-4 text-xs font-light uppercase tracking-widest text-text-muted">{post.dateLabel} · {post.readingTime}</p>
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{post.title}</h1>
        <p className="text-lg leading-relaxed text-text-secondary">{post.description}</p>
      </section>
      {post.image ? <img className="mb-8 aspect-video w-full rounded-xl border border-line object-cover shadow-lg" src={post.image} alt={post.imageAlt ?? ''} /> : null}
      <article className="rounded-xl border border-line bg-bg-soft p-6 shadow-lg sm:p-10">
        <Markdown content={post.content} />
      </article>
    </SiteShell>
  );
}
import { Link } from 'react-router';
