// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handler: undefined as undefined | ((request: AsyncIterable<Buffer> & { method?: string; url?: string; headers: object }, response: { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }) => Promise<void>),
  listen: vi.fn(),
  mkdirSync: vi.fn(),
  openD1Sqlite: vi.fn(),
  createHandler: vi.fn(),
  handle: vi.fn(),
  createTransport: vi.fn(),
  sendMail: vi.fn(),
  createNotificationSender: vi.fn(),
  deliver: vi.fn(),
}));

vi.mock('node:http', () => {
  const createServer = vi.fn((handler) => {
    mocks.handler = handler;
    return { listen: mocks.listen.mockImplementation((_port, callback) => callback()) };
  });
  return { createServer, default: { createServer } };
});
vi.mock('node:fs', () => ({ mkdirSync: mocks.mkdirSync, default: { mkdirSync: mocks.mkdirSync } }));
vi.mock('@/workers/local/d1-sqlite', () => ({ openD1Sqlite: mocks.openD1Sqlite }));
vi.mock('@/workers/study-group/handler', () => ({ createHandler: mocks.createHandler }));
vi.mock('@/workers/study-group/notification-sender', () => ({ createNotificationSender: mocks.createNotificationSender }));
vi.mock('nodemailer', () => ({ default: { createTransport: mocks.createTransport } }));

async function request(method: string, url: string, body = '') {
  const response = { writeHead: vi.fn(), end: vi.fn() };
  await mocks.handler!({
    method,
    url,
    headers: { 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() {
      if (body) yield Buffer.from(body);
    },
  }, response);
  return response;
}

describe('local study group API', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mocks.openD1Sqlite.mockReturnValue({ db: true });
    mocks.createHandler.mockReturnValue(mocks.handle);
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
    mocks.createNotificationSender.mockReturnValue(mocks.deliver);
  });

  it('starts with the default port, database path, origin and the local fake IdP', async () => {
    await import('@/workers/local/study-group-api');

    expect(mocks.listen).toHaveBeenCalledWith(8788, expect.any(Function));
    expect(mocks.mkdirSync).toHaveBeenCalledWith(expect.stringMatching(/tmp[\\/]study-group$/), { recursive: true });
    expect(mocks.openD1Sqlite).toHaveBeenCalledWith(
      expect.stringMatching(/tmp[\\/]study-group[\\/]local\.sqlite$/),
      expect.stringMatching(/workers[\\/]study-group[\\/]migrations$/)
    );
    expect(mocks.createHandler).toHaveBeenCalledWith({
      db: { db: true },
      allowedOrigins: ['http://localhost:3000'],
      appOrigin: 'http://localhost:3000',
      oidc: {
        provider: {
          issuers: ['http://localhost:8790'],
          authorizationEndpoint: 'http://localhost:8790/authorize',
          tokenEndpoint: 'http://localhost:8790/token',
          jwksUri: 'http://localhost:8790/jwks',
        },
        clientId: 'local-study-groups',
        clientSecret: 'local-study-groups-secret',
      },
      sessionSecret: '',
      platformAdminEmails: [],
      environment: 'local',
      unsubscribeSecret: '',
      notify: expect.any(Function),
      icons: expect.objectContaining({ put: expect.any(Function), get: expect.any(Function) }),
    });
    expect(mocks.createTransport).toHaveBeenCalledWith({ host: 'mailpit', port: 1025, secure: false });
    expect(mocks.createNotificationSender).toHaveBeenCalledWith(expect.objectContaining({
      db: { db: true }, environment: 'local', appOrigin: 'http://localhost:3000', unsubscribeSecret: '', allowlist: null, dailyCap: 500,
    }));
  });

  it('sends notifications in-process to Mailpit, from notifications@ with Reply-To groups@', async () => {
    await import('@/workers/local/study-group-api');
    const { notify } = mocks.createHandler.mock.calls[0][0];
    const past = new Date(Date.now() - 1000).toISOString();
    await notify([{ id: 3, sendAfter: past }, { id: 4, sendAfter: past }]);
    expect(mocks.deliver.mock.calls).toEqual([[3], [4]]);

    // A trailing digest waits for its time on a timer; a failure there is only logged.
    vi.useFakeTimers();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.deliver.mockClear().mockResolvedValue('sent').mockRejectedValueOnce(new Error('smtp down'));
    await notify([{ id: 5, sendAfter: new Date(Date.now() + 60_000).toISOString() }, { id: 6, sendAfter: new Date(Date.now() + 120_000).toISOString() }]);
    expect(mocks.deliver).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(mocks.deliver.mock.calls).toEqual([[5], [6]]);
    expect(error).toHaveBeenCalledWith('Unable to send study group notification', 5, expect.any(Error));
    vi.useRealTimers();

    mocks.sendMail.mockResolvedValue({ messageId: '<local@mailpit>' });
    const { send } = mocks.createNotificationSender.mock.calls[0][0];
    const email = { to: 'owner@example.test', subject: 'S', text: 'T', html: '<p>H</p>', headers: { 'List-Unsubscribe': '<x>' } };
    await expect(send(email)).resolves.toEqual({ messageId: '<local@mailpit>' });
    expect(mocks.sendMail).toHaveBeenCalledWith({
      from: { name: 'English Study Groups', address: 'notifications@fbrissi.dev' },
      to: 'owner@example.test',
      replyTo: 'groups@fbrissi.dev',
      subject: 'S',
      text: 'T',
      html: '<p>H</p>',
      headers: { 'List-Unsubscribe': '<x>' },
    });
  });

  it('uses environment overrides', async () => {
    vi.stubEnv('STUDY_GROUP_API_PORT', '9999');
    vi.stubEnv('STUDY_GROUP_DB_PATH', '/data/db.sqlite');
    vi.stubEnv('STUDY_GROUP_ALLOWED_ORIGINS', 'http://a.test,http://b.test');
    vi.stubEnv('STUDY_GROUP_APP_ORIGIN', 'http://b.test');
    vi.stubEnv('STUDY_GROUP_SESSION_SECRET', 'dev-secret');
    vi.stubEnv('STUDY_GROUP_PLATFORM_ADMIN_EMAILS', 'Admin@Example.test');
    vi.stubEnv('FAKE_IDP_PUBLIC_URL', 'http://idp.local:1');
    vi.stubEnv('FAKE_IDP_INTERNAL_URL', 'http://idp:1');
    vi.stubEnv('FAKE_IDP_CLIENT_ID', 'id');
    vi.stubEnv('FAKE_IDP_CLIENT_SECRET', 'secret');
    vi.stubEnv('STUDY_GROUP_UNSUBSCRIBE_SECRET', 'unsubscribe-secret');
    vi.stubEnv('MAILPIT_SMTP_HOST', 'mail.local');
    vi.stubEnv('MAILPIT_SMTP_PORT', '2525');
    await import('@/workers/local/study-group-api');
    vi.unstubAllEnvs();

    expect(mocks.listen).toHaveBeenCalledWith(9999, expect.any(Function));
    expect(mocks.openD1Sqlite).toHaveBeenCalledWith('/data/db.sqlite', expect.any(String));
    expect(mocks.createHandler).toHaveBeenCalledWith(expect.objectContaining({
      allowedOrigins: ['http://a.test', 'http://b.test'],
      appOrigin: 'http://b.test',
      oidc: {
        provider: { issuers: ['http://idp.local:1'], authorizationEndpoint: 'http://idp.local:1/authorize', tokenEndpoint: 'http://idp:1/token', jwksUri: 'http://idp:1/jwks' },
        clientId: 'id',
        clientSecret: 'secret',
      },
      sessionSecret: 'dev-secret',
      platformAdminEmails: ['admin@example.test'],
      unsubscribeSecret: 'unsubscribe-secret',
    }));
    expect(mocks.createTransport).toHaveBeenCalledWith({ host: 'mail.local', port: 2525, secure: false });
    expect(mocks.createNotificationSender).toHaveBeenCalledWith(expect.objectContaining({ appOrigin: 'http://b.test', unsubscribeSecret: 'unsubscribe-secret' }));
  });

  it('bridges node requests to the shared handler', async () => {
    mocks.handle.mockImplementation(async (incoming: Request) => Response.json({
      method: incoming.method,
      url: incoming.url,
      body: incoming.body ? await incoming.text() : null,
    }, { status: 201, headers: { 'X-Robots-Tag': 'noindex, nofollow' } }));
    await import('@/workers/local/study-group-api');

    const post = await request('POST', '/api/study-group/materials', '{"title":"A"}');
    expect(post.writeHead).toHaveBeenCalledWith(201, expect.objectContaining({ 'x-robots-tag': 'noindex, nofollow' }));
    expect(post.writeHead.mock.calls[0][1]).not.toHaveProperty('set-cookie');
    expect(JSON.parse(post.end.mock.calls[0][0].toString())).toEqual({
      method: 'POST',
      url: 'http://localhost:8788/api/study-group/materials',
      body: '{"title":"A"}',
    });

    const get = await request('GET', '/api/study-group/materials');
    expect(JSON.parse(get.end.mock.calls[0][0].toString())).toMatchObject({ method: 'GET', body: null });

    const headers = new Headers({ Location: '/next' });
    headers.append('Set-Cookie', 'a=1; Path=/');
    headers.append('Set-Cookie', 'b=2; Path=/');
    mocks.handle.mockResolvedValueOnce(new Response(null, { status: 302, headers }));
    const redirected = await request('GET', '/api/study-group/auth/callback');
    expect(redirected.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({ location: '/next', 'set-cookie': ['a=1; Path=/', 'b=2; Path=/'] }));
  });
});
