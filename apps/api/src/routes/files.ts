import { Router } from 'express';
import path from 'path';
import { DIRS } from '../services/storage.js';

const router = Router();

router.get('/:folder/:filename', (req, res) => {
  const { folder, filename } = req.params;

  // Only allow known folders
  const allowed_folders = ['uploads', 'processed', 'output'];
  if (!allowed_folders.includes(folder)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  // Prevent path traversal
  const safe_filename = path.basename(filename);
  if (safe_filename !== filename) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }

  const dir = DIRS[folder as keyof typeof DIRS];
  const file_path = path.join(dir, safe_filename);

  res.sendFile(file_path, (err) => {
    if (err) {
      res.status(404).json({ error: 'File not found' });
    }
  });
});

export default router;
