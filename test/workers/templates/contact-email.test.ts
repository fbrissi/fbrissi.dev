import { describe, expect, it } from 'vitest';
import { contactEmailHtml, contactEmailSubject, contactEmailText } from '@/workers/templates/contact-email';

const message = {
  name: `Ada & <Lovelace> "O'Brien"`,
  email: 'ada@example.com',
  subject: 'Question',
  message: 'First line\nSecond & <line>',
  locale: 'en' as const,
};

describe('contact email templates', () => {
  it('renders production subjects and text emails', () => {
    expect(contactEmailSubject(message, { isLocal: false })).toBe('[Contact Form] Question');
    expect(contactEmailText(message, { isLocal: false })).toContain('New contact form submission from fbrissi.dev');
    expect(contactEmailText(message, { isLocal: false })).toContain('https://fbrissi.dev/contact');
    expect(contactEmailText(message, { isLocal: false })).not.toContain('LOCAL DEVELOPMENT');
  });

  it('renders local subjects and text emails', () => {
    expect(contactEmailSubject(message, { isLocal: true })).toBe('[Contact Form - LOCAL] Question');
    const text = contactEmailText(message, { isLocal: true });

    expect(text).toContain('New contact form submission from fbrissi.dev (LOCAL DEVELOPMENT)');
    expect(text).toContain('http://localhost:3000/contact');
  });

  it('renders sandbox markers in subjects, text, and HTML emails', () => {
    expect(contactEmailSubject(message, { isLocal: false, isSandbox: true })).toBe('[Contact Form - SANDBOX] Question');
    expect(contactEmailText(message, { isLocal: false, isSandbox: true })).toContain('(SANDBOX)');
    expect(contactEmailHtml(message, { isLocal: false, isSandbox: true })).toContain('<span class="badge">SANDBOX</span>');
  });

  it('escapes user content and preserves message line breaks in production HTML', () => {
    const html = contactEmailHtml(message, { isLocal: false });

    expect(html).toContain('Ada &amp; &lt;Lovelace&gt; &quot;O&#039;Brien&quot;');
    expect(html).toContain('First line<br>Second &amp; &lt;line&gt;');
    expect(html).toContain('href="mailto:ada@example.com"');
    expect(html).toContain('<a href="https://fbrissi.dev"');
    expect(html).toContain('src="https://fbrissi.dev/images/avatar.png"');
    expect(html).toContain('href="https://fbrissi.dev/contact"');
    expect(html).not.toContain('LOCAL DEV');
  });

  it('adds local HTML markers and links', () => {
    const html = contactEmailHtml(message, { isLocal: true });

    expect(html).toContain('<span class="badge">LOCAL</span>');
    expect(html).toContain('<a href="http://localhost:3000"');
    expect(html).toContain('src="http://localhost:3000/images/avatar.png"');
    expect(html).toContain('href="http://localhost:3000/contact"');
  });
});
