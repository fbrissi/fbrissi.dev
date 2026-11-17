// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { openD1Sqlite } from '@/workers/local/d1-sqlite';
import { createRepository, decodeCursor, isUniqueConstraintError } from '@/workers/study-group/repository';

import { migrationsDir } from './harness';

const now = new Date('2026-11-16T12:00:00.000Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe('study group repository', () => {
  it('purges deleted groups and content after 30 days, the log after 12 months and expired sessions', async () => {
    const db = openD1Sqlite(':memory:', migrationsDir);
    const repository = createRepository(db);
    await repository.createUser({ id: 'user0001', sub: 's', email: 'u@example.test', displayName: 'U' }, daysAgo(400));
    await db.batch([
      db.prepare("INSERT INTO groups (id, name, summary, meeting_day, meeting_start, meeting_end, timezone, access_code, created_at, updated_at, deleted_at) VALUES ('old', 'Old', 'Old group summary', 'Mon', '20:00', '21:00', 'UTC', 'c', 'x', 'x', ?)").bind(daysAgo(31)),
      db.prepare("INSERT INTO groups (id, name, summary, meeting_day, meeting_start, meeting_end, timezone, access_code, created_at, updated_at, deleted_at) VALUES ('recent', 'Recent', 'Recent group summary', 'Mon', '20:00', '21:00', 'UTC', 'c', 'x', 'x', ?)").bind(daysAgo(29)),
      db.prepare("INSERT INTO materials (group_id, suggested_by, type, title, created_at, deleted_at) VALUES ('devtalk', 'A', 'other', 'Old', 'x', ?)").bind(daysAgo(31)),
      db.prepare("INSERT INTO materials (group_id, suggested_by, type, title, created_at, deleted_at) VALUES ('devtalk', 'A', 'other', 'Recent', 'x', ?)").bind(daysAgo(29)),
      db.prepare("INSERT INTO materials (group_id, suggested_by, type, title, created_at) VALUES ('old', 'A', 'other', 'In old group', 'x')"),
      db.prepare("INSERT INTO join_requests (group_id, user_id, status, created_at, decided_at) VALUES ('devtalk', 'user0001', 'rejected', 'x', ?)").bind(daysAgo(31)),
      db.prepare("INSERT INTO join_requests (group_id, user_id, status, created_at) VALUES ('devtalk', 'user0001', 'pending', ?)").bind(daysAgo(90)),
      db.prepare("INSERT INTO moderation_actions (action, target_type, target_id, label, reason, created_at) VALUES ('delete_group', 'group', 'g', 'Old', 'Reason text', ?)").bind(daysAgo(366)),
      db.prepare("INSERT INTO moderation_actions (action, target_type, target_id, label, reason, created_at) VALUES ('delete_group', 'group', 'g', 'Recent', 'Reason text', ?)").bind(daysAgo(364)),
      db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ('expired', 'user0001', 'x', ?)").bind(daysAgo(1)),
      db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ('valid', 'user0001', 'x', ?)").bind(new Date(now.getTime() + 1000).toISOString()),
    ]);

    await repository.purgeExpired(now);

    const names = async (query: string) => (await db.prepare(query).all<{ name: string }>()).results.map((row) => row.name);
    expect(await names('SELECT id AS name FROM groups ORDER BY id')).toEqual(['devtalk', 'recent']);
    expect(await names('SELECT title AS name FROM materials ORDER BY id')).toEqual(['Recent']);
    expect(await names('SELECT status AS name FROM join_requests')).toEqual(['pending']);
    expect(await names('SELECT label AS name FROM moderation_actions')).toEqual(['Recent']);
    expect(await names('SELECT token_hash AS name FROM sessions')).toEqual(['valid']);
  });

  it('parses stored rules defensively', async () => {
    const db = openD1Sqlite(':memory:', migrationsDir);
    const repository = createRepository(db);
    for (const [rules, expected] of [['not json', []], ['{"a":1}', []], ['["One", 2]', ['One']]] as const) {
      await db.prepare("UPDATE groups SET rules = ? WHERE id = 'devtalk'").bind(rules).run();
      expect((await repository.getGroup('devtalk'))!.rules).toEqual(expected);
    }
  });

  it('restores nothing when the material is not deleted', async () => {
    const repository = createRepository(openD1Sqlite(':memory:', migrationsDir));
    expect(await repository.restoreMaterial('devtalk', 1, 'user')).toBeNull();
  });

  it('decodes only well-formed cursors and recognizes unique violations', () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(btoa('["a","b"]'))).toEqual(['a', 'b']);
    expect(decodeCursor(btoa('["a",1]'))).toBeNull();
    expect(decodeCursor('%%%')).toBeNull();
    expect(isUniqueConstraintError(new Error('UNIQUE constraint failed: x'))).toBe(true);
    expect(isUniqueConstraintError('UNIQUE constraint failed')).toBe(false);
  });
});
