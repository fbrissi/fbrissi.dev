// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openD1Sqlite } from '@/workers/local/d1-sqlite';

const dirs: string[] = [];

function tempDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'd1-sqlite-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('local D1 sqlite shim', () => {
  it('runs prepared statements without migrations', async () => {
    const db = openD1Sqlite(':memory:');
    await db.prepare('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)').run();
    await db.prepare('INSERT INTO items (name) VALUES (?)').bind(undefined).run();
    await db.prepare('INSERT INTO items (name) VALUES (?)').bind('b').run();

    expect(await db.prepare('SELECT name FROM items WHERE id = ?').bind(2).first()).toEqual({ name: 'b' });
    expect(await db.prepare('SELECT name FROM items WHERE id = ?').bind(9).first()).toBeNull();
    expect((await db.prepare('SELECT name FROM items ORDER BY id').all()).results).toEqual([{ name: null }, { name: 'b' }]);
  });

  it('runs batches atomically', async () => {
    const db = openD1Sqlite(':memory:');
    await db.prepare('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT UNIQUE)').run();

    const results = await db.batch([
      db.prepare('INSERT INTO items (name) VALUES (?) RETURNING id').bind('a'),
      db.prepare('INSERT INTO items (name) VALUES (?) RETURNING id').bind('b'),
    ]);
    expect(results).toEqual([{ results: [{ id: 1 }] }, { results: [{ id: 2 }] }]);

    await expect(db.batch([
      db.prepare('INSERT INTO items (name) VALUES (?)').bind('c'),
      db.prepare('INSERT INTO items (name) VALUES (?)').bind('a'),
    ])).rejects.toThrow(/UNIQUE constraint failed/);
    expect((await db.prepare('SELECT COUNT(*) AS total FROM items').first())).toEqual({ total: 2 });
  });

  it('applies pending migrations once and persists them', async () => {
    const dir = tempDir();
    const migrations = path.join(dir, 'migrations');
    const file = path.join(dir, 'db.sqlite');
    mkdirSync(migrations);
    writeFileSync(path.join(migrations, '0001_init.sql'), 'CREATE TABLE items (id INTEGER PRIMARY KEY);');
    writeFileSync(path.join(migrations, 'README.md'), 'ignored');

    openD1Sqlite(file, migrations);
    writeFileSync(path.join(migrations, '0002_more.sql'), 'ALTER TABLE items ADD COLUMN name TEXT;');
    const db = openD1Sqlite(file, migrations);

    const applied = await db.prepare('SELECT name FROM d1_migrations ORDER BY id').all();
    expect(applied.results).toEqual([{ name: '0001_init.sql' }, { name: '0002_more.sql' }]);
    await db.prepare('INSERT INTO items (name) VALUES (?)').bind('ok').run();
  });

  it('rolls back a failing migration', async () => {
    const dir = tempDir();
    const file = path.join(dir, 'db.sqlite');
    writeFileSync(path.join(dir, '0001_broken.sql'), 'CREATE TABLE items (id INTEGER); INSERT INTO missing VALUES (1);');

    expect(() => openD1Sqlite(file, dir)).toThrow(/no such table/);
    const db = openD1Sqlite(file);
    expect((await db.prepare('SELECT COUNT(*) AS total FROM d1_migrations').first())).toEqual({ total: 0 });
    expect(await db.prepare("SELECT name FROM sqlite_master WHERE name = 'items'").first()).toBeNull();
  });
});
