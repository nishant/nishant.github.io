import { Readable } from 'node:stream';
import express, { NextFunction, Request, Response, Router } from 'express';

const TIMEOUT_MS = 10_000;
const PATH_OK = /^\/[A-Za-z0-9/_-]*$/;
// The service's ingest and health routes live outside /api; never reach them from here.
const BLOCKED = /^\/(ingest|health)(\/|$)/;

const FORWARD_HEADERS = ['cookie', 'content-type', 'accept', 'user-agent'] as const;

const notFound = (res: Response): void => {
  res.status(404).json({ error: 'Not found.' });
};

/**
 * Forwards /api/inbox/* to the local inbox service's /api/*. The service does its own auth
 * (cookie), so this only relays requests and responses.
 */
export function inboxRouter(
  target: string = process.env.INBOX_URL || 'http://127.0.0.1:8805',
  opts: { timeoutMs?: number } = {},
): Router {
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const router = express.Router();
  const base = target.replace(/\/+$/, '');

  router.use(express.raw({ type: () => true, limit: '64kb' }));

  router.use(async (req: Request, res: Response) => {
    if (!PATH_OK.test(req.path) || BLOCKED.test(req.path)) {
      notFound(res);
      return;
    }

    const queryAt = req.originalUrl.indexOf('?');
    const query = queryAt === -1 ? '' : req.originalUrl.slice(queryAt);

    const headers: Record<string, string> = {};
    for (const name of FORWARD_HEADERS) {
      const value = req.get(name);
      if (value) headers[name] = value;
    }
    headers['x-forwarded-for'] = req.ip ?? '';
    headers['x-forwarded-proto'] = req.protocol;

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const body = hasBody && Buffer.isBuffer(req.body) && req.body.length > 0 ? req.body : undefined;

    const live = req.method === 'GET' && req.path === '/events';
    const controller = new AbortController();
    if (live) res.on('close', () => controller.abort());

    try {
      const upstream = await fetch(`${base}/api${req.path}${query}`, {
        method: req.method,
        headers,
        body,
        redirect: 'manual',
        signal: live ? controller.signal : AbortSignal.timeout(timeoutMs),
      });

      const isStream = (upstream.headers.get('content-type') ?? '').toLowerCase().startsWith('text/event-stream');
      if (live && upstream.ok && isStream && upstream.body) {
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('X-Accel-Buffering', 'no');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        const stream = Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream);
        stream.on('error', () => res.end());
        res.on('close', () => stream.destroy());
        stream.pipe(res);
        return;
      }

      const noBody = upstream.status === 204 || upstream.status === 304 || req.method === 'HEAD';
      const buf = noBody ? null : Buffer.from(await upstream.arrayBuffer());

      res.status(upstream.status);
      const contentType = upstream.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', upstream.headers.get('cache-control') ?? 'no-store');
      const cookies = upstream.headers.getSetCookie();
      if (cookies.length > 0) res.setHeader('Set-Cookie', cookies);
      if (buf === null) res.end();
      else res.end(buf);
    } catch {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.status(503).json({ error: 'Inbox service is not answering.' });
    }
  });

  // body-parser errors (413 over 64 KB, aborted bodies) answer as JSON.
  router.use((err: Error & { status?: number }, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const status = err.status && err.status >= 400 && err.status < 500 ? err.status : 400;
    res.status(status).json({ error: status === 413 ? 'Request body is too large.' : 'Bad request.' });
  });

  return router;
}
