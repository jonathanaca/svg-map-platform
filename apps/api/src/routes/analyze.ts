import { Router } from 'express';
import { getJob, updateJob } from '../db/schema.js';
import { getProcessedPath } from '../services/storage.js';
import { analyzeFloorplan } from '../services/vision-analyzer.js';
import type { ImageMetadata } from '@svg-map/types';

const router = Router();

router.post('/:jobId/analyze', async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = getJob(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const metadata = job.metadata as ImageMetadata | null;
    if (!metadata) {
      res.status(400).json({ error: 'Job has no image metadata. Upload an image first.' });
      return;
    }

    const processed_path = getProcessedPath(`${jobId}.jpg`);
    const result = await analyzeFloorplan(processed_path, metadata.width, metadata.height);

    // Only save detected rooms — outline/walls from vision AI are unreliable
    res.json({ rooms: result.rooms });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed';
    console.error('Analysis error:', message);
    res.status(500).json({ error: message });
  }
});

export default router;
