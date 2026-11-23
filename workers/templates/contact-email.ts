import type { ContactMessage } from '../contact-message';
import { environmentBadge, renderEmailHtml, renderEmailText, type EmailContent } from './email-layout';

interface ContactEmailTemplateOptions {
  isLocal: boolean;
  isSandbox?: boolean;
}

export function contactEmailSubject({ subject }: ContactMessage, { isLocal, isSandbox = false }: ContactEmailTemplateOptions): string {
  const environment = isLocal ? 'LOCAL' : isSandbox ? 'SANDBOX' : '';
  return `[Contact Form${environment ? ` - ${environment}` : ''}] ${subject}`;
}

function contactEmail(
  { name, email, subject, message }: ContactMessage,
  { isLocal, isSandbox = false }: ContactEmailTemplateOptions
): EmailContent {
  const siteUrl = isLocal ? 'http://localhost:3000' : 'https://fbrissi.dev';
  const contactUrl = `${siteUrl}/contact`;
  const environment = isLocal ? ' (LOCAL DEVELOPMENT)' : isSandbox ? ' (SANDBOX)' : '';
  return {
    lang: 'en',
    siteUrl,
    heading: 'New Contact Form Submission',
    badge: environmentBadge(isLocal ? 'local' : isSandbox ? 'sandbox' : 'production'),
    textHeading: `New contact form submission from fbrissi.dev${environment}`,
    blocks: [
      { kind: 'fields', rows: [{ label: 'Name', value: name }, { label: 'Email', value: email, href: `mailto:${email}` }, { label: 'Subject', value: subject }] },
      { kind: 'message', label: 'Message', text: message },
    ],
    footer: { text: 'This message was sent via the contact form at', links: [{ label: contactUrl, url: contactUrl }], separator: '---' },
  };
}

export function contactEmailText(message: ContactMessage, options: ContactEmailTemplateOptions): string {
  return renderEmailText(contactEmail(message, options));
}

export function contactEmailHtml(message: ContactMessage, options: ContactEmailTemplateOptions): string {
  return renderEmailHtml(contactEmail(message, options));
}
