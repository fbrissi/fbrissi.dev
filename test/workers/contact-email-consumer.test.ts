import { afterEach, describe, expect, it, vi } from 'vitest';
import contactEmailConsumer from '@/workers/contact-email-consumer';

class MockEmailMessage {
  constructor(
    readonly from: string,
    readonly to: string,
    readonly raw: string
  ) {}
}

const message = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  subject: 'Hello',
  message: 'Test message',
};

function createEnv() {
  return {
    CONTACT_EMAIL_FROM: 'sender@fbrissi.dev',
    CONTACT_EMAIL_TO: 'filipe@fbrissi.dev',
    SEND_EMAIL: { send: vi.fn().mockResolvedValue(undefined) },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('contact email consumer worker', () => {
  it('sends a multipart production email with the template variants', async () => {
    vi.stubGlobal('EmailMessage', MockEmailMessage);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('boundary-id');
    const env = createEnv();
    const retry = vi.fn();

    await contactEmailConsumer.queue({ messages: [{ body: message, retry }] }, env);

    expect(retry).not.toHaveBeenCalled();
    expect(env.SEND_EMAIL.send).toHaveBeenCalledOnce();
    const email = env.SEND_EMAIL.send.mock.calls[0][0] as MockEmailMessage;
    expect(email.from).toBe('sender@fbrissi.dev');
    expect(email.to).toBe('filipe@fbrissi.dev');
    expect(email.raw).toContain('From: Contact Form <sender@fbrissi.dev>\r\nTo: filipe@fbrissi.dev');
    expect(email.raw).toContain('Subject: [Contact Form] Hello');
    expect(email.raw).toContain('boundary="contact-form-boundary-id"');
    expect(email.raw).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(email.raw).toContain('New contact form submission from fbrissi.dev');
    expect(email.raw).toContain('Content-Type: text/html; charset=UTF-8');
    expect(email.raw).toContain('<h2 style="margin: 0;">New Contact Form Submission </h2>');
    expect(email.raw).toContain('--contact-form-boundary-id--');
  });

  it('sanitizes newlines from email headers', async () => {
    vi.stubGlobal('EmailMessage', MockEmailMessage);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('safe-boundary');
    const env = createEnv();

    await contactEmailConsumer.queue({
      messages: [{
        body: {
          name: 'Ada\r\nBcc: attacker@example.com',
          email: 'ada@example.com\r\nBcc: attacker@example.com',
          subject: 'Hello\r\nBcc: attacker@example.com',
          message: 'Body',
        },
        retry: vi.fn(),
      }],
    }, env);

    const email = env.SEND_EMAIL.send.mock.calls[0][0] as MockEmailMessage;
    expect(email.raw).toContain('Reply-To: Ada  Bcc: attacker@example.com <ada@example.comBcc: attacker@example.com>');
    expect(email.raw).toContain('Subject: [Contact Form] Hello  Bcc: attacker@example.com');
    expect(email.raw.split('\r\n\r\n')[0]).not.toContain('\r\nBcc: attacker@example.com');
  });

  it('retries failed messages and continues processing the batch', async () => {
    vi.stubGlobal('EmailMessage', MockEmailMessage);
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
});
