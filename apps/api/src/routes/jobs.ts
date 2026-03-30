import { Router } from 'express';
import { getJob } from '../db/schema.js';
import { getDownloadUrl } from '../services/storage.js';

const router = Router();

router.get('/:jobId/status', (req, res) => {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  const response: Record<string, unknown> = {
    jobId,
    status: job.status,
  };

  if (job.error) response.error = job.error;
  if (job.status === 'complete' && job.output_path) {
    response.downloadUrl = getDownloadUrl(job.output_path as string);
  }

  res.json(response);
});

export default router;
