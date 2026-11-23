import { Markdown } from '@/components/content/markdown';
import { StructuredData } from '@/components/content/structured-data';
import { SiteShell } from '@/components/layout/site-shell';
import type { Locale } from '@/lib/i18n';
import { getMessages, getProfile } from '@/lib/site';
import { pageUrl, personNode, websiteId } from '@/lib/structured-data';

const cardClass = 'flex flex-col gap-3 rounded-xl border border-line bg-bg-soft p-6 shadow-lg transition-all duration-250 hover:border-line-bright';

export function AboutPage({ locale }: { locale: Locale }) {
  const messages = getMessages(locale);
  const profile = getProfile(locale);
  return (
    <SiteShell locale={locale} activePage="about">
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          url: pageUrl(locale, '/about'),
          name: `${messages.pages.about.title} | ${profile.name}`,
          inLanguage: locale,
          isPartOf: { '@id': websiteId },
          mainEntity: personNode(locale)
        }}
      />
      <section className="mb-16">
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{messages.pages.about.title}</h1>
        <Markdown content={profile.about} />
      </section>
      <section className="mb-16 grid gap-6 sm:grid-cols-2">
        <div className={cardClass}>
          <h2 className="text-xl font-normal tracking-tight">{messages.labels.languages}</h2>
          <ul className="m-0 list-inside list-disc pl-0 text-text-secondary">
            {profile.languages.map((language) => <li key={language} className="text-sm leading-relaxed">{language}</li>)}
          </ul>
        </div>
        <div className={cardClass}>
          <h2 className="text-xl font-normal tracking-tight">{messages.labels.credentials}</h2>
          <ul className="m-0 list-inside list-disc pl-0 text-text-secondary">
            {profile.credentials.map((credential) => <li key={credential} className="text-sm leading-relaxed">{credential}</li>)}
          </ul>
        </div>
      </section>
      <section className="mb-16">
        <div className="mb-8"><h2 className="text-2xl font-normal tracking-tight">{messages.labels.skills}</h2></div>
        <div className="grid gap-6 sm:grid-cols-2">
          {profile.skills.map((group) => (
            <div key={group.group} className={cardClass}>
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
