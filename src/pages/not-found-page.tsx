import { Link } from 'react-router';

import { SiteShell } from '@/components/layout/site-shell';
import { localizedPath, type Locale } from '@/lib/i18n';

export function NotFoundPage({ locale }: { locale: Locale }) {
  const isPortuguese = locale === 'pt-BR';
  return (
    <SiteShell locale={locale} activePage="home">
      <section className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <p className="text-sm font-light uppercase tracking-widest text-text-muted">404</p>
        <h1 className="text-4xl font-normal tracking-tight sm:text-6xl">{isPortuguese ? 'Página não encontrada' : 'Page not found'}</h1>
        <p className="text-lg text-text-secondary">{isPortuguese ? 'A página solicitada não existe.' : 'The page you requested does not exist.'}</p>
        <Link className="mt-4 inline-flex items-center gap-2 rounded-lg border border-accent bg-accent px-6 py-3 font-light tracking-wide text-white transition-all duration-250 hover:bg-accent-hover hover:shadow-lg" to={localizedPath(locale, '/')}>
          {isPortuguese ? 'Voltar para o início' : 'Back home'}
        </Link>
      </section>
    </SiteShell>
  );
}
