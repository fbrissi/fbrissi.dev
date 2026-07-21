import { describe, expect, it } from 'vitest';
import {
  contactConfirmationEmailHtml,
  contactConfirmationEmailSubject,
  contactConfirmationEmailText,
} from '@/workers/templates/contact-confirmation-email';

const enMessage = {
  name: `Ada & <Lovelace> "O'Brien"`,
  email: 'ada@example.com',
  subject: 'Question & <idea>',
  message: 'Body',
  locale: 'en' as const,
};

const ptMessage = {
  ...enMessage,
  locale: 'pt-BR' as const,
};

describe('contact confirmation email templates', () => {
  it('renders production subjects and text emails in English', () => {
    expect(contactConfirmationEmailSubject(enMessage, { isLocal: false })).toBe('Re: Question & <idea>');
    const text = contactConfirmationEmailText(enMessage, { isLocal: false });

    expect(text).toContain(`Hi Ada & <Lovelace> "O'Brien",`);
    expect(text).toContain('I received your message about "Question & <idea>"');
    expect(text).toContain('Best regards,');
    expect(text).toContain('Filipe Bojikian Rissi');
    expect(text).toContain('Staff Software Engineer');
    expect(text).toContain('contact@fbrissi.dev');
    expect(text).toContain('https://fbrissi.dev/');
    expect(text).toContain('noreply@fbrissi.dev');
    expect(text).not.toContain('local development');
  });

  it('renders production subjects and text emails in Portuguese', () => {
    expect(contactConfirmationEmailSubject(ptMessage, { isLocal: false })).toBe('Re: Question & <idea>');
    const text = contactConfirmationEmailText(ptMessage, { isLocal: false });

    expect(text).toContain(`Olá Ada & <Lovelace> "O'Brien",`);
    expect(text).toContain('Recebi sua mensagem sobre "Question & <idea>"');
    expect(text).toContain('Atenciosamente,');
    expect(text).not.toContain('local development');
  });

  it('renders local subject and text with local note in English', () => {
    expect(contactConfirmationEmailSubject(enMessage, { isLocal: true })).toBe('Re: Question & <idea> [LOCAL]');
    const text = contactConfirmationEmailText(enMessage, { isLocal: true });

    expect(text).toContain('local development');
  });

  it('renders local subject and text with local note in Portuguese', () => {
    expect(contactConfirmationEmailSubject(ptMessage, { isLocal: true })).toBe('Re: Question & <idea> [LOCAL]');
    const text = contactConfirmationEmailText(ptMessage, { isLocal: true });

    expect(text).toContain('desenvolvimento local');
  });

  it('escapes user content and includes signature in production HTML (English)', () => {
    const html = contactConfirmationEmailHtml(enMessage, { isLocal: false });

    expect(html).toContain('Ada &amp; &lt;Lovelace&gt; &quot;O&#039;Brien&quot;');
    expect(html).toContain('Question &amp; &lt;idea&gt;');
    expect(html).toContain('src="https://fbrissi.dev/images/avatar.png"');
    expect(html).toContain('Filipe Bojikian Rissi');
    expect(html).toContain('Staff Software Engineer');
    expect(html).toContain('valign="middle"');
    expect(html).toContain('href="mailto:contact@fbrissi.dev"');
    expect(html).toContain('href="https://fbrissi.dev/"');
    expect(html).toContain('Best regards,');
    expect(html).not.toContain('local development');
  });

  it('uses Portuguese copy in production HTML', () => {
    const html = contactConfirmationEmailHtml(ptMessage, { isLocal: false });

    expect(html).toContain('Atenciosamente,');
    expect(html).not.toContain('Best regards,');
  });

  it('adds local markers and links', () => {
    const html = contactConfirmationEmailHtml(enMessage, { isLocal: true });

    expect(html).toContain('local development');
    expect(html).toContain('src="http://localhost:3000/images/avatar.png"');
    expect(html).toContain('href="http://localhost:3000/"');
  });
});
