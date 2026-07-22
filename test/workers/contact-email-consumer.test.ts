import { afterEach, describe, expect, it, vi } from 'vitest';
import contactEmailConsumer from '@/workers/contact-email-consumer';

interface MockEmailMessage {
  from: string;
  to: string;
  raw: string;
}

const message = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Hello',
  message: 'Test message',
  locale: 'en' as const,
};

function createEnv() {
  return {
    CONTACT_EMAIL_FROM: 'sender@fbrissi.dev',
    CONTACT_EMAIL_TO: 'f.b.rissi@gmail.com',
    CONTACT_EMAIL_DISPLAY_TO: 'contact@fbrissi.dev',
    SEND_EMAIL: { send: vi.fn().mockResolvedValue(undefined) },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('contact email consumer worker', () => {
  it('sends owner and confirmation emails after a successful delivery', async () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('boundary-id' as ReturnType<typeof crypto.randomUUID>)
      .mockReturnValueOnce('confirmation-id' as ReturnType<typeof crypto.randomUUID>);
    const env = createEnv();
    const retry = vi.fn();

    await contactEmailConsumer.queue({ messages: [{ body: message, retry }] }, env);

    expect(retry).not.toHaveBeenCalled();
    expect(env.SEND_EMAIL.send).toHaveBeenCalledTimes(2);

    const ownerEmail = env.SEND_EMAIL.send.mock.calls[0][0] as MockEmailMessage;
    expect(ownerEmail.from).toBe('sender@fbrissi.dev');
    expect(ownerEmail.to).toBe('f.b.rissi@gmail.com');
    expect(ownerEmail.raw).toContain('From: Contact Form <sender@fbrissi.dev>\r\nTo: contact@fbrissi.dev');
    expect(ownerEmail.raw).toContain('Reply-To: "Ada Lovelace" <ada@example.com>');
    expect(ownerEmail.raw).toContain('Subject: [Contact Form] Hello');
    expect(ownerEmail.raw).toContain('boundary="contact-form-boundary-id"');
    expect(ownerEmail.raw).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(ownerEmail.raw).toContain('New contact form submission from fbrissi.dev');
    expect(ownerEmail.raw).toContain('Content-Type: text/html; charset=UTF-8');
    expect(ownerEmail.raw).toMatch(/<h2[^>]*>New Contact Form Submission <\/h2>/);
    expect(ownerEmail.raw).toContain('--contact-form-boundary-id--');

    const confirmationEmail = env.SEND_EMAIL.send.mock.calls[1][0] as MockEmailMessage;
    expect(confirmationEmail.from).toBe('sender@fbrissi.dev');
    expect(confirmationEmail.to).toBe('ada@example.com');
    expect(confirmationEmail.raw).toContain('From: Filipe <sender@fbrissi.dev>');
    expect(confirmationEmail.raw).toContain('To: ada@example.com');
    expect(confirmationEmail.raw).toContain('Reply-To: sender@fbrissi.dev');
    expect(confirmationEmail.raw).toContain('Subject: Re: Hello');
    expect(confirmationEmail.raw).toContain('Auto-Submitted: auto-replied');
    expect(confirmationEmail.raw).toContain('I received your message about "Hello"');
    expect(confirmationEmail.raw).toContain('Filipe Bojikian Rissi');
    expect(confirmationEmail.raw).toContain('boundary="contact-confirmation-confirmation-id"');
  });

  it('sanitizes newlines from email headers', async () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('safe-boundary' as ReturnType<typeof crypto.randomUUID>)
      .mockReturnValueOnce('safe-confirmation' as ReturnType<typeof crypto.randomUUID>);
    const env = createEnv();

    await contactEmailConsumer.queue({
      messages: [{
        body: {
          name: 'Ada "Countess"\r\nBcc: attacker@example.com',
          email: 'ada@example.com\r\nBcc: attacker@example.com',
          subject: 'Hello\r\nBcc: attacker@example.com',
          message: 'Body',
          locale: 'en' as const,
        },
        retry: vi.fn(),
      }],
    }, env);

    const ownerEmail = env.SEND_EMAIL.send.mock.calls[0][0] as MockEmailMessage;
    expect(ownerEmail.raw).toContain('Reply-To: "Ada \\"Countess\\"  Bcc: attacker@example.com" <ada@example.comBcc: attacker@example.com>');
    expect(ownerEmail.raw).toContain('Subject: [Contact Form] Hello  Bcc: attacker@example.com');
    expect(ownerEmail.raw.split('\r\n\r\n')[0]).not.toContain('\r\nBcc: attacker@example.com');

    const confirmationEmail = env.SEND_EMAIL.send.mock.calls[1][0] as MockEmailMessage;
    expect(confirmationEmail.to).toBe('ada@example.comBcc: attacker@example.com');
    expect(confirmationEmail.raw.split('\r\n\r\n')[0]).not.toContain('\r\nBcc: attacker@example.com');
  });

  it('retries when the owner email fails and skips confirmation', async () => {
    const error = new Error('email service unavailable');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const env = createEnv();
    env.SEND_EMAIL.send.mockRejectedValueOnce(error);
    const retryFirst = vi.fn();
    const retrySecond = vi.fn();

    await contactEmailConsumer.queue({
      messages: [
        { body: message, retry: retryFirst },
        { body: { ...message, subject: 'Second message' }, retry: retrySecond },
      ],
    }, env);

    expect(consoleError).toHaveBeenCalledWith('Unable to deliver contact form email:', error);
    expect(retryFirst).toHaveBeenCalledOnce();
    expect(retrySecond).not.toHaveBeenCalled();
    expect(env.SEND_EMAIL.send).toHaveBeenCalledTimes(3);
  });

  it('does not retry when only the confirmation email fails', async () => {
    const error = new Error('confirmation unavailable');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const env = createEnv();
    env.SEND_EMAIL.send
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(error);
    const retry = vi.fn();

    await contactEmailConsumer.queue({ messages: [{ body: message, retry }] }, env);

    expect(retry).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith('Unable to deliver contact form confirmation email:', error);
    expect(env.SEND_EMAIL.send).toHaveBeenCalledTimes(2);
  });

  it('defaults to English when locale is missing (legacy payload)', async () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('boundary-legacy' as ReturnType<typeof crypto.randomUUID>)
      .mockReturnValueOnce('confirmation-legacy' as ReturnType<typeof crypto.randomUUID>);
    const env = createEnv();
    const retry = vi.fn();
    const legacyMessage = { name: 'Ada Lovelace', email: 'ada@example.com', subject: 'Hello', message: 'Body' } as unknown as Parameters<typeof contactEmailConsumer.queue>[0]['messages'][number]['body'];

    await contactEmailConsumer.queue({ messages: [{ body: legacyMessage, retry }] }, env);

    expect(retry).not.toHaveBeenCalled();
    expect(env.SEND_EMAIL.send).toHaveBeenCalledTimes(2);
    const confirmationEmail = env.SEND_EMAIL.send.mock.calls[1][0] as MockEmailMessage;
    expect(confirmationEmail.raw).toContain('I received your message about "Hello"');
  });
});
