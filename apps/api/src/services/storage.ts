import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_ROOT = process.env.SVG_MAP_STORAGE_ROOT
  ? path.resolve(process.env.SVG_MAP_STORAGE_ROOT)
  : path.resolve(__dirname, '../../../../storage');

const DIRS = {
  uploads: path.join(STORAGE_ROOT, 'uploads'),
  processed: path.join(STORAGE_ROOT, 'processed'),
  output: path.join(STORAGE_ROOT, 'output'),
};

// Ensure all directories exist
for (const dir of Object.values(DIRS)) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sanitizePath(filename: string): string {
  // Prevent path traversal
  const sanitized = path.basename(filename);
  if (sanitized !== filename || filename.includes('..')) {
    throw new Error('Invalid filename: path traversal detected');
  }
  return sanitized;
}

export function getUploadPath(filename: string): string {
  return path.join(DIRS.uploads, sanitizePath(filename));
}

export function getProcessedPath(filename: string): string {
  return path.join(DIRS.processed, sanitizePath(filename));
}

export function getOutputPath(filename: string): string {
  return path.join(DIRS.output, sanitizePath(filename));
}

export function getPreviewUrl(jobId: string): string {
  return `/api/files/uploads/${jobId}.jpg`;
}

export function getDownloadUrl(filename: string): string {
  return `/api/files/output/${sanitizePath(filename)}`;
}

export function readFile(filepath: string): Buffer {
  return fs.readFileSync(filepath);
}

export function writeFile(filepath: string, data: Buffer | string): void {
  fs.writeFileSync(filepath, data);
}

export function fileExists(filepath: string): boolean {
  return fs.existsSync(filepath);
}

export { DIRS };
