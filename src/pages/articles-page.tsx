import { ArticleCard } from '@/components/content/content-cards';
import { SiteShell } from '@/components/layout/site-shell';
import { getArticles } from '@/lib/articles';
import type { Locale } from '@/lib/i18n';
import { getMessages } from '@/lib/site';

export function ArticlesPage({ locale }: { locale: Locale }) {
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
          {posts.map((post) => <ArticleCard key={post.slug} locale={locale} item={post} />)}
        </div>
      </section>
    </SiteShell>
  );
}
