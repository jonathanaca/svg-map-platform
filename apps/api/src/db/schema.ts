import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../../../../data/svg-map.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'uploading',
      image_path TEXT,
      config TEXT,
      metadata TEXT,
      error TEXT,
      output_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export function createJob(id: string): void {
  getDb().prepare('INSERT INTO jobs (id) VALUES (?)').run(id);
}

interface JobRow {
  id: string;
  status: string;
  image_path: string | null;
  config: string | null;
  metadata: string | null;
  error: string | null;
  output_path: string | null;
  created_at: string;
  updated_at: string;
}

export function getJob(id: string) {
  const row = getDb().prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    image_path: row.image_path,
    config: row.config ? JSON.parse(row.config) : null,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    error: row.error,
    output_path: row.output_path,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function updateJob(id: string, fields: Record<string, unknown>): void {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = ?`);
    values.push(typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
  }

  sets.push("updated_at = datetime('now')");
  values.push(id);

  getDb().prepare(`UPDATE jobs SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}
