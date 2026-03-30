import { Router } from 'express';
import type { BrandConfig } from '@svg-map/types';
import { getJob, updateJob } from '../db/schema.js';
import { validateBrandConfig } from '../validators/index.js';

const router = Router();

router.post('/:jobId/config', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = getJob(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const config = req.body as BrandConfig;
    const errors = validateBrandConfig(config);

    if (errors.length > 0) {
      res.status(422).json({ error: 'Validation failed', details: errors });
      return;
    }

    // Merge with existing config to preserve tracing data
    const existing_config = job.config ?? {};
    const merged_config = { ...existing_config, ...config };
    // Preserve tracing if not in new config but exists in old
    if (existing_config.tracing && !config.tracing) {
      merged_config.tracing = existing_config.tracing;
    }

    updateJob(jobId, { config: merged_config, status: 'configuring' });
    res.status(200).json({ jobId, status: 'configuring' });
  } catch (err) {
    console.error('Config error:', err);
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

export default router;
