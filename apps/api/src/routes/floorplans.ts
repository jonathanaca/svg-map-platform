import { Router } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import {
  getFloorplan,
  updateFloorplan,
  deleteFloorplan,
  createFloorplanVersion,
  listVersions,
  getVersion,
} from '../db/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FLOORPLAN_UPLOADS = path.resolve(__dirname, '../../../../storage/uploads/floorplans');

// Ensure upload directory exists
if (!fs.existsSync(FLOORPLAN_UPLOADS)) {
  fs.mkdirSync(FLOORPLAN_UPLOADS, { recursive: true });
}

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const router = Router();

// Get floorplan
router.get('/:id', (req, res) => {
  try {
    const floorplan = getFloorplan(req.params.id);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }
    res.json(floorplan);
  } catch (err) {
    console.error('Get floorplan error:', err);
    res.status(500).json({ error: 'Failed to get floorplan' });
  }
});

// Delete floorplan
router.delete('/:id', (req, res) => {
  try {
    const floorplan = getFloorplan(req.params.id);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }
    deleteFloorplan(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete floorplan error:', err);
    res.status(500).json({ error: 'Failed to delete floorplan' });
  }
});

// Update floorplan fields
router.put('/:id', (req, res) => {
  try {
    const floorplan = getFloorplan(req.params.id);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }
    updateFloorplan(req.params.id, req.body);
    const updated = getFloorplan(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Update floorplan error:', err);
    res.status(500).json({ error: 'Failed to update floorplan' });
  }
});

// Save canvas state (auto-save)
router.post('/:id/save', (req, res) => {
  try {
    const floorplan = getFloorplan(req.params.id);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }
    const { canvas_state, svg_output } = req.body;
    const fields: Record<string, unknown> = {};
    if (canvas_state !== undefined) fields.canvas_state = canvas_state;
    if (svg_output !== undefined) fields.svg_output = svg_output;
    updateFloorplan(req.params.id, fields);
    res.json({ success: true, saved_at: new Date().toISOString() });
  } catch (err) {
    console.error('Save floorplan error:', err);
    res.status(500).json({ error: 'Failed to save floorplan' });
  }
});

// Upload source image (JPEG, PNG, PDF, SVG — processed to PNG)
router.post('/:id/upload-source', upload.single('source'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const floorplan = getFloorplan(id);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const mime = req.file.mimetype;
    const origName = req.file.originalname.toLowerCase();
    const outputFilename = `${id}.png`;
    const outputPath = path.join(FLOORPLAN_UPLOADS, outputFilename);
    let width: number;
    let height: number;

    if (mime === 'application/pdf' || origName.endsWith('.pdf')) {
      // ── PDF: convert first page to PNG via Sharp (libvips with poppler) ──
      try {
        // Sharp can handle PDFs if libvips was built with poppler support
        const info = await sharp(req.file.buffer, { density: 200, page: 0 })
          .png()
          .toFile(outputPath);
        width = info.width;
        height = info.height;
      } catch (sharpErr) {
        // Fallback: try pdfjs-dist + node-canvas
        try {
          const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
          const { createCanvas } = await import('canvas');

          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(req.file.buffer) });
          const pdfDoc = await loadingTask.promise;
          const page = await pdfDoc.getPage(1);

          const scale = 2;
          const viewport = page.getViewport({ scale });
          const canvas = createCanvas(viewport.width, viewport.height);
          const ctx = canvas.getContext('2d');

          await page.render({ canvasContext: ctx as any, viewport }).promise;

          const pngBuffer = canvas.toBuffer('image/png');
          const info = await sharp(pngBuffer).png().toFile(outputPath);
          width = info.width;
          height = info.height;
        } catch (fallbackErr) {
          res.status(400).json({
            error: 'PDF conversion failed. Please convert your PDF to PNG or JPEG first and upload that instead.',
            details: [{ field: 'file', message: String(sharpErr) }],
          });
          return;
        }
      }

    } else if (mime === 'image/svg+xml' || origName.endsWith('.svg')) {
      // ── SVG: save as-is and also render to PNG for canvas background ──
      const svgPath = path.join(FLOORPLAN_UPLOADS, `${id}.svg`);
      fs.writeFileSync(svgPath, req.file.buffer);

      // Convert SVG to PNG via Sharp
      const info = await sharp(req.file.buffer, { density: 150 }).png().toFile(outputPath);
      width = info.width;
      height = info.height;

      // Also store the original SVG
      updateFloorplan(id, { svg_output: req.file.buffer.toString('utf-8') });

    } else {
      // ── Raster image: JPEG, PNG, WebP, TIFF ──
      const image = sharp(req.file.buffer).rotate().toColorspace('srgb');
      const metadata = await image.metadata();

      if (!metadata.format || !['jpeg', 'png', 'webp', 'tiff'].includes(metadata.format)) {
        res.status(400).json({
          error: 'Unsupported file type. Accepted: JPEG, PNG, WebP, TIFF, PDF, SVG.',
          details: [{ field: 'file', message: `Detected format: ${metadata.format ?? 'unknown'}` }],
        });
        return;
      }

      const info = await image.png({ quality: 90 }).toFile(outputPath);
      width = info.width;
      height = info.height;
    }

    updateFloorplan(id, {
      source_image_path: outputPath,
      source_type: 'image/png',
      canvas_width: width,
      canvas_height: height,
    });

    res.json({
      success: true,
      previewUrl: `/api/floorplans/${id}/source-preview`,
      width,
      height,
    });
  } catch (err) {
    console.error('Upload source error:', err);
    res.status(500).json({ error: 'Failed to upload source image' });
  }
});

// Serve source image preview
router.get('/:id/source-preview', (req, res) => {
  try {
    const floorplan = getFloorplan(req.params.id);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }

    // Try source image file first
    if (floorplan.source_image_path) {
      const filepath = floorplan.source_image_path as string;
      if (fs.existsSync(filepath)) {
        const sourceType = (floorplan.source_type as string) || 'image/png';
        res.setHeader('Content-Type', sourceType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.sendFile(filepath);
        return;
      }
    }

    // Fall back to svg_output (for SVG imports)
    if (floorplan.svg_output) {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(floorplan.svg_output);
      return;
    }

    res.status(404).json({ error: 'No source image found' });
  } catch (err) {
    console.error('Source preview error:', err);
    res.status(500).json({ error: 'Failed to serve source image' });
  }
});

// List versions
router.get('/:id/versions', (req, res) => {
  try {
    const floorplan = getFloorplan(req.params.id);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }
    const versions = listVersions(req.params.id);
    res.json(versions);
  } catch (err) {
    console.error('List versions error:', err);
    res.status(500).json({ error: 'Failed to list versions' });
  }
});

// Create named version snapshot
router.post('/:id/versions', (req, res) => {
  try {
    const floorplan = getFloorplan(req.params.id);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }

    const canvasState = floorplan.canvas_state;
    if (!canvasState) {
      res.status(400).json({ error: 'No canvas state to snapshot' });
      return;
    }

    const currentVersion = (floorplan.version as number) ?? 1;
    const newVersion = currentVersion + 1;
    const versionId = crypto.randomUUID();
    const { note } = req.body;

    createFloorplanVersion(
      versionId,
      req.params.id,
      newVersion,
      JSON.stringify(canvasState),
      (floorplan.svg_output as string) ?? undefined,
      note
    );

    updateFloorplan(req.params.id, { version: newVersion });

    res.status(201).json({
      id: versionId,
      version: newVersion,
      note: note ?? null,
    });
  } catch (err) {
    console.error('Create version error:', err);
    res.status(500).json({ error: 'Failed to create version' });
  }
});

// Restore canvas state from version
router.post('/:id/versions/:versionId/restore', (req, res) => {
  try {
    const floorplan = getFloorplan(req.params.id);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }

    const version = getVersion(req.params.versionId);
    if (!version) {
      res.status(404).json({ error: 'Version not found' });
      return;
    }

    updateFloorplan(req.params.id, {
      canvas_state: version.canvas_state,
      svg_output: version.svg_output ?? null,
    });

    res.json({ success: true, restored_version: version.version });
  } catch (err) {
    console.error('Restore version error:', err);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

// Publish floorplan
router.post('/:id/publish', (req, res) => {
  try {
    const floorplan = getFloorplan(req.params.id);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }

    const canvasState = floorplan.canvas_state;
    if (!canvasState) {
      res.status(400).json({ error: 'No canvas state to publish' });
      return;
    }

    const currentVersion = (floorplan.version as number) ?? 1;
    const newVersion = currentVersion + 1;
    const versionId = crypto.randomUUID();

    // Create version snapshot
    createFloorplanVersion(
      versionId,
      req.params.id,
      newVersion,
      JSON.stringify(canvasState),
      (floorplan.svg_output as string) ?? undefined,
      'Published'
    );

    // Update floorplan status and version
    updateFloorplan(req.params.id, {
      status: 'published',
      version: newVersion,
    });

    res.json({
      success: true,
      version: newVersion,
      status: 'published',
    });
  } catch (err) {
    console.error('Publish floorplan error:', err);
    res.status(500).json({ error: 'Failed to publish floorplan' });
  }
});

// Get generated SVG
router.get('/:id/svg', (req, res) => {
  try {
    const floorplan = getFloorplan(req.params.id);
    if (!floorplan) {
      res.status(404).json({ error: 'Floorplan not found' });
      return;
    }

    if (!floorplan.svg_output) {
      res.status(404).json({ error: 'No SVG output available' });
      return;
    }

    res.set('Content-Type', 'image/svg+xml');
    res.send(floorplan.svg_output);
  } catch (err) {
    console.error('Get SVG error:', err);
    res.status(500).json({ error: 'Failed to get SVG' });
  }
});

export default router;
