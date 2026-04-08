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

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      building_name TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS floorplans (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      floor_name TEXT NOT NULL,
      floor_index INTEGER DEFAULT 0,
      source_image_path TEXT,
      source_type TEXT,
      background_opacity REAL DEFAULT 0.3,
      background_locked INTEGER DEFAULT 1,
      scale_px_per_meter REAL,
      canvas_width REAL,
      canvas_height REAL,
      canvas_state TEXT,
      svg_output TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      version INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS floorplan_versions (
      id TEXT PRIMARY KEY,
      floorplan_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      canvas_state TEXT NOT NULL,
      svg_output TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (floorplan_id) REFERENCES floorplans(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS floorplan_objects (
      id TEXT PRIMARY KEY,
      floorplan_id TEXT NOT NULL,
      object_type TEXT NOT NULL,
      svg_id TEXT,
      label TEXT,
      geometry TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      layer TEXT DEFAULT 'objects',
      fill_color TEXT,
      stroke_color TEXT,
      opacity REAL DEFAULT 1.0,
      capacity INTEGER,
      amenities TEXT,
      tags TEXT,
      metadata TEXT,
      group_id TEXT,
      z_index INTEGER DEFAULT 0,
      locked INTEGER DEFAULT 0,
      visible INTEGER DEFAULT 1,
      FOREIGN KEY (floorplan_id) REFERENCES floorplans(id) ON DELETE CASCADE
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

// ── Projects ────────────────────────────────────────────────────────

export function createProject(id: string, name: string, buildingName?: string): void {
  getDb()
    .prepare('INSERT INTO projects (id, name, building_name) VALUES (?, ?, ?)')
    .run(id, name, buildingName ?? null);
}

export function getProject(id: string) {
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return row;
}

export function listProjects() {
  return getDb().prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
}

export function updateProject(id: string, fields: Record<string, unknown>): void {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = ?`);
    values.push(typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
  }

  sets.push("updated_at = datetime('now')");
  values.push(id);

  getDb().prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteProject(id: string): void {
  const d = getDb();
  const floorplans = d.prepare('SELECT id FROM floorplans WHERE project_id = ?').all(id) as { id: string }[];
  for (const fp of floorplans) {
    d.prepare('DELETE FROM floorplan_objects WHERE floorplan_id = ?').run(fp.id);
    d.prepare('DELETE FROM floorplan_versions WHERE floorplan_id = ?').run(fp.id);
  }
  d.prepare('DELETE FROM floorplans WHERE project_id = ?').run(id);
  d.prepare('DELETE FROM projects WHERE id = ?').run(id);
}

// ── Floorplans ──────────────────────────────────────────────────────

export function createFloorplan(id: string, projectId: string, floorName: string, floorIndex?: number): void {
  getDb()
    .prepare('INSERT INTO floorplans (id, project_id, floor_name, floor_index) VALUES (?, ?, ?, ?)')
    .run(id, projectId, floorName, floorIndex ?? 0);
}

export function getFloorplan(id: string): Record<string, unknown> | null {
  const row = getDb().prepare('SELECT * FROM floorplans WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    ...row,
    canvas_state: row.canvas_state ? JSON.parse(row.canvas_state as string) : null,
  };
}

export function listFloorplans(projectId: string) {
  return getDb().prepare('SELECT * FROM floorplans WHERE project_id = ? ORDER BY floor_index').all(projectId);
}

export function updateFloorplan(id: string, fields: Record<string, unknown>): void {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = ?`);
    values.push(typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
  }

  sets.push("updated_at = datetime('now')");
  values.push(id);

  getDb().prepare(`UPDATE floorplans SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteFloorplan(id: string): void {
  const d = getDb();
  d.prepare('DELETE FROM floorplan_objects WHERE floorplan_id = ?').run(id);
  d.prepare('DELETE FROM floorplan_versions WHERE floorplan_id = ?').run(id);
  d.prepare('DELETE FROM floorplans WHERE id = ?').run(id);
}

// ── Floorplan Versions ──────────────────────────────────────────────

export function createFloorplanVersion(
  id: string,
  floorplanId: string,
  version: number,
  canvasState: string,
  svgOutput?: string,
  note?: string
): void {
  getDb()
    .prepare(
      'INSERT INTO floorplan_versions (id, floorplan_id, version, canvas_state, svg_output, note) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(id, floorplanId, version, canvasState, svgOutput ?? null, note ?? null);
}

export function listVersions(floorplanId: string) {
  return getDb()
    .prepare('SELECT * FROM floorplan_versions WHERE floorplan_id = ? ORDER BY version DESC')
    .all(floorplanId);
}

export function getVersion(id: string): Record<string, unknown> | null {
  const row = getDb().prepare('SELECT * FROM floorplan_versions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    ...row,
    canvas_state: row.canvas_state ? JSON.parse(row.canvas_state as string) : null,
  };
}

// ── Floorplan Objects ───────────────────────────────────────────────

export function createObject(
  id: string,
  floorplanId: string,
  objectType: string,
  geometry: string,
  fields?: Record<string, unknown>
): void {
  const cols = ['id', 'floorplan_id', 'object_type', 'geometry'];
  const placeholders = ['?', '?', '?', '?'];
  const vals: unknown[] = [id, floorplanId, objectType, geometry];

  if (fields) {
    for (const [key, value] of Object.entries(fields)) {
      cols.push(key);
      placeholders.push('?');
      vals.push(typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
    }
  }

  getDb()
    .prepare(`INSERT INTO floorplan_objects (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`)
    .run(...vals);
}

export function getObject(id: string) {
  const row = getDb().prepare('SELECT * FROM floorplan_objects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    ...row,
    geometry: row.geometry ? JSON.parse(row.geometry as string) : null,
    amenities: row.amenities ? JSON.parse(row.amenities as string) : null,
    tags: row.tags ? JSON.parse(row.tags as string) : null,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
  };
}

export function listObjects(floorplanId: string) {
  return getDb()
    .prepare('SELECT * FROM floorplan_objects WHERE floorplan_id = ? ORDER BY z_index')
    .all(floorplanId);
}

export function updateObject(id: string, fields: Record<string, unknown>): void {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    sets.push(`${key} = ?`);
    values.push(typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
  }

  values.push(id);

  getDb().prepare(`UPDATE floorplan_objects SET ${sets.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteObject(id: string): void {
  getDb().prepare('DELETE FROM floorplan_objects WHERE id = ?').run(id);
}

export function bulkUpsertObjects(floorplanId: string, objects: Array<Record<string, unknown>>): void {
  const d = getDb();
  const transaction = d.transaction(() => {
    d.prepare('DELETE FROM floorplan_objects WHERE floorplan_id = ?').run(floorplanId);

    for (const obj of objects) {
      const cols = ['id', 'floorplan_id'];
      const placeholders = ['?', '?'];
      const vals: unknown[] = [obj.id, floorplanId];

      for (const [key, value] of Object.entries(obj)) {
        if (key === 'id' || key === 'floorplan_id') continue;
        cols.push(key);
        placeholders.push('?');
        vals.push(typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
      }

      d.prepare(`INSERT INTO floorplan_objects (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`).run(...vals);
    }
  });

  transaction();
}
