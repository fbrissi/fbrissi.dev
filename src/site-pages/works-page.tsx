import { WorksCard } from '@/components/content/content-cards';
import { SiteShell } from '@/components/layout/site-shell';
import type { Locale } from '@/lib/i18n';
import { getMessages } from '@/lib/site';
import { getWorks } from '@/lib/works';

export function WorksPage({ locale }: { locale: Locale }) {
  const messages = getMessages(locale);
  const works = getWorks(locale);
  return (
    <SiteShell locale={locale} activePage="works">
      <section className="mb-16">
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{messages.pages.works.title}</h1>
        <p className="text-lg leading-relaxed text-text-secondary">{messages.pages.works.description}</p>
      </section>
      <section className="mb-16">
        <div className="mb-8"><h2 className="text-2xl font-normal tracking-tight">{messages.labels.experience}</h2></div>
        <div className="grid gap-6 sm:grid-cols-2">
          {works.map((item) => <WorksCard key={item.slug} locale={locale} item={item} />)}
        </div>
      </section>
    </SiteShell>
  );
}
