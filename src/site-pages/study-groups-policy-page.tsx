import { SiteShell } from '@/components/layout/site-shell';
import { Markdown } from '@/components/content/markdown';
import { CookieNotice } from '@/features/study-group/cookie-notice';
import { localizedPath, type Locale } from '@/lib/i18n';
import { getMessages } from '@/lib/site';
import { getProgramDocument, programPaths, type ProgramDocumentName } from '@/lib/study-groups';

/** Versioned Terms of Use (with the content policy) and Privacy Policy of the program, indexed in both locales (D1, Q1). */
export function StudyGroupsPolicyPage({ locale, document }: { locale: Locale; document: ProgramDocumentName }) {
  const messages = getMessages(locale).studyGroups;
  const { title, version, content } = getProgramDocument(locale, document);

  return (
    <SiteShell locale={locale} activePage="studyGroups" pathname={programPaths[document]}>
      <article className="mx-auto max-w-3xl">
        <a className="text-sm text-accent hover:text-accent-hover" href={localizedPath(locale, programPaths.landing)}>← {messages.backToProgram}</a>
        <h1 className="mb-2 mt-6 text-3xl font-normal tracking-tight sm:text-5xl">{title}</h1>
        <p className="mb-10 text-sm text-text-muted">{messages.policyVersion} {version}</p>
        <Markdown content={content} />
      </article>
      <CookieNotice locale={locale} />
    </SiteShell>
  );
}
