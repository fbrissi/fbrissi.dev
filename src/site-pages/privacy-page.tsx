import { Markdown } from '@/components/content/markdown';
import { StructuredData } from '@/components/content/structured-data';
import { SiteShell } from '@/components/layout/site-shell';
import { CookieNotice } from '@/features/study-group/cookie-notice';
import type { Locale } from '@/lib/i18n';
import { getMessages } from '@/lib/site';
import { breadcrumbList } from '@/lib/structured-data';
import { getProgramDocument, programPaths } from '@/lib/study-groups';

/** Site-wide Privacy Policy (contact form and the study groups program), versioned with the program's consent (D-7). */
export function PrivacyPage({ locale }: { locale: Locale }) {
  const messages = getMessages(locale).studyGroups;
  const { title, version, content } = getProgramDocument(locale, 'privacy');

  return (
    <SiteShell locale={locale} activePage="privacy" pathname={programPaths.privacy}>
      <StructuredData data={breadcrumbList(locale, [{ name: title, path: programPaths.privacy }])} />
      <article className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-3xl font-normal tracking-tight sm:text-5xl">{title}</h1>
        <p className="mb-10 text-sm text-text-muted">{messages.policyVersion} {version}</p>
        <Markdown content={content} />
      </article>
      <CookieNotice locale={locale} />
    </SiteShell>
  );
}
