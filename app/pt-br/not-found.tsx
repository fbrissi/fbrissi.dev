import Link from 'next/link';

import { SiteShell } from '@/components/site-shell';
import { localizedPath } from '@/lib/i18n';

export default function NotFound() {
  return (
    <SiteShell locale="pt-BR" activePage="home">
      <section className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <p className="text-sm font-light uppercase tracking-widest text-text-muted">404</p>
        <h1 className="text-4xl font-normal tracking-tight sm:text-6xl">Página não encontrada</h1>
        <p className="text-lg text-text-secondary">A página solicitada não existe.</p>
        <div className="mt-4">
          <Link 
            className="inline-flex items-center gap-2 rounded-lg border border-accent bg-accent px-6 py-3 font-light tracking-wide text-white transition-all duration-250 hover:bg-accent-hover hover:shadow-lg" 
            href={localizedPath('pt-BR', '/')}
          >
            Voltar para o início
          </Link>
        </div>
      </section>
    </SiteShell>
  );
}
