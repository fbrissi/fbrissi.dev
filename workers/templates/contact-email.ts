import type { ContactMessage } from '../contact-message';

interface ContactEmailTemplateOptions {
  isLocal: boolean;
  isSandbox?: boolean;
}

export function contactEmailSubject({ subject }: ContactMessage, { isLocal, isSandbox = false }: ContactEmailTemplateOptions): string {
  const environment = isLocal ? 'LOCAL' : isSandbox ? 'SANDBOX' : '';
  return `[Contact Form${environment ? ` - ${environment}` : ''}] ${subject}`;
}

export function contactEmailText(
  { name, email, subject, message }: ContactMessage,
  { isLocal, isSandbox = false }: ContactEmailTemplateOptions
): string {
  const contactUrl = isLocal ? 'http://localhost:3000/contact' : 'https://fbrissi.dev/contact';
  const environment = isLocal ? ' (LOCAL DEVELOPMENT)' : isSandbox ? ' (SANDBOX)' : '';

  return `New contact form submission from fbrissi.dev${environment}

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

---
This message was sent via the contact form at ${contactUrl}`;
}

export function contactEmailHtml(
  { name, email, subject, message }: ContactMessage,
  { isLocal, isSandbox = false }: ContactEmailTemplateOptions
): string {
  const siteUrl = isLocal ? 'http://localhost:3000' : 'https://fbrissi.dev';
  const contactUrl = `${siteUrl}/contact`;
  const avatarUrl = `${siteUrl}/images/avatar.png`;
  const localBadge = isLocal ? '<span class="badge">LOCAL</span>' : isSandbox ? '<span class="badge">SANDBOX</span>' : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #139a00; color: #fafafa; padding: 20px; border-radius: 8px 8px 0 0; }
    .badge { display: inline-block; background: #f97316; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-left: 10px; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 15px; }
    .field strong { display: block; color: #f97316; margin-bottom: 5px; }
    .message { background: white; padding: 15px; border-left: 3px solid #f97316; margin-top: 15px; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <a href="${siteUrl}" style="display: inline-block; margin-right: 16px; vertical-align: middle;"><img src="${avatarUrl}" alt="Filipe Bojikian Rissi" width="64" style="display: block; border: 0;"></a>
    <h2 style="display: inline-block; margin: 0; vertical-align: middle;">New Contact Form Submission ${localBadge}</h2>
  </div>
  <div class="content">
    <div class="field"><strong>Name:</strong>${escapeHtml(name)}</div>
    <div class="field"><strong>Email:</strong><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>
    <div class="field"><strong>Subject:</strong>${escapeHtml(subject)}</div>
    <div class="message"><strong>Message:</strong><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p></div>
    <div class="footer">This message was sent via the contact form at <a href="${contactUrl}">${contactUrl}</a></div>
  </div>
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
