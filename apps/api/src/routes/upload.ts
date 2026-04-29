import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs';
import { createJob, updateJob } from '../db/schema.js';
import { processImage } from '../services/image-processor.js';
import { rasterizePdf } from '../services/pdf-rasterizer.js';
import { getUploadPath, getPreviewUrl } from '../services/storage.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB (PDFs can be large)

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

    const type = await fileTypeFromBuffer(req.file.buffer);
    const mime = type?.mime ?? '';

    if (mime !== 'image/jpeg' && mime !== 'application/pdf') {
      res.status(400).json({
        error: 'Invalid file type. JPEG or PDF files are accepted.',
        details: [{ field: 'file', message: `Detected type: ${mime || 'unknown'}` }],
      });
      return;
    }

    const job_id = uuidv4();
    const upload_path = getUploadPath(`${job_id}.jpg`);

    if (mime === 'application/pdf') {
      console.log(`Rasterizing PDF (${(req.file.buffer.length / 1024).toFixed(0)} KB)…`);
      const { jpeg, pageCount } = await rasterizePdf(req.file.buffer);
      fs.writeFileSync(upload_path, jpeg);
      console.log(`PDF rasterized: ${pageCount} page(s), saved as JPEG`);
    } else {
      fs.writeFileSync(upload_path, req.file.buffer);
    }

    createJob(job_id);
    updateJob(job_id, { status: 'processing', image_path: upload_path });

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
