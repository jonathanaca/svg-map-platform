import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { analyzeSvg } from '../services/svg-parser.js';
import {
  createProject,
  createFloorplan,
  updateFloorplan,
  bulkUpsertObjects,
} from '../db/schema.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Temporary in-memory store for SVG content between analyze and confirm steps
const tempStore = new Map<string, { svgContent: string; createdAt: number }>();

// Clean up entries older than 30 minutes
const TEMP_TTL_MS = 30 * 60 * 1000;

function cleanupTempStore(): void {
  const now = Date.now();
  for (const [key, entry] of tempStore) {
    if (now - entry.createdAt > TEMP_TTL_MS) {
      tempStore.delete(key);
    }
  }
}

// POST /api/import/svg/analyze - Upload SVG, return parsed structure
router.post('/svg/analyze', upload.single('svg'), (req, res) => {
  try {
    cleanupTempStore();

    if (!req.file) {
      res.status(400).json({ error: 'No SVG file provided. Use field name "svg".' });
      return;
    }

    const svgContent = req.file.buffer.toString('utf-8');

    // Basic validation: must contain <svg
    if (!svgContent.includes('<svg')) {
      res.status(400).json({ error: 'File does not appear to be a valid SVG document.' });
      return;
    }

    const analysis = analyzeSvg(svgContent);

    // Store SVG content temporarily for the confirm step
    const tempId = crypto.randomUUID();
    tempStore.set(tempId, { svgContent, createdAt: Date.now() });

    res.json({
      tempId,
      analysis,
    });
  } catch (err) {
    console.error('SVG analyze error:', err);
    res.status(500).json({ error: 'Failed to analyze SVG file.' });
  }
});

// GET /api/import/svg/preview/:tempId - Serve the temp SVG for preview/outline drawing
router.get('/svg/preview/:tempId', (req, res) => {
  const { tempId } = req.params;
  cleanupTempStore();
  const entry = tempStore.get(tempId);
  if (!entry) {
    res.status(404).json({ error: 'Temporary SVG data not found or expired.' });
    return;
  }
  res.type('image/svg+xml').send(entry.svgContent);
});

// POST /api/import/svg/confirm - Confirm import, create project + floorplan + objects
router.post('/svg/confirm', (req, res) => {
  try {
    const { tempId, projectName, floorName, objectMappings, outlinePoints } = req.body as {
      tempId: string;
      projectName: string;
      floorName: string;
      objectMappings?: Array<{
        svgId: string;
        objectType: string;
        label?: string;
      }>;
      outlinePoints?: Array<{ x: number; y: number }>;
    };

    if (!tempId) {
      res.status(400).json({ error: 'Missing tempId from analyze step.' });
      return;
    }

    if (!projectName || !floorName) {
      res.status(400).json({ error: 'projectName and floorName are required.' });
      return;
    }

    const tempEntry = tempStore.get(tempId);
    if (!tempEntry) {
      res.status(404).json({ error: 'Temporary SVG data not found or expired. Please re-upload.' });
      return;
    }

    const { svgContent } = tempEntry;

    // Re-analyze the SVG to get the full structure
    const analysis = analyzeSvg(svgContent);

    // Create project
    const projectId = uuidv4();
    createProject(projectId, projectName);

    // Create floorplan
    const floorplanId = uuidv4();
    createFloorplan(floorplanId, projectId, floorName, 0);

    // Update floorplan with SVG content and dimensions
    const canvasState: Record<string, unknown> = {};
    if (outlinePoints && outlinePoints.length >= 3) {
      canvasState.outlinePoints = outlinePoints;
    }
    updateFloorplan(floorplanId, {
      svg_output: svgContent,
      canvas_width: analysis.width,
      canvas_height: analysis.height,
      source_type: 'svg-import',
      status: 'imported',
      canvas_state: Object.keys(canvasState).length > 0 ? JSON.stringify(canvasState) : undefined,
    });

    // Build a mapping lookup from objectMappings
    const mappingBysvgId = new Map<string, { objectType: string; label?: string }>();
    if (objectMappings && Array.isArray(objectMappings)) {
      for (const mapping of objectMappings) {
        mappingBysvgId.set(mapping.svgId, mapping);
      }
    }

    // Create objects — only import objects the user explicitly included
    const objectRecords: Array<Record<string, unknown>> = [];

    for (const parsedObj of analysis.objects) {
      const userMapping = mappingBysvgId.get(parsedObj.svgId);

      // Only import objects that were included by the user (present in objectMappings)
      if (!userMapping) {
        continue;
      }

      const objectType = userMapping.objectType ?? parsedObj.suggestedType;
      const label = userMapping.label ?? parsedObj.label ?? parsedObj.svgId;

      objectRecords.push({
        id: uuidv4(),
        object_type: objectType,
        svg_id: parsedObj.svgId,
        label,
        geometry: JSON.stringify(parsedObj.geometry),
        layer: parsedObj.layer ?? 'objects',
        metadata: JSON.stringify({
          source: 'svg-import',
          originalTag: parsedObj.tag,
          originalAttributes: parsedObj.attributes,
        }),
      });
    }

    if (objectRecords.length > 0) {
      bulkUpsertObjects(floorplanId, objectRecords);
    }

    // Clean up temp store
    tempStore.delete(tempId);

    res.status(201).json({
      projectId,
      floorplanId,
      objectCount: objectRecords.length,
      skippedDecorative: analysis.objects.length - objectRecords.length,
      issues: analysis.issues,
    });
  } catch (err) {
    console.error('SVG confirm error:', err);
    res.status(500).json({ error: 'Failed to confirm SVG import.' });
  }
});

export default router;
