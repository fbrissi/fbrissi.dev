import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { D1Like, D1StatementLike } from '../study-group/repository';

/** Minimal D1 stand-in over node:sqlite for local development. */
export function openD1Sqlite(filename: string, migrationsDir?: string): D1Like {
  const database = new DatabaseSync(filename);
  database.exec('PRAGMA foreign_keys = ON');
  if (migrationsDir) applyMigrations(database, migrationsDir);

  const statement = (query: string, values: SQLInputValue[] = []): D1StatementLike => ({
    bind: (...next: unknown[]) => statement(query, next.map(toSqlValue)),
    first: async <T>() => (database.prepare(query).get(...values) ?? null) as T | null,
    all: async <T>() => ({ results: database.prepare(query).all(...values) as T[] }),
    run: async () => database.prepare(query).run(...values),
  });

  return {
    prepare: (query) => statement(query),
    async batch(statements) {
      database.exec('BEGIN');
      try {
        const results = [];
        for (const item of statements) results.push(await item.all());
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

function applyMigrations(database: DatabaseSync, migrationsDir: string): void {
  database.exec(`CREATE TABLE IF NOT EXISTS d1_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`);
  const applied = new Set(
    (database.prepare('SELECT name FROM d1_migrations').all() as { name: string }[]).map((row) => row.name)
  );

  for (const name of readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort()) {
    if (applied.has(name)) continue;
    database.exec('BEGIN');
    try {
      database.exec(readFileSync(path.join(migrationsDir, name), 'utf8'));
      database.prepare('INSERT INTO d1_migrations (name) VALUES (?)').run(name);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
}

function toSqlValue(value: unknown): SQLInputValue {
  return value === undefined ? null : value as SQLInputValue;
}
