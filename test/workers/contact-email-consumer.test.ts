import { afterEach, describe, expect, it, vi } from 'vitest';
import contactEmailConsumer, { sendConfirmationEmail } from '@/workers/contact-email-consumer';

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
  it('sends the owner email after a successful delivery', async () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('boundary-id' as ReturnType<typeof crypto.randomUUID>)
      .mockReturnValueOnce('confirmation-id' as ReturnType<typeof crypto.randomUUID>);
    const env = createEnv();
    const retry = vi.fn();

    await contactEmailConsumer.queue({ messages: [{ body: message, retry }] }, env);

    expect(retry).not.toHaveBeenCalled();
    expect(env.SEND_EMAIL.send).toHaveBeenCalledTimes(1);

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

    expect(env.SEND_EMAIL.send).toHaveBeenCalledTimes(1);
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
    expect(env.SEND_EMAIL.send).toHaveBeenCalledTimes(2);
  });

  it('keeps the confirmation implementation available without sending it', async () => {
    const env = createEnv();

    await sendConfirmationEmail(env, message);

    expect(env.SEND_EMAIL.send).toHaveBeenCalledTimes(1);
    expect((env.SEND_EMAIL.send.mock.calls[0][0] as MockEmailMessage).to).toBe('ada@example.com');
  });

  it('logs confirmation delivery failures without throwing', async () => {
    const error = new Error('confirmation unavailable');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const env = createEnv();
    env.SEND_EMAIL.send.mockRejectedValueOnce(error);

    await sendConfirmationEmail(env, message);

    expect(consoleError).toHaveBeenCalledWith('Unable to deliver contact form confirmation email:', error);
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
    expect(env.SEND_EMAIL.send).toHaveBeenCalledTimes(1);
  });
});
