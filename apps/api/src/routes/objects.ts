import { Router } from 'express';
import crypto from 'crypto';
import {
  createObject,
  getObject,
  listObjects,
  updateObject,
  deleteObject,
  bulkUpsertObjects,
  getFloorplan,
} from '../db/schema.js';

const router = Router();

// List all objects for a floorplan
router.get('/floorplans/:floorplanId/objects', (req, res) => {
  try {
    const floorplan = getFloorplan(req.params.floorplanId);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }
    const objects = listObjects(req.params.floorplanId);
    res.json(objects);
  } catch (err) {
    console.error('List objects error:', err);
    res.status(500).json({ error: 'Failed to list objects' });
  }
});

// Create single object
router.post('/floorplans/:floorplanId/objects', (req, res) => {
  try {
    const floorplan = getFloorplan(req.params.floorplanId);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }

    const { object_type, geometry, ...fields } = req.body;
    if (!object_type || !geometry) {
      res.status(400).json({ error: 'object_type and geometry are required' });
      return;
    }

    // Convert booleans to integers for SQLite
    if (typeof fields.visible === 'boolean') fields.visible = fields.visible ? 1 : 0;
    if (typeof fields.locked === 'boolean') fields.locked = fields.locked ? 1 : 0;
    // Stringify arrays/objects
    if (Array.isArray(fields.amenities)) fields.amenities = JSON.stringify(fields.amenities);
    if (Array.isArray(fields.tags)) fields.tags = JSON.stringify(fields.tags);
    if (fields.metadata && typeof fields.metadata === 'object') fields.metadata = JSON.stringify(fields.metadata);

    const id = crypto.randomUUID();
    const geometryStr = typeof geometry === 'string' ? geometry : JSON.stringify(geometry);
    createObject(id, req.params.floorplanId, object_type, geometryStr, fields);
    const created = getObject(id);
    res.status(201).json(created);
  } catch (err) {
    console.error('Create object error:', err);
    res.status(500).json({ error: 'Failed to create object' });
  }
});

// Bulk upsert objects
router.post('/floorplans/:floorplanId/objects/bulk', (req, res) => {
  try {
    const floorplan = getFloorplan(req.params.floorplanId);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }

    const { objects } = req.body;
    if (!Array.isArray(objects)) {
      res.status(400).json({ error: 'objects array is required' });
      return;
    }

    // Ensure each object has an id and stringify geometry
    const prepared = objects.map((obj: Record<string, unknown>) => ({
      ...obj,
      id: obj.id ?? crypto.randomUUID(),
      object_type: obj.object_type ?? 'zone',
      geometry: typeof obj.geometry === 'string' ? obj.geometry : JSON.stringify(obj.geometry),
    }));

    bulkUpsertObjects(req.params.floorplanId, prepared);
    const updated = listObjects(req.params.floorplanId);
    res.json({ success: true, count: updated.length, objects: updated });
  } catch (err) {
    console.error('Bulk upsert error:', err);
    res.status(500).json({ error: 'Failed to bulk upsert objects' });
  }
});

// Update object
router.put('/objects/:id', (req, res) => {
  try {
    const obj = getObject(req.params.id);
    if (!obj) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }

    const fields = { ...req.body };
    // Stringify geometry if it's an object
    if (fields.geometry && typeof fields.geometry !== 'string') {
      fields.geometry = JSON.stringify(fields.geometry);
    }
    // Convert booleans to integers for SQLite
    if (typeof fields.visible === 'boolean') fields.visible = fields.visible ? 1 : 0;
    if (typeof fields.locked === 'boolean') fields.locked = fields.locked ? 1 : 0;
    // Stringify arrays/objects
    if (Array.isArray(fields.amenities)) fields.amenities = JSON.stringify(fields.amenities);
    if (Array.isArray(fields.tags)) fields.tags = JSON.stringify(fields.tags);
    if (fields.metadata && typeof fields.metadata === 'object') fields.metadata = JSON.stringify(fields.metadata);

    updateObject(req.params.id, fields);
    const updated = getObject(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Update object error:', err);
    res.status(500).json({ error: 'Failed to update object' });
  }
});

// Delete object
router.delete('/objects/:id', (req, res) => {
  try {
    const obj = getObject(req.params.id);
    if (!obj) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    deleteObject(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete object error:', err);
    res.status(500).json({ error: 'Failed to delete object' });
  }
});

// Export objects as CSV
router.get('/floorplans/:floorplanId/objects/csv', (req, res) => {
  try {
    const floorplan = getFloorplan(req.params.floorplanId);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }

    const objects = listObjects(req.params.floorplanId) as Record<string, unknown>[];
    const headers = [
      'id', 'floorplan_id', 'object_type', 'svg_id', 'label', 'geometry',
      'entity_type', 'entity_id', 'layer', 'fill_color', 'stroke_color',
      'opacity', 'capacity', 'amenities', 'tags', 'metadata',
      'group_id', 'z_index', 'locked', 'visible',
    ];

    const csvRows = [headers.join(',')];
    for (const obj of objects) {
      const row = headers.map((h) => {
        const val = obj[h];
        if (val === null || val === undefined) return '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        // Escape CSV fields containing commas, quotes, or newlines
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvRows.push(row.join(','));
    }

    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', `attachment; filename="objects-${req.params.floorplanId}.csv"`);
    res.send(csvRows.join('\n'));
  } catch (err) {
    console.error('Export CSV error:', err);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// Import objects from CSV
router.post('/floorplans/:floorplanId/objects/csv', (req, res) => {
  try {
    const floorplan = getFloorplan(req.params.floorplanId);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }

    const csvText = typeof req.body === 'string' ? req.body : req.body.csv;
    if (!csvText) {
      res.status(400).json({ error: 'CSV data is required (send as body.csv or text body)' });
      return;
    }

    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      res.status(400).json({ error: 'CSV must have a header row and at least one data row' });
      return;
    }

    // CSV parser that handles quoted fields with commas
    function parseCsvLine(line: string): string[] {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let c = 0; c < line.length; c++) {
        const ch = line[c];
        if (inQuotes) {
          if (ch === '"' && line[c + 1] === '"') { current += '"'; c++; }
          else if (ch === '"') { inQuotes = false; }
          else { current += ch; }
        } else {
          if (ch === '"') { inQuotes = true; }
          else if (ch === ',') { fields.push(current.trim()); current = ''; }
          else { current += ch; }
        }
      }
      fields.push(current.trim());
      return fields;
    }

    const headers = parseCsvLine(lines[0]);
    const existingObjects = listObjects(req.params.floorplanId) as Record<string, unknown>[];
    const svgIdMap = new Map<string, Record<string, unknown>>();
    for (const obj of existingObjects) {
      if (obj.svg_id) svgIdMap.set(obj.svg_id as string, obj);
    }

    let imported = 0;
    let updated = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const row: Record<string, unknown> = {};
      for (let j = 0; j < headers.length; j++) {
        const val = values[j] ?? '';
        row[headers[j]] = val === '' ? null : val;
      }

      const svgId = row.svg_id as string | null;
      if (svgId && svgIdMap.has(svgId)) {
        // Update existing object matched by svg_id
        const existing = svgIdMap.get(svgId)!;
        const updateFields: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          if (key === 'id' || key === 'floorplan_id') continue;
          if (value !== null) updateFields[key] = value;
        }
        updateObject(existing.id as string, updateFields);
        updated++;
      } else {
        // Create new object
        const id = (row.id as string) || crypto.randomUUID();
        const objectType = (row.object_type as string) || 'zone';
        const geometry = (row.geometry as string) || '{}';
        const fields: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          if (['id', 'floorplan_id', 'object_type', 'geometry'].includes(key)) continue;
          if (value !== null) fields[key] = value;
        }
        createObject(id, req.params.floorplanId, objectType, geometry, fields);
        imported++;
      }
    }

    res.json({ success: true, imported, updated });
  } catch (err) {
    console.error('Import CSV error:', err);
    res.status(500).json({ error: 'Failed to import CSV' });
  }
});

// Validate floorplan objects
router.get('/floorplans/:floorplanId/validate', (req, res) => {
  try {
    const floorplan = getFloorplan(req.params.floorplanId);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }

    const objects = listObjects(req.params.floorplanId) as Record<string, unknown>[];
    const issues: Array<{ type: string; object_id: string; message: string }> = [];

    const svgIds = new Set<string>();
    const duplicateSvgIds = new Set<string>();

    for (const obj of objects) {
      // Check for missing labels
      if (!obj.label) {
        issues.push({
          type: 'missing_label',
          object_id: obj.id as string,
          message: `Object ${obj.id} (${obj.object_type}) has no label`,
        });
      }

      // Check for duplicate svg_ids
      if (obj.svg_id) {
        const svgId = obj.svg_id as string;
        if (svgIds.has(svgId)) {
          duplicateSvgIds.add(svgId);
        }
        svgIds.add(svgId);
      }

      // Check for unbounded objects (empty or missing geometry)
      try {
        const geo = typeof obj.geometry === 'string' ? JSON.parse(obj.geometry as string) : obj.geometry;
        if (!geo || (typeof geo === 'object' && Object.keys(geo).length === 0)) {
          issues.push({
            type: 'unbounded',
            object_id: obj.id as string,
            message: `Object ${obj.id} (${obj.object_type}) has empty geometry`,
          });
        }
      } catch {
        issues.push({
          type: 'invalid_geometry',
          object_id: obj.id as string,
          message: `Object ${obj.id} (${obj.object_type}) has invalid geometry`,
        });
      }
    }

    // Add duplicate svg_id issues
    for (const svgId of duplicateSvgIds) {
      const dupes = objects.filter((o) => o.svg_id === svgId);
      for (const d of dupes) {
        issues.push({
          type: 'duplicate_svg_id',
          object_id: d.id as string,
          message: `Duplicate svg_id "${svgId}" on object ${d.id}`,
        });
      }
    }

    res.json({
      valid: issues.length === 0,
      object_count: objects.length,
      issue_count: issues.length,
      issues,
    });
  } catch (err) {
    console.error('Validate error:', err);
    res.status(500).json({ error: 'Failed to validate floorplan' });
  }
});

export default router;
