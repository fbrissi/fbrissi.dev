// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { contactConfirmationEmailHtml, contactConfirmationEmailText } from '@/workers/templates/contact-confirmation-email';
import { contactEmailHtml, contactEmailText } from '@/workers/templates/contact-email';
import { environmentBadge, escapeHtml, renderEmailHtml, renderEmailText, type EmailContent } from '@/workers/templates/email-layout';
import { studyGroupEmailHtml, studyGroupEmailText } from '@/workers/templates/study-group-email';
import { notificationKinds } from '@/workers/study-group/contract';

const hostile = `<script>alert("x")</script> & 'q'`;

const card: EmailContent = {
  lang: 'en',
  siteUrl: 'https://fbrissi.dev',
  heading: `Heading ${hostile}`,
  badge: 'LOCAL',
  preheader: `Preheader ${hostile}`,
  textHeading: 'Text heading',
  blocks: [
    { kind: 'paragraph', text: `Paragraph ${hostile}` },
    { kind: 'fields', rows: [{ label: 'Name', value: hostile }, { label: 'Email', value: 'a@b.test', href: `mailto:a@b.test?x="1"` }] },
    { kind: 'message', label: 'Message', text: `Line 1\n${hostile}` },
    { kind: 'button', label: `Open ${hostile}`, url: 'https://fbrissi.dev/x?a=1&b="2"' },
    { kind: 'signature', avatarSize: 48, lines: [{ text: `Sig ${hostile}`, style: 'plain' }] },
    { kind: 'note', text: `Note ${hostile}` },
  ],
  footer: { text: `Footer ${hostile}`, links: [{ label: 'Settings', url: 'https://fbrissi.dev/s', textLabel: 'Email settings' }, { label: 'Privacy', url: 'https://fbrissi.dev/privacy' }], linksOnNewLine: true, separator: '--' },
};

describe('email layout', () => {
  it('fills every slot of the card look and escapes all of it once', () => {
    const html = renderEmailHtml(card);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('&amp;amp;');
    expect(html.match(/&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; &#039;q&#039;/g)).toHaveLength(9);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<span class="badge">LOCAL</span>');
    expect(html).toContain('<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Preheader');
    expect(html).toContain('href="mailto:a@b.test?x=&quot;1&quot;"');
    expect(html).toContain('href="https://fbrissi.dev/x?a=1&amp;b=&quot;2&quot;"');
    expect(html).toContain('Line 1<br>&lt;script&gt;');
    expect(html).toContain('src="https://fbrissi.dev/images/avatar.png"');
    expect(html).toContain('<a href="https://fbrissi.dev/s" style="color:#c2410c;text-decoration:none;">Settings</a> ·');

    expect(renderEmailText(card)).toBe([
      'Text heading',
      `Paragraph ${hostile}`,
      `Name: ${hostile}\nEmail: a@b.test`,
      `Message:\nLine 1\n${hostile}`,
      `Open ${hostile}: https://fbrissi.dev/x?a=1&b="2"`,
      `Sig ${hostile}`,
      `(Note ${hostile})`,
      `--\nFooter ${hostile}\nEmail settings: https://fbrissi.dev/s\nPrivacy: https://fbrissi.dev/privacy`,
    ].join('\n\n'));
  });

  it('renders the letter look without a heading, badge, preheader or footer links', () => {
    const letter: EmailContent = {
      lang: 'pt-BR',
      siteUrl: 'http://localhost:3000',
      blocks: [{ kind: 'signature', avatarSize: 120, lines: [{ text: 'Regards,', style: 'regards' }, { text: 'Name', style: 'name' }, { text: 'Title', style: 'title' }, { text: 'Details', style: 'detail' }], links: [{ label: 'me@x.test', url: 'mailto:me@x.test' }, { label: 'x.test', url: 'https://x.test/' }] }],
      footer: { text: 'Footer' },
    };
    const html = renderEmailHtml(letter);
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).not.toMatch(/class="header"|class="badge"|display:none/);
    expect(html).toContain('width="120" height="120"');
    expect(renderEmailText(letter)).toBe('Regards,\n\nName\nTitle\n\nDetails\n\nme@x.test\nhttps://x.test/\n\nFooter');
    expect(renderEmailHtml({ ...letter, heading: 'Card', badge: null, footer: { text: 'Inline', links: [{ label: 'here', url: 'https://x.test/' }], separator: '---' } }))
      .toContain('<div class="footer">Inline <a href="https://x.test/">here</a></div>');
    expect(renderEmailText({ ...letter, footer: { text: 'Inline', links: [{ label: 'here', url: 'https://x.test/' }], separator: '---' } })).toMatch(/---\nInline https:\/\/x\.test\/$/);
  });

  it('names the environment badge and keeps one escape helper', () => {
    expect(environmentBadge('production')).toBeNull();
    expect(environmentBadge('sandbox')).toBe('SANDBOX');
    expect(environmentBadge('local')).toBe('LOCAL');
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#039;');
  });

  it('leaves no placeholder in any email, and keeps the text and HTML parts consistent', () => {
    const message = { name: 'Ada', email: 'ada@example.com', subject: 'Hello', message: 'Hi there', locale: 'en' as const };
    const emails: [string, string][] = [
      [contactEmailText(message, { isLocal: true }), contactEmailHtml(message, { isLocal: true })],
      [contactConfirmationEmailText(message, { isLocal: false, isSandbox: true }), contactConfirmationEmailHtml(message, { isLocal: false, isSandbox: true })],
      ...notificationKinds.map((kind): [string, string] => {
        const meeting = { lead: 'day_before' as const, startsAt: '2026-11-30T23:00:00.000Z', start: '20:00', end: '21:00', timezone: 'America/Sao_Paulo', url: 'https://meet.example.com/abc' };
        const input = { kind, groupId: 'g1', groupName: 'Go Talk', pendingCount: 2, reason: 'Some reason', meeting, appOrigin: 'https://fbrissi.dev', unsubscribeUrl: 'https://fbrissi.dev/u?t=1', environment: 'production' as const };
        return [studyGroupEmailText(input), studyGroupEmailHtml(input)];
      }),
    ];
    for (const [text, html] of emails) {
      expect(`${text}${html}`).not.toMatch(/\$\{|\{\{|undefined|null|\[object/);
      // Every line of the text part is in the HTML part too (as escaped text), except the text-only heading.
      for (const line of text.split('\n').filter((item) => item && !/^(-+|\(.*\)|New contact form submission.*)$/.test(item) && !item.includes(': http') && !item.includes(': mailto:'))) {
        const expected = escapeHtml(line.replace(/^[A-Za-z ]+: /, ''));
        // Shown as text, or as a link target.
        expect(`${html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')} ${html}`).toContain(expected);
      }
    }
  });
});
