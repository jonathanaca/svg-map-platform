import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from the api app directory (dev convenience — production uses real env vars)
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(__dirname, '../.env');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch { /* no .env file — rely on real environment */ }

import express from 'express';
import cors from 'cors';
import { applySecurityMiddleware, uploadRateLimit, generateRateLimit } from './middleware/security.js';
import uploadRouter from './routes/upload.js';
import configRouter from './routes/config.js';
import jobsRouter from './routes/jobs.js';
import filesRouter from './routes/files.js';
import generateRouter from './routes/generate.js';
import tracingRouter from './routes/tracing.js';
import analyzeRouter from './routes/analyze.js';
import projectsRouter from './routes/projects.js';
import floorplansRouter from './routes/floorplans.js';
import objectsRouter from './routes/objects.js';
import importRouter from './routes/import.js';
import placeosRouter from './routes/placeos.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

// Security
applySecurityMiddleware(app);
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Larger limit for tracing data

// Routes
app.use('/api/upload', uploadRateLimit, uploadRouter);
app.use('/api/jobs', configRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/files', filesRouter);
app.use('/api/jobs', generateRateLimit, generateRouter);
app.use('/api/jobs', tracingRouter);
app.use('/api/jobs', analyzeRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/floorplans', floorplansRouter);
app.use('/api', objectsRouter);
app.use('/api/import', importRouter);
app.use('/api/placeos', placeosRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.2.0', timestamp: new Date().toISOString() });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.resolve(__dirname, '../../../dist/web');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`SVG Map API running on http://localhost:${PORT}`);
});

export { app, generateRateLimit };
export default app;
