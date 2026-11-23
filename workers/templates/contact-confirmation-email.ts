import type { ContactMessage } from '../contact-message';
import { renderEmailHtml, renderEmailText, type EmailContent } from './email-layout';

interface ContactConfirmationEmailTemplateOptions {
  isLocal: boolean;
  isSandbox?: boolean;
}

const copy = {
  en: {
    subject: (subject: string, isLocal: boolean, isSandbox: boolean) => `Re: ${subject}${isLocal ? ' [LOCAL]' : isSandbox ? ' [SANDBOX]' : ''}`,
    greeting: (name: string) => `Hi ${name},`,
    body: (subject: string) => `Thanks for getting in touch. I received your message about "${subject}" and will reply as soon as possible.`,
    regards: 'Best regards,',
    footer: 'This is an automated confirmation from no-reply@fbrissi.dev. Replies to this email are not monitored.',
    localNote: 'This confirmation was sent from local development.',
  },
  'pt-BR': {
    subject: (subject: string, isLocal: boolean, isSandbox: boolean) => `Re: ${subject}${isLocal ? ' [LOCAL]' : isSandbox ? ' [SANDBOX]' : ''}`,
    greeting: (name: string) => `Olá ${name},`,
    body: (subject: string) => `Obrigado por entrar em contato. Recebi sua mensagem sobre "${subject}" e responderei assim que possível.`,
    regards: 'Atenciosamente,',
    footer: 'Esta é uma confirmação automática de no-reply@fbrissi.dev. Respostas a este e-mail não são monitoradas.',
    localNote: 'Esta confirmação foi enviada do ambiente de desenvolvimento local.',
  },
} as const;

export function contactConfirmationEmailSubject(
  { subject, locale }: ContactMessage,
  { isLocal, isSandbox = false }: ContactConfirmationEmailTemplateOptions
): string {
  return copy[locale].subject(subject, isLocal, isSandbox);
}

function confirmationEmail(
  { name, subject, locale }: ContactMessage,
  { isLocal, isSandbox = false }: ContactConfirmationEmailTemplateOptions
): EmailContent {
  const t = copy[locale];
  const siteUrl = isLocal ? 'http://localhost:3000' : 'https://fbrissi.dev';
  const note = isLocal ? t.localNote : isSandbox ? 'This confirmation was sent from the sandbox environment.' : null;
  return {
    lang: locale,
    siteUrl,
    blocks: [
      { kind: 'paragraph', text: t.greeting(name) },
      { kind: 'paragraph', text: t.body(subject) },
      {
        kind: 'signature',
        avatarSize: 120,
        lines: [
          { text: t.regards, style: 'regards' },
          { text: 'Filipe Bojikian Rissi', style: 'name' },
          { text: 'Backend & Cloud Engineer', style: 'title' },
          { text: 'Cloud Architecture • Distributed Systems • Kubernetes • AWS • Microservices', style: 'detail' },
        ],
        links: [{ label: 'contact@fbrissi.dev', url: 'mailto:contact@fbrissi.dev' }, { label: 'fbrissi.dev', url: `${siteUrl}/` }],
      },
      ...(note ? [{ kind: 'note' as const, text: note }] : []),
    ],
    footer: { text: t.footer },
  };
}

export function contactConfirmationEmailText(message: ContactMessage, options: ContactConfirmationEmailTemplateOptions): string {
  return renderEmailText(confirmationEmail(message, options));
}

export function contactConfirmationEmailHtml(message: ContactMessage, options: ContactConfirmationEmailTemplateOptions): string {
  return renderEmailHtml(confirmationEmail(message, options));
}
