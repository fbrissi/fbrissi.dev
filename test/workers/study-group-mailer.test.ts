// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openD1Sqlite } from '@/workers/local/d1-sqlite';
import studyGroupMailer, { retryDelaySeconds, type Env, type QueueMessage } from '@/workers/study-group-mailer';
import type { D1Like } from '@/workers/study-group/repository';

import { migrationsDir } from './study-group/harness';

const workersDir = path.resolve(__dirname, '../../workers');
let db: D1Like;
let fetch: ReturnType<typeof vi.fn>;

function env(overrides: Partial<Env> = {}): Env {
  return {
    STUDY_GROUP_DB: db,
    STUDY_GROUP_ENVIRONMENT: 'production',
    STUDY_GROUP_SES_ACCESS_KEY_ID: 'AKID',
    STUDY_GROUP_SES_SECRET_ACCESS_KEY: 'secret',
    STUDY_GROUP_UNSUBSCRIBE_SECRET: 'unsub',
    ...overrides,
  };
}

function message(body: unknown, attempts = 1) {
  return { body, attempts, ack: vi.fn<() => void>(), retry: vi.fn<(options?: { delaySeconds?: number }) => void>() } satisfies QueueMessage;
}

const sentBody = (call = 0) => JSON.parse((fetch.mock.calls[call] as [string, RequestInit])[1].body as string);

beforeEach(async () => {
  db = openD1Sqlite(':memory:', migrationsDir);
  fetch = vi.fn(async () => Response.json({ MessageId: 'ses-1' }));
  vi.stubGlobal('fetch', fetch);
  await db.batch([
    db.prepare("INSERT INTO users (id, google_sub, email, display_name, created_at, updated_at) VALUES ('member01', 'm', 'member@example.test', 'Max', 'x', 'x')"),
    db.prepare(`INSERT INTO notifications (user_id, kind, group_id, payload, dedupe_key, created_at, send_after) VALUES ('member01', 'join_approved', 'gotalk', '{"groupName":"Go Talk"}', 'k', 'x', '2000-01-01T00:00:00.000Z')`),
  ]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('study group mailer Worker', () => {
  it('sends production notifications through SES us-east-1 and acks them', async () => {
    const queued = message({ id: 1 });
    await studyGroupMailer.queue({ messages: [queued] }, env());
    expect(queued.ack).toHaveBeenCalled();
    expect(fetch.mock.calls[0][0]).toBe('https://email.us-east-1.amazonaws.com/v2/email/outbound-emails');
    expect(sentBody().Content.Simple.Subject.Data).toBe('You joined Go Talk');
    expect(sentBody().Content.Simple.Headers[0].Value).toMatch(/^<https:\/\/fbrissi\.dev\/api\/study-group\/unsubscribe\?t=/);
  });

  it('treats any non-production environment as the sandbox: allowlisted testers only, with the [SANDBOX] prefix', async () => {
    await studyGroupMailer.queue({ messages: [message({ id: 1 })] }, env({ STUDY_GROUP_ENVIRONMENT: undefined, STUDY_GROUP_EMAIL_ALLOWLIST: 'tester@example.test' }));
    expect(fetch).not.toHaveBeenCalled();

    await db.prepare(`INSERT INTO notifications (user_id, kind, group_id, payload, dedupe_key, created_at, send_after) VALUES ('member01', 'join_rejected', 'gotalk', '{"groupName":"Go Talk"}', 'k2', 'x', '2000-01-01T00:00:00.000Z')`).run();
    await studyGroupMailer.queue({ messages: [message({ id: 2 })] }, env({ STUDY_GROUP_ENVIRONMENT: 'sandbox', STUDY_GROUP_EMAIL_ALLOWLIST: 'Member@Example.test', STUDY_GROUP_SES_REGION: 'us-west-2' }));
    expect(fetch.mock.calls[0][0]).toBe('https://email.us-west-2.amazonaws.com/v2/email/outbound-emails');
    expect(sentBody().Content.Simple.Subject.Data).toBe('[SANDBOX] Your request to join Go Talk');
    expect(sentBody().Content.Simple.Headers[0].Value).toMatch(/^<https:\/\/sandbox\.fbrissi\.dev\//);
  });

  it('acks malformed messages and retries failures with backoff, logging no address', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const malformed = [message(null), message({ id: '1' }), message({ id: 0 }), message('x')];
    await studyGroupMailer.queue({ messages: malformed }, env());
    for (const item of malformed) expect(item.ack).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(4);

    fetch.mockResolvedValueOnce(new Response('', { status: 503 }));
    const failing = message({ id: 1 }, 3);
    await studyGroupMailer.queue({ messages: [failing] }, env());
    expect(failing.retry).toHaveBeenCalledWith({ delaySeconds: 120 });
    expect(failing.ack).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('Unable to send study group notification', 1, 'SES SendEmail failed with 503 Unknown');

    const unconfigured = message({ id: 1 });
    await studyGroupMailer.queue({ messages: [unconfigured] }, env({ STUDY_GROUP_UNSUBSCRIBE_SECRET: undefined, STUDY_GROUP_SES_ACCESS_KEY_ID: undefined, STUDY_GROUP_SES_SECRET_ACCESS_KEY: undefined }));
    expect(unconfigured.retry).toHaveBeenCalled();
    error.mockClear();
    const thrown = message({ id: 1 });
    fetch.mockRejectedValueOnce('network down');
    await studyGroupMailer.queue({ messages: [thrown] }, env());
    expect(error).toHaveBeenCalledWith('Unable to send study group notification', 1, 'network down');
    expect(JSON.stringify(error.mock.calls)).not.toContain('@');
  });

  it('applies the daily cap from its variable, with a default', async () => {
    await studyGroupMailer.queue({ messages: [message({ id: 1 })] }, env({ STUDY_GROUP_EMAIL_DAILY_CAP: '0' }));
    expect(fetch).toHaveBeenCalledTimes(1);
    await db.prepare(`INSERT INTO notifications (user_id, kind, group_id, payload, dedupe_key, created_at, send_after) VALUES ('member01', 'join_rejected', 'gotalk', '{}', 'k2', 'x', '2000-01-01T00:00:00.000Z')`).run();
    await studyGroupMailer.queue({ messages: [message({ id: 2 })] }, env({ STUDY_GROUP_EMAIL_DAILY_CAP: '1' }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('puts back a message that is not due yet, with the remaining delay', async () => {
    await db.prepare(`INSERT INTO notifications (user_id, kind, group_id, payload, dedupe_key, created_at, send_after) VALUES ('member01', 'join_rejected', 'gotalk', '{}', 'k3', 'x', ?)`)
      .bind(new Date(Date.now() + 3_600_000).toISOString()).run();
    const early = message({ id: 2 });
    await studyGroupMailer.queue({ messages: [early] }, env());
    expect(early.retry).toHaveBeenCalledWith({ delaySeconds: expect.any(Number) });
    expect(early.retry.mock.calls[0][0]!.delaySeconds).toBeGreaterThan(3590);
    expect(early.ack).not.toHaveBeenCalled();
    await db.prepare('UPDATE notifications SET send_after = ? WHERE id = 2').bind(new Date(Date.now() + 3 * 86_400_000).toISOString()).run();
    const far = message({ id: 2 });
    await studyGroupMailer.queue({ messages: [far] }, env());
    expect(far.retry).toHaveBeenCalledWith({ delaySeconds: 86_400 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('backs off exponentially up to 15 minutes', () => {
    expect([0, 1, 2, 3, 6, 10].map(retryDelaySeconds)).toEqual([30, 30, 60, 120, 900, 900]);
  });

  it('keeps production and sandbox apart: own queue, dead-letter queue and database, no routes', () => {
    const config = readFileSync(path.join(workersDir, 'study-group-mailer/wrangler.toml'), 'utf8');
    const [production, sandbox] = config.split('\n[env.sandbox]\n');
    expect(production).toContain('queue = "fbrissi-dev-study-group-notify"');
    expect(production).toContain('dead_letter_queue = "fbrissi-dev-study-group-notify-dlq"');
    expect(production).toContain('database_name = "fbrissi-dev-study-group"');
    expect(production).toContain('STUDY_GROUP_ENVIRONMENT = "production"');
    expect(production).not.toMatch(/sandbox-study-group/);
    expect(sandbox).toContain('name = "fbrissi-dev-study-group-mailer-sandbox"');
    expect(sandbox).toContain('queue = "fbrissi-dev-sandbox-study-group-notify"');
    expect(sandbox).toContain('dead_letter_queue = "fbrissi-dev-sandbox-study-group-notify-dlq"');
    expect(sandbox).toContain('database_name = "fbrissi-dev-sandbox-study-group"');
    expect(sandbox).toContain('STUDY_GROUP_ENVIRONMENT = "sandbox"');
    expect(sandbox).not.toMatch(/"fbrissi-dev-study-group(-notify)?"/);
    expect(config).not.toMatch(/routes|ALLOWLIST =|SECRET =/);
  });
});
