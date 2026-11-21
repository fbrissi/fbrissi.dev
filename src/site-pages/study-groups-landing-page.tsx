import { StructuredData } from '@/components/content/structured-data';
import { SiteShell } from '@/components/layout/site-shell';
import { CookieNotice } from '@/features/study-group/cookie-notice';
import { GroupDirectory, ProgramActions } from '@/features/study-group/program-landing';
import { SessionProvider } from '@/features/study-group/session';
import { localizedPath, type Locale } from '@/lib/i18n';
import { getMessages } from '@/lib/site';
import { breadcrumbList, pageUrl, personId, personNode, websiteId } from '@/lib/structured-data';
import { programPaths } from '@/lib/study-groups';

const sectionTitleClass = 'mb-6 text-2xl font-normal tracking-tight sm:text-3xl';

/** Public, indexed program page (D1): why practice in groups, how it works, starting a group, the listed groups and a FAQ. */
export function StudyGroupsLandingPage({ locale, apiUrl }: { locale: Locale; apiUrl?: string }) {
  const allMessages = getMessages(locale);
  const messages = allMessages.studyGroups;
  const url = pageUrl(locale, programPaths.landing);
  // WebPage and BreadcrumbList only: the group list is client-rendered and the program is not a course or an event.
  const { '@context': context, ...breadcrumb } = breadcrumbList(locale, [{ name: allMessages.nav.englishGroups, path: programPaths.landing }]);
  const structuredData = {
    '@context': context,
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: messages.title,
        description: messages.seoDescription,
        inLanguage: locale,
        isPartOf: { '@id': websiteId },
        about: { '@type': 'Thing', name: locale === 'pt-BR' ? 'Prática de inglês para desenvolvedores de software' : 'English language practice for software developers' },
        author: personNode(locale),
        publisher: { '@id': personId },
        breadcrumb: { '@id': `${url}#breadcrumb` }
      },
      { ...breadcrumb, '@id': `${url}#breadcrumb` }
    ]
  };

  return (
    <SiteShell locale={locale} activePage="studyGroups" pathname={programPaths.landing}>
      <StructuredData data={structuredData} />
      <SessionProvider apiUrl={apiUrl}>
        <section className="mb-16 flex flex-col gap-6">
          <h1 className="text-3xl font-normal tracking-tight sm:text-5xl">{messages.title}</h1>
          <p className="max-w-3xl text-lg leading-relaxed text-text-secondary">{messages.intro}</p>
          {messages.appLanguageNote ? <p className="max-w-3xl leading-relaxed text-text-secondary">{messages.appLanguageNote}</p> : null}
          <ProgramActions locale={locale} />
        </section>
        <section className="mb-16" aria-labelledby="why-title">
          <h2 id="why-title" className={sectionTitleClass}>{messages.whyTitle}</h2>
          <p className="mb-6 max-w-3xl leading-relaxed text-text-secondary">{messages.whyIntro}</p>
          <ul className="grid gap-4 sm:grid-cols-2">
            {messages.why.map((item) => <li key={item} className="rounded-xl border border-line bg-bg-soft p-5 leading-relaxed text-text-secondary shadow-lg">{item}</li>)}
          </ul>
        </section>
        <section className="mb-16" aria-labelledby="how-title">
          <h2 id="how-title" className={sectionTitleClass}>{messages.howTitle}</h2>
          <ol className="grid list-decimal gap-3 pl-6 leading-relaxed text-text-secondary marker:text-accent">
            {messages.how.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </section>
        <section className="mb-16" aria-labelledby="start-title">
          <h2 id="start-title" className={sectionTitleClass}>{messages.startTitle}</h2>
          <p className="max-w-3xl leading-relaxed text-text-secondary">{messages.startText}</p>
        </section>
        <section className="mb-16" aria-labelledby="groups-title">
          <h2 id="groups-title" className={sectionTitleClass}>{messages.groupsTitle}</h2>
          <p className="mb-6 max-w-3xl text-text-secondary">{messages.groupsIntro}</p>
          <GroupDirectory locale={locale} />
          <noscript><p className="text-text-secondary">{messages.groupsNoScript}</p></noscript>
        </section>
      </SessionProvider>
      <section className="mb-16" aria-labelledby="faq-title">
        <h2 id="faq-title" className={sectionTitleClass}>{messages.faqTitle}</h2>
        <div className="flex max-w-3xl flex-col gap-6">
          {messages.faq.map((item) => (
            <div key={item.q}>
              <h3 className="mb-2 text-xl font-normal tracking-tight">{item.q}</h3>
              <p className="leading-relaxed text-text-secondary">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mb-16" aria-labelledby="policies-title">
        <h2 id="policies-title" className={sectionTitleClass}>{messages.policiesTitle}</h2>
        <p className="mb-4 max-w-3xl text-text-secondary">{messages.policiesText}</p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li><a className="text-accent hover:text-accent-hover" href={localizedPath(locale, programPaths.terms)}>{messages.terms}</a></li>
          <li><a className="text-accent hover:text-accent-hover" href={`${localizedPath(locale, programPaths.terms)}#content-policy`}>{messages.contentPolicy}</a></li>
          <li><a className="text-accent hover:text-accent-hover" href={localizedPath(locale, programPaths.privacy)}>{messages.privacy}</a></li>
          <li><a className="text-accent hover:text-accent-hover" href={localizedPath(locale, '/contact')}>{messages.contact}</a></li>
        </ul>
      </section>
      <CookieNotice locale={locale} />
    </SiteShell>
  );
}
