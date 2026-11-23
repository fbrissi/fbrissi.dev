import { Markdown } from '@/components/content/markdown';
import { StructuredData } from '@/components/content/structured-data';
import { SiteShell } from '@/components/layout/site-shell';
import { getArticle, getArticleTranslationSlug } from '@/lib/articles';
import { localizedPath, type Locale } from '@/lib/i18n';
import { absoluteUrl } from '@/lib/seo';
import { getMessages } from '@/lib/site';
import { breadcrumbList, pageUrl, personNode } from '@/lib/structured-data';

export function ArticlePage({ locale, slug }: { locale: Locale; slug: string }) {
  const messages = getMessages(locale);
  const post = getArticle(locale, slug);
  if (!post) return null;
  const translationSlug = getArticleTranslationSlug(locale, slug);
  const image = post.socialImage ?? post.image;

  return (
    <SiteShell locale={locale} activePage="articles" pathname={`/articles/${slug}`} alternatePathname={translationSlug ? `/articles/${translationSlug}` : '/articles'}>
      <StructuredData
        data={[
          {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            dateModified: post.updated ?? post.date,
            inLanguage: locale,
            author: personNode(locale),
            publisher: personNode(locale),
            ...(image ? { image: absoluteUrl(image) } : {}),
            mainEntityOfPage: pageUrl(locale, `/articles/${slug}`)
          },
          breadcrumbList(locale, [{ name: messages.pages.articles.title, path: '/articles' }, { name: post.title, path: `/articles/${slug}` }])
        ]}
      />
      <section className="mb-16">
        <Link className="mb-6 inline-flex items-center gap-2 text-sm font-light tracking-wide text-accent transition-colors duration-250 hover:text-accent-hover" href={localizedPath(locale, '/articles')}>
          {messages.labels.backToArticles}
        </Link>
        <p className="mb-4 text-sm text-text-muted">{post.dateLabel} · {post.readingTime}</p>
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{post.title}</h1>
        <p className="text-lg leading-relaxed text-text-secondary">{post.description}</p>
      </section>
      {post.image ? <img className="mb-8 aspect-video w-full rounded-xl border border-line object-cover shadow-lg" src={post.image} alt={post.imageAlt ?? ''} width={1600} height={900} decoding="async" /> : null}
      <article className="rounded-xl border border-line bg-bg-soft p-6 shadow-lg sm:p-10">
        <Markdown content={post.content} />
      </article>
    </SiteShell>
  );
}
import Link from 'next/link';
