import { Router } from 'express';
import fs from 'fs';
import { getJob, updateJob } from '../db/schema.js';
import { getOutputPath, getDownloadUrl, getProcessedPath } from '../services/storage.js';
import { SvgBuilder } from '../services/svg-builder.js';
import { LayerManager } from '../services/layer-manager.js';
import type { BrandConfig, ImageMetadata } from '@svg-map/types';

const router = Router();

router.post('/:jobId/generate', (req, res) => {
  const { jobId } = req.params;

  try {
    const job = getJob(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const config = job.config as BrandConfig | null;
    const metadata = job.metadata as ImageMetadata | null;

    if (!config) {
      res.status(400).json({ error: 'Job has no brand config. Submit config first.' });
      return;
    }

    if (!metadata) {
      res.status(400).json({ error: 'Job has no image metadata. Upload an image first.' });
      return;
    }

    // Mark as generating
    updateJob(jobId, { status: 'generating' });

    // Build SVG
    const layer_manager = new LayerManager(config, metadata);
    const builder = new SvgBuilder(metadata.width, metadata.height);

    // Add a <title> for accessibility
    builder.addChild(builder.createElement('title', {}, [`${config.clientName} — Floor ${config.levelName} Map`]));

    // Add CSS rules
    for (const rule of layer_manager.getCssRules()) {
      builder.addCssRule(rule);
    }

    // Add symbol definitions (icons + furniture)
    for (const symbol of layer_manager.getSymbolDefs()) {
      builder.addDef(symbol);
    }

    // Embed the processed floorplan image as a base layer
    // Only when no vector tracing exists, or when explicitly requested
    const has_tracing = config.tracing &&
      (config.tracing.outlinePaths?.length > 0 || config.tracing.wallPaths?.length > 0);
    const embed_image = config.embedFloorplanImage ?? !has_tracing;

    if (embed_image) {
      const processed_path = getProcessedPath(`${jobId}.jpg`);
      if (fs.existsSync(processed_path)) {
        const image_buffer = fs.readFileSync(processed_path);
        const base64 = image_buffer.toString('base64');
        const data_uri = `data:image/jpeg;base64,${base64}`;

        builder.addChild(builder.createElement('image', {
          href: data_uri,
          x: '0',
          y: '0',
          width: String(metadata.width),
          height: String(metadata.height),
          preserveAspectRatio: 'xMidYMid meet',
        }));
      }
    }

    // Add layers in z-order
    for (const layer of layer_manager.generateLayers()) {
      builder.addChild(layer);
    }

    const svg_content = builder.render();

    // Persist output
    const output_filename = `${jobId}.svg`;
    const output_path = getOutputPath(output_filename);
    fs.writeFileSync(output_path, svg_content);

    updateJob(jobId, { status: 'complete', output_path: output_filename });

    const download_url = getDownloadUrl(output_filename);

    res.json({
      jobId,
      status: 'complete',
      downloadUrl: download_url,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown generation error';
    updateJob(jobId, { status: 'failed', error: message });
    res.status(500).json({ error: message });
  }
});

export default router;
