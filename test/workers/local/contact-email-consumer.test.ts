import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  createTransport: vi.fn(),
  sendMail: vi.fn(),
  SQSClient: vi.fn(),
  CreateQueueCommand: vi.fn(function (this: { input: unknown }, input: unknown) { this.input = input; }),
  ReceiveMessageCommand: vi.fn(function (this: { input: unknown }, input: unknown) { this.input = input; }),
  DeleteMessageCommand: vi.fn(function (this: { input: unknown }, input: unknown) { this.input = input; }),
}));

vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: mocks.SQSClient.mockImplementation(function (this: { send: typeof mocks.send }) { this.send = mocks.send; }),
  CreateQueueCommand: mocks.CreateQueueCommand,
  ReceiveMessageCommand: mocks.ReceiveMessageCommand,
  DeleteMessageCommand: mocks.DeleteMessageCommand,
}));
vi.mock('nodemailer', () => ({ default: { createTransport: mocks.createTransport } }));

const message = { name: 'Ada Lovelace', email: 'ada@example.com', subject: 'Hello', message: 'Test message' };
const pending = new Promise<never>(() => undefined);

async function startConsumer(messages?: unknown[] | null, deleteError?: Error) {
  mocks.send.mockImplementation(() => pending);
  mocks.send.mockResolvedValueOnce({ QueueUrl: 'http://localstack:4566/queue/contact' });
  mocks.send.mockResolvedValueOnce({ Messages: messages });
  if (deleteError) mocks.send.mockRejectedValueOnce(deleteError);
  else mocks.send.mockResolvedValueOnce({});
  await import('@/workers/local/contact-email-consumer');
  await vi.waitFor(() => expect(mocks.ReceiveMessageCommand).toHaveBeenCalled());
}

describe('local contact email consumer', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.MAILPIT_SMTP_HOST;
    delete process.env.MAILPIT_SMTP_PORT;
    delete process.env.CONTACT_EMAIL_FROM;
    delete process.env.CONTACT_EMAIL_TO;
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
    mocks.sendMail.mockResolvedValue({});
  });

  it('creates the local SMTP transport and deletes successfully delivered messages', async () => {
    await startConsumer([{ Body: JSON.stringify(message), ReceiptHandle: 'receipt' }]);

    await vi.waitFor(() => expect(mocks.DeleteMessageCommand).toHaveBeenCalledOnce());
    expect(mocks.createTransport).toHaveBeenCalledWith({ host: 'mailpit', port: 1025, secure: false });
    expect(mocks.ReceiveMessageCommand).toHaveBeenCalledWith({
      QueueUrl: 'http://localstack:4566/queue/contact',
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 10,
      VisibilityTimeout: 30,
    });
    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'noreply@fbrissi.dev',
      to: 'hello@fbrissi.dev',
      replyTo: { address: 'ada@example.com', name: 'Ada Lovelace' },
      subject: '[Contact Form - LOCAL] Hello',
      text: expect.stringContaining('LOCAL DEVELOPMENT'),
      html: expect.stringContaining('LOCAL DEV'),
    }));
    expect(mocks.DeleteMessageCommand).toHaveBeenCalledWith({ QueueUrl: 'http://localstack:4566/queue/contact', ReceiptHandle: 'receipt' });
  });

  it('uses configured SMTP and message addresses', async () => {
    process.env.MAILPIT_SMTP_HOST = 'localhost';
    process.env.MAILPIT_SMTP_PORT = '2525';
    process.env.CONTACT_EMAIL_FROM = 'from@example.com';
    process.env.CONTACT_EMAIL_TO = 'to@example.com';

    await startConsumer([{ Body: JSON.stringify(message), ReceiptHandle: 'receipt' }]);
    await vi.waitFor(() => expect(mocks.sendMail).toHaveBeenCalledOnce());

    expect(mocks.createTransport).toHaveBeenCalledWith({ host: 'localhost', port: 2525, secure: false });
    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'from@example.com', to: 'to@example.com' }));
  });

  it('ignores null poll results', async () => {
    await startConsumer(null);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.DeleteMessageCommand).not.toHaveBeenCalled();
  });

  it('ignores incomplete messages', async () => {
    await startConsumer([{ ReceiptHandle: 'receipt' }, { Body: JSON.stringify(message) }]);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.DeleteMessageCommand).not.toHaveBeenCalled();
  });

  it('logs delivery and parsing failures without deleting the message', async () => {
    const error = new Error('SMTP unavailable');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.sendMail.mockRejectedValueOnce(error);

    await startConsumer([
      { Body: 'invalid JSON', ReceiptHandle: 'bad-json' },
      { Body: JSON.stringify(message), ReceiptHandle: 'smtp-error' },
    ]);

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(2));
    expect(consoleError).toHaveBeenCalledWith('Unable to deliver queued contact form email:', expect.any(Error));
    expect(mocks.DeleteMessageCommand).not.toHaveBeenCalled();
  });

  it('logs a failed queue delete after delivering the email', async () => {
    const error = new Error('delete failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await startConsumer([{ Body: JSON.stringify(message), ReceiptHandle: 'receipt' }], error);

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledWith('Unable to deliver queued contact form email:', error));
    expect(mocks.sendMail).toHaveBeenCalledOnce();
  });

  it('logs a stopped consumer and exits when queue setup fails', async () => {
    const error = new Error('queue unavailable');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    mocks.send.mockRejectedValueOnce(error);

    await import('@/workers/local/contact-email-consumer');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));

    expect(consoleError).toHaveBeenCalledWith('Contact email consumer stopped:', error);
  });
});
