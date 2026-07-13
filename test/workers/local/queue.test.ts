import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  SQSClient: vi.fn(),
  CreateQueueCommand: vi.fn(function (this: { input: unknown }, input: unknown) {
    this.input = input;
  }),
}));

vi.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: mocks.SQSClient.mockImplementation(function (this: { send: typeof mocks.send }, options: unknown) {
    Object.assign(this, { options, send: mocks.send });
  }),
  CreateQueueCommand: mocks.CreateQueueCommand,
}));

describe('local contact queue', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.LOCALSTACK_QUEUE_NAME;
    delete process.env.LOCALSTACK_ENDPOINT;
    delete process.env.AWS_REGION;
  });

  it('creates the default LocalStack queue once and caches its URL', async () => {
    mocks.send.mockResolvedValue({ QueueUrl: 'http://localstack:4566/queue/contact' });

    const { getContactQueueUrl, sqs } = await import('@/workers/local/queue');

    await expect(getContactQueueUrl()).resolves.toBe('http://localstack:4566/queue/contact');
    await expect(getContactQueueUrl()).resolves.toBe('http://localstack:4566/queue/contact');
    expect(mocks.SQSClient).toHaveBeenCalledWith({
      endpoint: 'http://localstack:4566',
      region: 'us-east-1',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    });
    expect(sqs.send).toBe(mocks.send);
    expect(mocks.CreateQueueCommand).toHaveBeenCalledWith({ QueueName: 'fbrissi-contact-form' });
    expect(mocks.send).toHaveBeenCalledOnce();
  });

  it('uses configured queue settings and rejects a missing queue URL', async () => {
    process.env.LOCALSTACK_QUEUE_NAME = 'configured-queue';
    process.env.LOCALSTACK_ENDPOINT = 'http://localhost:4566';
    process.env.AWS_REGION = 'sa-east-1';
    mocks.send.mockResolvedValue({});

    const { getContactQueueUrl } = await import('@/workers/local/queue');

    await expect(getContactQueueUrl()).rejects.toThrow('LocalStack did not return a queue URL');
    expect(mocks.SQSClient).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: 'http://localhost:4566',
      region: 'sa-east-1',
    }));
    expect(mocks.CreateQueueCommand).toHaveBeenCalledWith({ QueueName: 'configured-queue' });
  });
});
