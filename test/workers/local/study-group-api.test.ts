// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handler: undefined as undefined | ((request: AsyncIterable<Buffer> & { method?: string; url?: string; headers: object }, response: { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }) => Promise<void>),
  listen: vi.fn(),
  mkdirSync: vi.fn(),
  openD1Sqlite: vi.fn(),
  createHandler: vi.fn(),
  handle: vi.fn(),
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
  });

  it('starts with the default port, database path, and origin', async () => {
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
      admin: { email: '', passwordHash: '', sessionSecret: '' },
    });
  });

  it('uses environment overrides', async () => {
    vi.stubEnv('STUDY_GROUP_API_PORT', '9999');
    vi.stubEnv('STUDY_GROUP_DB_PATH', '/data/db.sqlite');
    vi.stubEnv('STUDY_GROUP_ALLOWED_ORIGINS', 'http://a.test,http://b.test');
    vi.stubEnv('STUDY_GROUP_ADMIN_EMAIL', 'admin@example.test');
    vi.stubEnv('STUDY_GROUP_ADMIN_PASSWORD_HASH', 'pbkdf2-sha256$1$c2FsdA==$aGFzaA==');
    vi.stubEnv('STUDY_GROUP_SESSION_SECRET', 'dev-secret');
    await import('@/workers/local/study-group-api');
    vi.unstubAllEnvs();

    expect(mocks.listen).toHaveBeenCalledWith(9999, expect.any(Function));
    expect(mocks.openD1Sqlite).toHaveBeenCalledWith('/data/db.sqlite', expect.any(String));
    expect(mocks.createHandler).toHaveBeenCalledWith(expect.objectContaining({
      allowedOrigins: ['http://a.test', 'http://b.test'],
      admin: { email: 'admin@example.test', passwordHash: 'pbkdf2-sha256$1$c2FsdA==$aGFzaA==', sessionSecret: 'dev-secret' },
    }));
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
    expect(JSON.parse(post.end.mock.calls[0][0])).toEqual({
      method: 'POST',
      url: 'http://localhost:8788/api/study-group/materials',
      body: '{"title":"A"}',
    });

    const get = await request('GET', '/api/study-group/materials');
    expect(JSON.parse(get.end.mock.calls[0][0])).toMatchObject({ method: 'GET', body: null });
  });
});
