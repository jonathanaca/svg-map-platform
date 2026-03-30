import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs';
import { createJob, updateJob } from '../db/schema.js';
import { processImage } from '../services/image-processor.js';
import { getUploadPath, getPreviewUrl } from '../services/storage.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
});

const router = Router();

router.post('/', upload.single('floorplan'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    // Validate MIME type from buffer (not just extension)
    const type = await fileTypeFromBuffer(req.file.buffer);
    if (!type || type.mime !== 'image/jpeg') {
      res.status(400).json({
        error: 'Invalid file type. Only JPEG files are accepted.',
        details: [{ field: 'file', message: `Detected type: ${type?.mime ?? 'unknown'}` }],
      });
      return;
    }

    const job_id = uuidv4();

    // Save uploaded file
    const upload_path = getUploadPath(`${job_id}.jpg`);
    fs.writeFileSync(upload_path, req.file.buffer);

    // Create job record
    createJob(job_id);
    updateJob(job_id, { status: 'processing', image_path: upload_path });

    // Process image
    const metadata = await processImage(job_id);
    updateJob(job_id, { status: 'configuring', metadata });

    res.status(201).json({
      jobId: job_id,
      previewUrl: getPreviewUrl(job_id),
      metadata,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
