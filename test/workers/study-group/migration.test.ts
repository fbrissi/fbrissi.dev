// @vitest-environment node
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { openD1Sqlite } from '@/workers/local/d1-sqlite';

import { migrationsDir } from './harness';

let workDir: string;

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

/** Applies 0001, seeds DevTalk data like production, then applies the rest. */
async function migrateFromV1(seed: (db: ReturnType<typeof openD1Sqlite>) => Promise<void>) {
  workDir = mkdtempSync(path.join(os.tmpdir(), 'study-group-migration-'));
  const dir = path.join(workDir, 'migrations');
  mkdirSync(dir);
  const file = path.join(workDir, 'db.sqlite');
  copyFileSync(path.join(migrationsDir, '0001_init.sql'), path.join(dir, '0001_init.sql'));
  await seed(openD1Sqlite(file, dir));
  copyFileSync(path.join(migrationsDir, '0002_groups_and_accounts.sql'), path.join(dir, '0002_groups_and_accounts.sql'));
  return openD1Sqlite(file, dir);
}

describe('0002 migration (D11, Q20)', () => {
  it('moves the DevTalk board into the devtalk group with no owner, keeping legacy names', async () => {
    const db = await migrateFromV1(async (v1) => {
      await v1.prepare("UPDATE group_info SET access_code = 'devtalk-code', meeting_url = 'https://meet.example.com/dev'").run();
      await v1.batch([
        v1.prepare("INSERT INTO materials (suggested_by, type, title, url, status, created_at) VALUES ('Ana', 'video', 'Talk', 'https://example.com/a', 'open', '2026-01-01T00:00:00.000Z')"),
        v1.prepare("INSERT INTO materials (suggested_by, type, title, status, created_at, discussed_at) VALUES ('Bruno', 'book', 'Book', 'discussed', '2026-01-02T00:00:00.000Z', '2026-01-03T00:00:00.000Z')"),
        v1.prepare("INSERT INTO materials (suggested_by, type, title, status, created_at, deleted_at) VALUES ('Caio', 'other', 'Gone', 'open', '2026-01-02T00:00:00.000Z', '2026-01-04T00:00:00.000Z')"),
        v1.prepare("INSERT INTO rounds (mode, status, created_at, closed_at, winner_material_id) VALUES ('vote', 'closed', '2026-01-05T00:00:00.000Z', '2026-01-05T01:00:00.000Z', 2)"),
        v1.prepare("INSERT INTO votes (round_id, material_id, voter_name, voter_name_norm, created_at) VALUES (1, 2, 'Ana', 'ana', '2026-01-05T00:10:00.000Z')"),
        v1.prepare("INSERT INTO votes (round_id, material_id, voter_name, voter_name_norm, created_at) VALUES (1, 2, 'Bruno', 'bruno', '2026-01-05T00:11:00.000Z')"),
        v1.prepare("INSERT INTO rounds (mode, status, created_at) VALUES ('vote', 'open', '2026-01-06T00:00:00.000Z')"),
        v1.prepare("INSERT INTO votes (round_id, material_id, voter_name, voter_name_norm, created_at) VALUES (2, 1, 'Ana', 'ana', '2026-01-06T00:10:00.000Z')"),
      ]);
    });

    const group = await db.prepare('SELECT * FROM groups').first();
    expect(group).toMatchObject({
      id: 'devtalk', owner_id: null, name: 'DevTalk', access_code: 'devtalk-code', meeting_url: 'https://meet.example.com/dev',
      summary: 'This group gives us a chance to improve our English skills, share thoughts and ideas, and ask for help.',
      meeting_day: 'Monday', moderation_mode: 'free', listed: 1, deleted_at: null,
    });
    expect(JSON.parse(String(group!.rules))).toHaveLength(5);

    const { results: materials } = await db.prepare('SELECT id, group_id, user_id, suggested_by, status, deleted_at, deleted_by_admin FROM materials ORDER BY id').all();
    expect(materials).toEqual([
      { id: 1, group_id: 'devtalk', user_id: null, suggested_by: 'Ana', status: 'open', deleted_at: null, deleted_by_admin: 0 },
      { id: 2, group_id: 'devtalk', user_id: null, suggested_by: 'Bruno', status: 'discussed', deleted_at: null, deleted_by_admin: 0 },
      { id: 3, group_id: 'devtalk', user_id: null, suggested_by: 'Caio', status: 'open', deleted_at: '2026-01-04T00:00:00.000Z', deleted_by_admin: 0 },
    ]);
    const { results: rounds } = await db.prepare('SELECT id, group_id, status, winner_material_id FROM rounds ORDER BY id').all();
    expect(rounds).toEqual([
      { id: 1, group_id: 'devtalk', status: 'closed', winner_material_id: 2 },
      { id: 2, group_id: 'devtalk', status: 'closed', winner_material_id: null },
    ]);
    const { results: votes } = await db.prepare('SELECT group_id, round_id, material_id, user_id, voter_name FROM votes ORDER BY id').all();
    expect(votes).toEqual([
      { group_id: 'devtalk', round_id: 1, material_id: 2, user_id: null, voter_name: 'Ana' },
      { group_id: 'devtalk', round_id: 1, material_id: 2, user_id: null, voter_name: 'Bruno' },
      { group_id: 'devtalk', round_id: 2, material_id: 1, user_id: null, voter_name: 'Ana' },
    ]);
    expect(await db.prepare("SELECT name FROM sqlite_master WHERE name IN ('group_info', 'materials_v2', 'rounds_v2', 'votes_v2')").first()).toBeNull();

    // Foreign keys point at the renamed tables, and the per-group unique indexes hold.
    const { results: foreignKeys } = await db.prepare("SELECT \"table\" FROM pragma_foreign_key_list('votes')").all();
    expect(foreignKeys.map((row) => row.table).sort()).toEqual(['groups', 'materials', 'rounds', 'users']);
    await db.prepare("INSERT INTO groups (id, name, summary, meeting_day, meeting_start, meeting_end, timezone, access_code, created_at, updated_at) VALUES ('other', 'Other', 'Other summary text here', 'Mon', '20:00', '21:00', 'UTC', 'code-123456', 'x', 'x')").run();
    await db.prepare("INSERT INTO materials (group_id, suggested_by, type, title, url, created_at) VALUES ('other', 'Dan', 'video', 'Same', 'https://example.com/a', 'x')").run();
    await expect(db.prepare("INSERT INTO materials (group_id, suggested_by, type, title, url, created_at) VALUES ('devtalk', 'Dan', 'video', 'Same', 'https://example.com/a', 'x')").run()).rejects.toThrow(/UNIQUE/);
    await db.prepare("INSERT INTO rounds (group_id, mode, status, created_at) VALUES ('other', 'vote', 'open', 'x')").run();
    await db.prepare("INSERT INTO rounds (group_id, mode, status, created_at) VALUES ('devtalk', 'vote', 'open', 'x')").run();
    await expect(db.prepare("INSERT INTO rounds (group_id, mode, status, created_at) VALUES ('devtalk', 'vote', 'open', 'y')").run()).rejects.toThrow(/UNIQUE/);

    const sequence = await db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'materials'").first();
    expect(Number(sequence!.seq)).toBeGreaterThanOrEqual(3);
  });

  it('generates an access code when DevTalk never had one', async () => {
    const db = await migrateFromV1(async () => undefined);
    const group = await db.prepare('SELECT access_code, meeting_url FROM groups').first<{ access_code: string; meeting_url: string | null }>();
    expect(group!.access_code).toMatch(/^[0-9a-f]{16}$/);
    expect(group!.meeting_url).toBeNull();
  });
});

describe('0004 migration (no soft delete)', () => {
  it('removes soft-deleted groups and materials with their dependents, and keeps owners on the log', async () => {
    workDir = mkdtempSync(path.join(os.tmpdir(), 'study-group-migration-'));
    const dir = path.join(workDir, 'migrations');
    mkdirSync(dir);
    const file = path.join(workDir, 'db.sqlite');
    for (const name of ['0001_init.sql', '0002_groups_and_accounts.sql', '0003_notifications.sql']) copyFileSync(path.join(migrationsDir, name), path.join(dir, name));
    const before = openD1Sqlite(file, dir);
    const group = (id: string, deletedAt: string | null) => before.prepare(
      "INSERT INTO groups (id, owner_id, name, summary, meeting_day, meeting_start, meeting_end, timezone, access_code, created_at, updated_at, deleted_at) VALUES (?, 'owner001', ?, 'A group summary text', 'Mon', '20:00', '21:00', 'UTC', 'c', 'x', 'x', ?)"
    ).bind(id, id, deletedAt);
    await before.batch([
      before.prepare("INSERT INTO users (id, google_sub, email, display_name, created_at, updated_at) VALUES ('owner001', 's', 'o@example.test', 'O', 'x', 'x')"),
      group('kept', null),
      group('gone', '2026-11-01T00:00:00.000Z'),
      before.prepare("INSERT INTO group_members (group_id, user_id, joined_at) VALUES ('gone', 'owner001', 'x')"),
      before.prepare("INSERT INTO join_requests (group_id, user_id, status, created_at) VALUES ('gone', 'owner001', 'pending', 'x')"),
      before.prepare("INSERT INTO materials (id, group_id, suggested_by, type, title, created_at) VALUES (1, 'gone', 'A', 'other', 'In deleted group', 'x')"),
      before.prepare("INSERT INTO materials (id, group_id, suggested_by, type, title, created_at) VALUES (2, 'kept', 'A', 'other', 'Kept', 'x')"),
      before.prepare("INSERT INTO materials (id, group_id, suggested_by, type, title, created_at, deleted_at, deleted_by_admin) VALUES (3, 'kept', 'A', 'other', 'Soft-deleted', 'x', 'x', 1)"),
      before.prepare("INSERT INTO rounds (id, group_id, mode, status, created_at, winner_material_id) VALUES (1, 'kept', 'vote', 'closed', 'x', 3)"),
      before.prepare("INSERT INTO rounds (id, group_id, mode, status, created_at) VALUES (2, 'gone', 'vote', 'closed', 'x')"),
      before.prepare("INSERT INTO votes (group_id, round_id, material_id, voter_name, created_at) VALUES ('kept', 1, 3, 'A', 'x')"),
      before.prepare("INSERT INTO votes (group_id, round_id, material_id, voter_name, created_at) VALUES ('kept', 1, 2, 'B', 'x')"),
      before.prepare("INSERT INTO votes (group_id, round_id, material_id, voter_name, created_at) VALUES ('gone', 2, 1, 'C', 'x')"),
      before.prepare("INSERT INTO moderation_actions (action, target_type, target_id, group_id, label, reason, created_at) VALUES ('delete_material', 'material', '3', 'kept', 'Soft-deleted', 'Reason text', 'x')"),
      before.prepare("INSERT INTO moderation_actions (action, target_type, target_id, group_id, label, reason, created_at) VALUES ('delete_group', 'group', 'gone', 'gone', 'gone', 'Reason text', 'x')"),
    ]);
    for (const name of ['0004_hard_delete.sql', '0005_icons_and_bans.sql']) copyFileSync(path.join(migrationsDir, name), path.join(dir, name));
    const db = openD1Sqlite(file, dir);

    const names = async (query: string) => (await db.prepare(query).all<{ name: unknown }>()).results.map((row) => row.name);
    expect(await names('SELECT id AS name FROM groups ORDER BY id')).toEqual(['devtalk', 'kept']);
    expect(await names('SELECT title AS name FROM materials')).toEqual(['Kept']);
    expect(await names('SELECT id AS name FROM rounds')).toEqual([1]);
    expect(await names('SELECT winner_material_id AS name FROM rounds')).toEqual([null]);
    expect(await names('SELECT voter_name AS name FROM votes')).toEqual(['B']);
    expect(await names('SELECT COUNT(*) AS name FROM group_members')).toEqual([0]);
    expect(await names('SELECT COUNT(*) AS name FROM join_requests')).toEqual([0]);
    // The log keeps both entries; the one for the deleted group had no surviving row to find its owner.
    expect(await names('SELECT owner_id AS name FROM moderation_actions ORDER BY id')).toEqual(['owner001', 'owner001']);
    expect(await names("SELECT name FROM sqlite_master WHERE name IN ('bans', 'icon_uploads') ORDER BY name")).toEqual(['bans', 'icon_uploads']);
  });
});

describe('0006 migration (meeting reminders)', () => {
  it('turns reminders on, normalizes weekday names and keeps the outbox while allowing the reminder kind', async () => {
    workDir = mkdtempSync(path.join(os.tmpdir(), 'study-group-migration-'));
    const dir = path.join(workDir, 'migrations');
    mkdirSync(dir);
    const file = path.join(workDir, 'db.sqlite');
    const before = ['0001_init.sql', '0002_groups_and_accounts.sql', '0003_notifications.sql', '0004_hard_delete.sql', '0005_icons_and_bans.sql'];
    for (const name of before) copyFileSync(path.join(migrationsDir, name), path.join(dir, name));
    const v5 = openD1Sqlite(file, dir);
    const group = (id: string, day: string) => v5.prepare(
      "INSERT INTO groups (id, owner_id, name, summary, meeting_day, meeting_start, meeting_end, timezone, access_code, created_at, updated_at) VALUES (?, 'owner001', ?, 'A group summary text', ?, '20:00', '21:00', 'UTC', 'c', 'x', 'x')"
    ).bind(id, id, day);
    await v5.batch([
      v5.prepare("INSERT INTO users (id, google_sub, email, display_name, created_at, updated_at) VALUES ('owner001', 's', 'o@example.test', 'O', 'x', 'x')"),
      group('a', ' tuesdays '),
      group('b', 'SUNDAY'),
      group('c', 'Every other Friday'),
      v5.prepare("INSERT INTO notifications (user_id, kind, group_id, payload, dedupe_key, status, attempts, created_at, send_after, sent_at) VALUES ('owner001', 'join_approved', 'a', '{\"groupName\":\"a\"}', 'k1', 'sent', 1, 'x', 'y', 'z')"),
    ]);
    copyFileSync(path.join(migrationsDir, '0006_meeting_reminders.sql'), path.join(dir, '0006_meeting_reminders.sql'));
    const db = openD1Sqlite(file, dir);

    expect((await db.prepare('SELECT id, meeting_day, meeting_reminders FROM groups ORDER BY id').all()).results).toEqual([
      { id: 'a', meeting_day: 'Tuesday', meeting_reminders: 1 },
      { id: 'b', meeting_day: 'Sunday', meeting_reminders: 1 },
      { id: 'c', meeting_day: 'Every other Friday', meeting_reminders: 1 },
      { id: 'devtalk', meeting_day: 'Monday', meeting_reminders: 1 },
    ]);
    expect(await db.prepare('SELECT id, kind, dedupe_key, status, attempts, sent_at FROM notifications').first())
      .toEqual({ id: 1, kind: 'join_approved', dedupe_key: 'k1', status: 'sent', attempts: 1, sent_at: 'z' });
    const next = await db.prepare("INSERT INTO notifications (user_id, kind, group_id, dedupe_key, created_at, send_after) VALUES ('owner001', 'meeting_reminder', 'a', 'k2', 'x', 'y') RETURNING id").first();
    expect(next).toEqual({ id: 2 });
    await expect(db.prepare("INSERT INTO notifications (user_id, kind, dedupe_key, created_at, send_after) VALUES ('owner001', 'other', 'k3', 'x', 'y')").run()).rejects.toThrow(/CHECK/);
    expect((await db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'notifications' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()).results.map((row) => row.name))
      .toEqual(['notifications_created_at', 'notifications_group_kind', 'notifications_status_created', 'notifications_user_sent']);
  });
});

describe('0007 migration (optional access code)', () => {
  it('keeps the access code required for existing groups and leaves new rows open by default', async () => {
    workDir = mkdtempSync(path.join(os.tmpdir(), 'study-group-migration-'));
    const dir = path.join(workDir, 'migrations');
    mkdirSync(dir);
    const file = path.join(workDir, 'db.sqlite');
    const before = ['0001_init.sql', '0002_groups_and_accounts.sql', '0003_notifications.sql', '0004_hard_delete.sql', '0005_icons_and_bans.sql', '0006_meeting_reminders.sql'];
    for (const name of before) copyFileSync(path.join(migrationsDir, name), path.join(dir, name));
    const v6 = openD1Sqlite(file, dir);
    await v6.batch([
      v6.prepare("INSERT INTO users (id, google_sub, email, display_name, created_at, updated_at) VALUES ('owner001', 's', 'o@example.test', 'O', 'x', 'x')"),
      v6.prepare("INSERT INTO groups (id, owner_id, name, summary, meeting_day, meeting_start, meeting_end, timezone, access_code, created_at, updated_at) VALUES ('a', 'owner001', 'A', 'A group summary text', 'Monday', '20:00', '21:00', 'UTC', 'code-a', 'x', 'x')"),
    ]);
    copyFileSync(path.join(migrationsDir, '0007_optional_access_code.sql'), path.join(dir, '0007_optional_access_code.sql'));
    const db = openD1Sqlite(file, dir);

    expect((await db.prepare('SELECT id, access_code, require_access_code FROM groups ORDER BY id').all()).results).toEqual([
      { id: 'a', access_code: 'code-a', require_access_code: 1 },
      { id: 'devtalk', access_code: expect.any(String), require_access_code: 1 },
    ]);
    await db.prepare("INSERT INTO groups (id, owner_id, name, summary, meeting_day, meeting_start, meeting_end, timezone, access_code, created_at, updated_at) VALUES ('b', 'owner001', 'B', 'B group summary text', 'Monday', '20:00', '21:00', 'UTC', 'code-b', 'x', 'x')").run();
    expect(await db.prepare("SELECT require_access_code FROM groups WHERE id = 'b'").first()).toEqual({ require_access_code: 0 });
    await expect(db.prepare("UPDATE groups SET require_access_code = 2 WHERE id = 'b'").run()).rejects.toThrow(/CHECK/);
  });
});

describe('0008 migration (round notifications)', () => {
  it('keeps the outbox while allowing the round kinds', async () => {
    workDir = mkdtempSync(path.join(os.tmpdir(), 'study-group-migration-'));
    const dir = path.join(workDir, 'migrations');
    mkdirSync(dir);
    const file = path.join(workDir, 'db.sqlite');
    const before = ['0001_init.sql', '0002_groups_and_accounts.sql', '0003_notifications.sql', '0004_hard_delete.sql', '0005_icons_and_bans.sql', '0006_meeting_reminders.sql', '0007_optional_access_code.sql'];
    for (const name of before) copyFileSync(path.join(migrationsDir, name), path.join(dir, name));
    const v7 = openD1Sqlite(file, dir);
    await v7.batch([
      v7.prepare("INSERT INTO users (id, google_sub, email, display_name, created_at, updated_at) VALUES ('owner001', 's', 'o@example.test', 'O', 'x', 'x')"),
      v7.prepare("INSERT INTO notifications (user_id, kind, group_id, payload, dedupe_key, status, attempts, created_at, send_after, sent_at) VALUES ('owner001', 'meeting_reminder', 'a', '{}', 'k1', 'sent', 1, 'x', 'y', 'z')"),
    ]);
    copyFileSync(path.join(migrationsDir, '0008_round_notifications.sql'), path.join(dir, '0008_round_notifications.sql'));
    const db = openD1Sqlite(file, dir);

    expect(await db.prepare('SELECT id, kind, dedupe_key, status, attempts, sent_at FROM notifications').first())
      .toEqual({ id: 1, kind: 'meeting_reminder', dedupe_key: 'k1', status: 'sent', attempts: 1, sent_at: 'z' });
    for (const [index, kind] of ['round_started', 'round_picked', 'round_cancelled'].entries()) {
      await db.prepare("INSERT INTO notifications (user_id, kind, group_id, dedupe_key, created_at, send_after) VALUES ('owner001', ?, 'a', ?, 'x', 'y')").bind(kind, `r${index}`).run();
    }
    expect((await db.prepare('SELECT COUNT(*) AS count FROM notifications').first())).toEqual({ count: 4 });
    await expect(db.prepare("INSERT INTO notifications (user_id, kind, dedupe_key, created_at, send_after) VALUES ('owner001', 'other', 'k3', 'x', 'y')").run()).rejects.toThrow(/CHECK/);
    expect((await db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'notifications' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()).results.map((row) => row.name))
      .toEqual(['notifications_created_at', 'notifications_group_kind', 'notifications_status_created', 'notifications_user_sent']);
  });
});
