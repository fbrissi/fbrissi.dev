import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handler: undefined as undefined | ((request: AsyncIterable<Buffer> & { method?: string; url?: string; headers: object }, response: { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }) => Promise<void>),
  listen: vi.fn(),
  queueUrl: vi.fn(),
  send: vi.fn(),
  SendMessageCommand: vi.fn(function (this: { input: unknown }, input: unknown) { this.input = input; }),
}));

vi.mock('node:http', () => ({
  createServer: vi.fn((handler) => {
    mocks.handler = handler;
    return { listen: mocks.listen.mockImplementation((_port, callback) => callback()) };
  }),
  default: {
    createServer: vi.fn((handler) => {
      mocks.handler = handler;
      return { listen: mocks.listen.mockImplementation((_port, callback) => callback()) };
    }),
  },
}));

vi.mock('@/workers/local/queue', () => ({ getContactQueueUrl: mocks.queueUrl, sqs: { send: mocks.send } }));
vi.mock('@aws-sdk/client-sqs', () => ({ SendMessageCommand: mocks.SendMessageCommand }));

const validForm = {
  name: ' Ada Lovelace ',
  email: 'ada@example.com',
  subject: ' Hello ',
  message: ' Test message ',
  'cf-turnstile-response': 'token',
};

async function request(method: string, url: string, body = '') {
  const response = { writeHead: vi.fn(), end: vi.fn() };
  const incoming = {
    method,
    url,
    headers: {},
    async *[Symbol.asyncIterator]() {
      if (body) yield Buffer.from(body);
    },
  };
  await mocks.handler!(incoming, response);
  return response;
}

describe('local contact API', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.queueUrl.mockResolvedValue('http://localstack:4566/queue/contact');
    mocks.send.mockResolvedValue({});
    await import('@/workers/local/contact-api');
  });

  it('starts on the configured port and handles preflight and unknown routes', async () => {
    expect(mocks.listen).toHaveBeenCalledWith(8787, expect.any(Function));
    const preflight = await request('OPTIONS', '/anything');
    expect(preflight.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'access-control-allow-origin': 'http://localhost:3000' }));
    expect(preflight.end).toHaveBeenCalledWith('');

    const notFound = await request('GET', '/api/contact');
    expect(notFound.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(notFound.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Not found' }));
  });

  it.each([
    { ...validForm, name: ' ' },
    { ...validForm, email: 'invalid' },
    { ...validForm, subject: '' },
    { ...validForm, message: ' ' },
    { ...validForm, 'cf-turnstile-response': '' },
  ])('rejects invalid form data', async (form) => {
    const response = await request('POST', '/api/contact', JSON.stringify(form));

    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Invalid form submission' }));
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('trims valid submissions before queueing them', async () => {
    const response = await request('POST', '/api/contact', JSON.stringify(validForm));

    expect(mocks.SendMessageCommand).toHaveBeenCalledWith({
      QueueUrl: 'http://localstack:4566/queue/contact',
      MessageBody: JSON.stringify({ name: 'Ada Lovelace', email: 'ada@example.com', subject: 'Hello', message: 'Test message' }),
    });
    expect(response.writeHead).toHaveBeenCalledWith(202, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ success: true, message: 'Message queued successfully' }));
  });

  it.each([
    ['invalid JSON', '{'],
    ['a queue failure', JSON.stringify(validForm)],
  ])('logs and returns 500 for %s', async (description, body) => {
    const error = new Error('LocalStack unavailable');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    if (description === 'a queue failure') mocks.send.mockRejectedValueOnce(error);

    const response = await request('POST', '/api/contact', body);

    expect(response.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ error: 'Internal server error' }));
    expect(consoleError).toHaveBeenCalledWith('Unable to queue contact form submission:', expect.any(Error));
  });
});
