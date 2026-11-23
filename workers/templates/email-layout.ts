/**
 * The one layout of every email the site sends (contact form, contact confirmation, study group notices). A template
 * only fills the slots: the heading, an optional preheader, the body blocks, an optional button, a signature, notes and
 * the footer. Every value is plain text and is escaped here, once; URLs are escaped as attributes.
 *
 * Two looks share the skeleton: with a `heading`, the contact form card (green header with the avatar, the title and
 * the LOCAL/SANDBOX badge, a grey content box and a small footer); without one, a plain letter (the confirmation sent
 * to people who write in).
 */

export type EmailEnvironmentName = 'production' | 'sandbox' | 'local';

export interface EmailLink {
  label: string;
  url: string;
  /** The label in the text part, when it needs more words than the HTML link. */
  textLabel?: string;
}

export interface EmailSignatureLine {
  text: string;
  /** Visual weight: the name stands out, details are muted. */
  style: 'regards' | 'name' | 'title' | 'detail' | 'plain';
}

export type EmailBlock =
  | { kind: 'paragraph'; text: string }
  /** Key/value rows (contact form fields); a row with `href` is a link. */
  | { kind: 'fields'; rows: { label: string; value: string; href?: string }[] }
  /** A quoted, multi-line text (the contact message), line breaks kept. */
  | { kind: 'message'; label: string; text: string }
  /** The call to action: an orange button, "Label: URL" in the text part. */
  | { kind: 'button'; label: string; url: string }
  | { kind: 'signature'; avatarSize: number; lines: EmailSignatureLine[]; links?: EmailLink[] }
  /** A small muted note, "(note)" in the text part. */
  | { kind: 'note'; text: string };

export interface EmailContent {
  /** `<html lang>`. */
  lang: string;
  /** Origin of the site: the avatar and the header link. */
  siteUrl: string;
  /** Card title; omit it for the letter look. */
  heading?: string;
  /** LOCAL or SANDBOX outside production, shown next to the heading. */
  badge?: string | null;
  /** Hidden preview text some mail apps show after the subject. */
  preheader?: string;
  /** First line of the text part (the heading has its own HTML form). */
  textHeading?: string;
  blocks: EmailBlock[];
  footer: {
    text: string;
    links?: EmailLink[];
    /** Links on their own line ("Email settings · Unsubscribe"), as "Label: URL" lines in the text part. */
    linksOnNewLine?: boolean;
    /** Text-part separator line before the footer; none for the letter. */
    separator?: '---' | '--';
  };
}

const ACCENT = '#f97316';
const ACCENT_TEXT_LINK = '#c2410c';
const HEADER = '#139a00';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(text: string): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (character) => entities[character]);
}

/** The badge next to the heading: LOCAL or SANDBOX, nothing in production. */
export function environmentBadge(environment: EmailEnvironmentName): string | null {
  if (environment === 'local') return 'LOCAL';
  if (environment === 'sandbox') return 'SANDBOX';
  return null;
}

const signatureStyles: Record<EmailSignatureLine['style'], string> = {
  regards: 'margin:0 0 10px;font-size:14px;line-height:1.4;color:#222222;',
  name: 'margin:0 0 2px;font-size:18px;line-height:1.3;font-weight:700;color:#111111;',
  title: 'margin:0 0 12px;font-size:14px;line-height:1.4;color:#444444;',
  detail: 'margin:0 0 12px;font-size:13px;line-height:1.45;color:#555555;',
  plain: 'margin:0;font-size:14px;line-height:1.45;color:#444444;',
};

function blockHtml(block: EmailBlock, content: EmailContent): string {
  switch (block.kind) {
    case 'paragraph':
      return `<p style="margin:0 0 16px;">${escapeHtml(block.text)}</p>`;
    case 'fields':
      return block.rows
        .map((row) => `<div class="field"><strong>${escapeHtml(row.label)}:</strong>${row.href ? `<a href="${escapeHtml(row.href)}">${escapeHtml(row.value)}</a>` : escapeHtml(row.value)}</div>`)
        .join('\n    ');
    case 'message':
      return `<div class="message"><strong>${escapeHtml(block.label)}:</strong><p>${escapeHtml(block.text).replace(/\n/g, '<br>')}</p></div>`;
    case 'button':
      return `<p style="margin:8px 0 28px;"><a href="${escapeHtml(block.url)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:${ACCENT};color:#111111;text-decoration:none;font-size:14px;">${escapeHtml(block.label)}</a></p>`;
    case 'signature': {
      const lines = block.lines.map((line) => `<p style="${signatureStyles[line.style]}">${escapeHtml(line.text)}</p>`).join('\n              ');
      const links = block.links?.length
        ? `\n              <p style="margin:0;font-size:14px;line-height:1.5;">${block.links.map((link) => `<a href="${escapeHtml(link.url)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(link.label)}</a>`).join('<br>\n                ')}</p>`
        : '';
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:12px;">
          <tr>
            <td valign="middle" style="padding:0 ${block.avatarSize > 64 ? 20 : 14}px 0 0;">
              <img src="${escapeHtml(`${content.siteUrl}/images/avatar.png`)}" alt="Filipe Bojikian Rissi" width="${block.avatarSize}" height="${block.avatarSize}" style="display:block;width:${block.avatarSize}px;height:auto;border:0;border-radius:${block.avatarSize > 64 ? 0 : block.avatarSize / 2}px;">
            </td>
            <td valign="middle" style="padding:0;font-family:${FONT};font-size:14px;line-height:1.45;color:#222222;">
              ${lines}${links}
            </td>
          </tr>
        </table>`;
    }
    case 'note':
      return `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#666666;">${escapeHtml(block.text)}</p>`;
  }
}

function footerHtml(content: EmailContent): string {
  const { text, links = [], linksOnNewLine } = content.footer;
  const linkStyle = linksOnNewLine ? ` style="color:${ACCENT_TEXT_LINK};text-decoration:none;"` : '';
  const anchors = links.map((link) => `<a href="${escapeHtml(link.url)}"${linkStyle}>${escapeHtml(link.label)}</a>`);
  if (!anchors.length) return escapeHtml(text);
  return linksOnNewLine ? `${escapeHtml(text)}<br>\n      ${anchors.join(' ·\n      ')}` : `${escapeHtml(text)} ${anchors.join(' ')}`;
}

function preheaderHtml(content: EmailContent): string {
  return content.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(content.preheader)}</div>\n  `
    : '';
}

export function renderEmailHtml(content: EmailContent): string {
  const blocks = content.blocks.map((block) => blockHtml(block, content));
  if (content.heading !== undefined) {
    const badge = content.badge ? ` <span class="badge">${escapeHtml(content.badge)}</span>` : '';
    return `<!DOCTYPE html>
<html lang="${escapeHtml(content.lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: ${FONT}; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${HEADER}; color: #fafafa; padding: 20px; border-radius: 8px 8px 0 0; }
    .badge { display: inline-block; background: ${ACCENT}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-left: 10px; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 15px; }
    .field strong { display: block; color: ${ACCENT}; margin-bottom: 5px; }
    .message { background: white; padding: 15px; border-left: 3px solid ${ACCENT}; margin-top: 15px; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  ${preheaderHtml(content)}<div class="header">
    <a href="${escapeHtml(content.siteUrl)}" style="display: inline-block; margin-right: 16px; vertical-align: middle;"><img src="${escapeHtml(`${content.siteUrl}/images/avatar.png`)}" alt="Filipe Bojikian Rissi" width="64" style="display: block; border: 0;"></a>
    <h2 style="display: inline-block; margin: 0; vertical-align: middle;">${escapeHtml(content.heading)}${badge}</h2>
  </div>
  <div class="content">
    ${blocks.join('\n    ')}
    <div class="footer">${footerHtml(content)}</div>
  </div>
</body>
</html>`;
  }
  return `<!DOCTYPE html>
<html lang="${escapeHtml(content.lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  ${preheaderHtml(content)}<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#ffffff;">
    <tr>
      <td style="padding:24px 20px;font-family:${FONT};font-size:15px;line-height:1.6;color:#222222;">
        ${blocks.join('\n        ')}
        <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;line-height:1.5;color:#888888;">${footerHtml(content)}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function blockText(block: EmailBlock): string {
  switch (block.kind) {
    case 'paragraph':
      return block.text;
    case 'fields':
      return block.rows.map((row) => `${row.label}: ${row.value}`).join('\n');
    case 'message':
      return `${block.label}:\n${block.text}`;
    case 'button':
      return `${block.label}: ${block.url}`;
    case 'signature':
      // The closing ("Best regards,") and the details line stand apart from the name and title.
      return [block.lines.map((line) => (line.style === 'regards' ? `${line.text}\n` : line.style === 'detail' ? `\n${line.text}` : line.text)).join('\n'), ...(block.links?.length ? [block.links.map((link) => (link.url.startsWith('mailto:') ? link.label : link.url)).join('\n')] : [])].join('\n\n');
    case 'note':
      return `(${block.text})`;
  }
}

export function renderEmailText(content: EmailContent): string {
  const { text, links = [], linksOnNewLine, separator } = content.footer;
  const footer = linksOnNewLine
    ? [text, ...links.map((link) => `${link.textLabel ?? link.label}: ${link.url}`)].join('\n')
    : [text, ...links.map((link) => link.url)].join(' ');
  return [
    ...(content.textHeading ? [content.textHeading] : []),
    ...content.blocks.map(blockText),
    separator ? `${separator}\n${footer}` : footer,
  ].join('\n\n');
}
