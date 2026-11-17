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
