import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { Express } from 'express';

export function applySecurityMiddleware(app: Express): void {
  // Helmet for security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'http://localhost:*', 'https://*'],
          connectSrc: ["'self'", 'https://svg-mapapi-production.up.railway.app', 'https://svg-mapweb-production.up.railway.app'],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'none'"],
          frameSrc: ["'none'"],
        },
      },
    }),
  );
}

// Rate limiter for upload and generate endpoints
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generateRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
