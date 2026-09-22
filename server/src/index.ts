import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

// server/.env, regardless of the working directory the process was started from.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import weatherRouter, { weatherConfigured } from './routes/weather';

const PORT = Number(process.env.PORT) || 8800;
const HOST = process.env.HOST || '127.0.0.1';
// The committed Angular build (`npm run deploy` at the repo root writes ../docs).
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || path.join(__dirname, '..', '..', 'docs'));

const allowedOrigins = new Set([
  'http://localhost:4200', // ng serve
  'https://nishant.github.io', // GitHub Pages copy of the same bundle
  'https://start.nish.software',
  'https://nish.software',
]);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback'); // Caddy / cloudflared on this machine

// Browsers send an Origin header even for same-origin module scripts, so the
// server's own origin (whatever host it was reached on) is always allowed.
app.use((req: Request, res: Response, next: NextFunction) => {
  const self = `${req.protocol}://${req.get('host')}`;
  cors({
    origin: (origin, callback) => {
      // No Origin header = plain navigation or a non-browser client; fine too.
      if (!origin || origin === self || allowedOrigins.has(origin)) callback(null, true);
      else callback(new Error(`Origin ${origin} is not allowed`));
    },
  })(req, res, next);
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, weatherConfigured: weatherConfigured(), staticDir: STATIC_DIR });
});

app.use('/api/weather', weatherRouter);

// Anything under /api that is not a known route is a 404, never the SPA shell.
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'not found' });
});

const indexHtml = path.join(STATIC_DIR, 'index.html');
const hasBundle = fs.existsSync(indexHtml);

if (hasBundle) {
  app.use(
    express.static(STATIC_DIR, {
      index: 'index.html',
      setHeaders: (res, filePath) => {
        // Angular emits content-hashed js/css; everything else (index.html, favicon,
        // assets/) must revalidate so a deploy shows up on the next load.
        if (/\.[0-9a-f]{16}\.(js|css)$/.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );
  // The app uses hash routing, so deep links never reach the server; this only
  // covers a stray path like /home typed by hand.
  app.get('/{*path}', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.includes('.')) return next();
    return res.sendFile(indexHtml);
  });
} else {
  console.warn(`[startpage] no index.html in ${STATIC_DIR} - serving the API only`);
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message.startsWith('Origin ')) {
    res.status(403).json({ error: err.message });
    return;
  }
  console.error('[startpage] unhandled error:', err);
  res.status(500).json({ error: 'internal error' });
});

app.listen(PORT, HOST, () => {
  console.log(`[startpage] listening on http://${HOST}:${PORT}`);
  console.log(`[startpage] static dir: ${STATIC_DIR}${hasBundle ? '' : ' (missing)'}`);
  if (!weatherConfigured()) {
    console.warn(
      '[startpage] OPENWEATHERMAP_API_KEY is not set - weather routes answer 503. ' +
        'Copy server/.env.example to server/.env and fill it in.',
    );
  }
});
