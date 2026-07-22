import type { ContactMessage } from '../contact-message';

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

export function contactConfirmationEmailText(
  { name, subject, locale }: ContactMessage,
  { isLocal, isSandbox = false }: ContactConfirmationEmailTemplateOptions
): string {
  const t = copy[locale];
  const environmentNote = isLocal
    ? `\n\n(${t.localNote})`
    : isSandbox
      ? '\n\n(This confirmation was sent from the sandbox environment.)'
      : '';

  return `${t.greeting(name)}

${t.body(subject)}

${t.regards}

Filipe Bojikian Rissi
Staff Software Engineer

Cloud Architecture • Distributed Systems • Kubernetes • AWS • Microservices

contact@fbrissi.dev
https://fbrissi.dev/
${environmentNote}
${t.footer}`;
}

export function contactConfirmationEmailHtml(
  { name, subject, locale }: ContactMessage,
  { isLocal, isSandbox = false }: ContactConfirmationEmailTemplateOptions
): string {
  const t = copy[locale];
  const siteUrl = isLocal ? 'http://localhost:3000' : 'https://fbrissi.dev';
  const avatarUrl = `${siteUrl}/images/avatar.png`;
  const environmentNote = isLocal
    ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#666666;">${t.localNote}</p>`
    : isSandbox
      ? '<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#666666;">This confirmation was sent from the sandbox environment.</p>'
      : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#ffffff;">
    <tr>
      <td style="padding:24px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222222;">
        <p style="margin:0 0 16px;">${t.greeting(escapeHtml(name))}</p>
        <p style="margin:0 0 28px;">${t.body(`&quot;${escapeHtml(subject)}&quot;`)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td valign="middle" style="padding:0 20px 0 0;">
              <img src="${avatarUrl}" alt="Filipe Bojikian Rissi" width="120" height="120" style="display:block;width:120px;height:auto;border:0;outline:none;text-decoration:none;">
            </td>
            <td valign="middle" style="padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.45;color:#222222;">
              <p style="margin:0 0 10px;font-size:14px;line-height:1.4;color:#222222;">${t.regards}</p>
              <p style="margin:0 0 2px;font-size:18px;line-height:1.3;font-weight:700;color:#111111;">Filipe Bojikian Rissi</p>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.4;color:#444444;">Staff Software Engineer</p>
              <p style="margin:0 0 12px;font-size:13px;line-height:1.45;color:#555555;">Cloud Architecture • Distributed Systems • Kubernetes • AWS • Microservices</p>
              <p style="margin:0;font-size:14px;line-height:1.5;">
                <a href="mailto:contact@fbrissi.dev" style="color:#2563eb;text-decoration:none;">contact@fbrissi.dev</a><br>
                <a href="${siteUrl}/" style="color:#2563eb;text-decoration:none;">fbrissi.dev</a>
              </p>
            </td>
          </tr>
        </table>
        ${environmentNote}
        <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;line-height:1.5;color:#888888;">${t.footer}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, (character) => entities[character]);
}
