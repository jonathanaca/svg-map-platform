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

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
