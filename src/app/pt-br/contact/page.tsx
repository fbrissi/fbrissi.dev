import { ContactPage } from '@/site-pages/contact-page';
import { createNextMetadata } from '@/lib/next-metadata';
import { getMessages } from '@/lib/site';

const messages = getMessages('pt-BR');
export const metadata = createNextMetadata({ locale: 'pt-BR', pathname: '/contact', title: `${messages.pages.contact.title} | ${messages.site.name}`, description: messages.pages.contact.description });

export default function Page() {
  return <ContactPage locale="pt-BR" turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} contactApiUrl={process.env.NEXT_PUBLIC_CONTACT_API_URL} />;
}
