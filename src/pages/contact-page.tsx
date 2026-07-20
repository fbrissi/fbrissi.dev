import { SiteShell } from '@/components/layout/site-shell';
import { ContactForm } from '@/features/contact/contact-form';
import type { Locale } from '@/lib/i18n';
import { getMessages, getProfile } from '@/lib/site';

export function ContactPage({ locale }: { locale: Locale }) {
  const messages = getMessages(locale);
  const profile = getProfile(locale);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';

  return (
    <SiteShell locale={locale} activePage="contact">
      <section className="mb-16">
        <h1 className="mb-6 text-3xl font-normal tracking-tight sm:text-5xl">{messages.pages.contact.title}</h1>
        <p className="text-lg leading-relaxed text-text-secondary">{messages.pages.contact.description}</p>
      </section>
      <section className="mb-16">
        <div className="rounded-xl border border-line bg-bg-soft p-8 shadow-lg">
          <h2 className="mb-6 text-2xl font-normal tracking-tight">{messages.pages.contact.formTitle}</h2>
          <ContactForm locale={locale} turnstileSiteKey={turnstileSiteKey} />
        </div>
      </section>
      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-normal tracking-tight">{messages.pages.contact.alternativeTitle}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-bg-soft p-6 shadow-lg transition-all duration-250 hover:border-line-bright">
            <p className="text-xs font-light uppercase tracking-widest text-text-muted">Email</p>
            <a href={`mailto:${profile.contact.email}`} className="text-xl font-normal tracking-tight text-accent transition-colors duration-300 hover:text-accent-hover">{profile.contact.email}</a>
            <p className="text-sm leading-relaxed text-text-secondary">{profile.contact.note}</p>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-bg-soft p-6 shadow-lg transition-all duration-250 hover:border-line-bright">
            <p className="text-xs font-light uppercase tracking-widest text-text-muted">WhatsApp</p>
            <a href={profile.contact.whatsapp.url} target="_blank" rel="noreferrer" className="text-xl font-normal tracking-tight text-accent transition-colors duration-300 hover:text-accent-hover">{profile.contact.whatsapp.phone}</a>
            <p className="text-sm leading-relaxed text-text-secondary">{profile.contact.whatsapp.note}</p>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-bg-soft p-6 shadow-lg transition-all duration-250 hover:border-line-bright">
            <p className="text-xs font-light uppercase tracking-widest text-text-muted">{messages.labels.publicLinks}</p>
            <div className="flex flex-col gap-2">
              {profile.publicLinks.filter((link) => link.label !== 'WhatsApp').map((link) => <a className="text-sm text-accent transition-colors duration-300 hover:text-accent-hover" key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>)}
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
