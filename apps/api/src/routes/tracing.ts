import { Router } from 'express';
import type { TracingData } from '@svg-map/types';
import { getJob, updateJob } from '../db/schema.js';

const router = Router();

// Save tracing data (outline paths, wall paths, space highlights)
router.post('/:jobId/tracing', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = getJob(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const tracing = req.body as TracingData;

    // Merge tracing into existing config
    const existing_config = job.config ?? {};
    const updated_config = { ...existing_config, tracing };

    updateJob(jobId, { config: updated_config });
    res.status(200).json({ jobId, status: 'ok' });
  } catch (err) {
    console.error('Tracing save error:', err);
    res.status(500).json({ error: 'Failed to save tracing data' });
  }
});

// Get tracing data
router.get('/:jobId/tracing', (req, res) => {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const tracing: TracingData = job.config?.tracing ?? {
    outlinePaths: [],
    wallPaths: [],
    spaceHighlights: [],
  };

  res.json(tracing);
});

export default router;
