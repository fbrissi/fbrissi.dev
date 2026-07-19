import { Markdown } from '@/components/content/markdown';
import { SiteShell } from '@/components/layout/site-shell';
import type { Locale } from '@/lib/i18n';
import { getMessages, getProfile } from '@/lib/site';

export function AboutPage({ locale }: { locale: Locale }) {
  const messages = getMessages(locale);
  const profile = getProfile(locale);
  return (
    <SiteShell locale={locale} activePage="about">
      <section className="mb-16">
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{messages.pages.about.title}</h1>
        <Markdown content={profile.about} />
      </section>
      <section className="mb-16">
        <div className="mb-8"><h2 className="text-2xl font-normal tracking-tight">{messages.labels.skills}</h2></div>
        <div className="grid gap-6 sm:grid-cols-2">
          {profile.skills.map((group) => (
            <div key={group.group} className="flex flex-col gap-3 rounded-xl border border-line bg-bg-soft p-6 shadow-lg transition-all duration-250 hover:border-line-bright">
              <h3 className="text-xl font-normal tracking-tight">{group.group}</h3>
              <ul className="m-0 list-inside list-disc pl-0 text-text-secondary">
                {group.items.map((item) => <li key={item} className="text-sm leading-relaxed">{item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
