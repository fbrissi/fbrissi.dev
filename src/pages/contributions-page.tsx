import { ContributionCard } from '@/components/content/contribution-card';
import { SiteShell } from '@/components/layout/site-shell';
import { getContributions } from '@/lib/contributions';
import type { Locale } from '@/lib/i18n';
import { getMessages } from '@/lib/site';

export function ContributionsPage({ locale }: { locale: Locale }) {
  const messages = getMessages(locale);
  const contributions = getContributions(locale);

  return (
    <SiteShell locale={locale} activePage="openSource">
      <section className="mb-16 max-w-3xl">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-accent">{messages.pages.openSource.eyebrow}</p>
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{messages.pages.openSource.title}</h1>
        <p className="text-lg leading-relaxed text-text-secondary">{messages.pages.openSource.description}</p>
      </section>
      <section className="mb-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {contributions.map((contribution) => <ContributionCard key={contribution.slug} locale={locale} item={contribution} />)}
      </section>
    </SiteShell>
  );
}
