import express, { Request, Response } from 'express';
import { ALLOWED_ORIGINS, clientIp, createLimiter, sameSiteOnly, upstreamGate } from '../lib/guard';

const HOST_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/;
const MAX_BODY = 100 * 1024;
const POSITIVE_TTL_MS = 7 * 24 * 60 * 60_000;
const NEGATIVE_TTL_MS = 24 * 60 * 60_000;
const MAX_ENTRIES = 1000;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
const TIMEOUT_MS = 5000;
// SVG is deliberately absent: it can carry script.
const IMAGE_TYPES = new Set([
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/png',
  'image/gif',
  'image/jpeg',
  'image/webp',
]);

interface Entry {
  status: 200 | 404;
  type: string;
  body: Buffer;
  expires: number;
}

type Outcome = { kind: 'icon'; type: string; body: Buffer } | { kind: 'none' } | { kind: 'error' };

const cleanType = (value: string | null): string => (value ?? '').split(';')[0].trim().toLowerCase();

export const createFaviconRouter = (opts: { fetchImpl?: typeof fetch; now?: () => number } = {}): express.Router => {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const router = express.Router();
  const cache = new Map<string, Entry>();
  let totalBytes = 0;
  const limiter = createLimiter({ limit: 300, windowMs: 60 * 60_000 });
  const gate = upstreamGate(6, 50);

  const drop = (host: string): void => {
    const e = cache.get(host);
    if (e) {
      totalBytes -= e.body.length;
      cache.delete(host);
    }
  };

  const store = (host: string, entry: Entry): void => {
    drop(host);
    cache.set(host, entry);
    totalBytes += entry.body.length;
    while (cache.size > MAX_ENTRIES || totalBytes > MAX_TOTAL_BYTES) {
      const oldest = cache.keys().next();
      if (oldest.done) break;
      drop(oldest.value);
    }
  };

  /** Reads an image response: undefined when it is not an allowed image or is too large. */
  const readImage = async (res: globalThis.Response): Promise<{ type: string; body: Buffer } | undefined> => {
    const type = cleanType(res.headers.get('content-type'));
    if (!IMAGE_TYPES.has(type)) return undefined;
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BODY) return undefined;
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length === 0 || body.length > MAX_BODY) return undefined;
    return { type, body };
  };

  const fromDuckDuckGo = async (host: string): Promise<Outcome> => {
    try {
      const res = await fetchImpl(`https://icons.duckduckgo.com/ip3/${host}.ico`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status !== 200) return { kind: 'none' };
      const img = await readImage(res);
      return img ? { kind: 'icon', ...img } : { kind: 'none' };
    } catch {
      return { kind: 'error' };
    }
  };

  const fromGoogle = async (host: string): Promise<Outcome> => {
    try {
      const res = await fetchImpl(`https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.url) {
        const finalHost = new URL(res.url).hostname;
        if (finalHost !== 'www.google.com' && !finalHost.endsWith('.gstatic.com')) return { kind: 'none' };
      }
      if (res.status !== 200) return { kind: 'none' };
      const img = await readImage(res);
      return img ? { kind: 'icon', ...img } : { kind: 'none' };
    } catch {
      return { kind: 'error' };
    }
  };

  const lookup = async (host: string): Promise<Outcome> => {
    const ddg = await fromDuckDuckGo(host);
    if (ddg.kind === 'icon') return ddg;
    const google = await fromGoogle(host);
    if (google.kind === 'icon') return google;
    // A failure on either side means "unknown", which must not be remembered as "no icon".
    if (google.kind === 'error' || ddg.kind === 'error') return { kind: 'error' };
    return { kind: 'none' };
  };

  const sendIcon = (res: Response, type: string, body: Buffer, hit: 'HIT' | 'MISS'): void => {
    res.status(200);
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Cache', hit);
    res.send(body);
  };

  const sendNone = (res: Response, cacheControl: string, hit: 'HIT' | 'MISS'): void => {
    res.status(404);
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Cache', hit);
    res.json({ error: 'no icon' });
  };

  router.use(sameSiteOnly(ALLOWED_ORIGINS));

  router.get('/', async (req: Request, res: Response) => {
    const raw = req.query.host;
    const host = typeof raw === 'string' ? raw.toLowerCase() : '';
    if (!HOST_RE.test(host)) {
      res.status(400).json({ error: 'bad host' });
      return;
    }

    const cached = cache.get(host);
    if (cached && cached.expires > now()) {
      if (cached.status === 200) sendIcon(res, cached.type, cached.body, 'HIT');
      else sendNone(res, 'public, max-age=86400', 'HIT');
      return;
    }
    if (cached) drop(host);

    const verdict = limiter.hit(clientIp(req), now());
    if (!verdict.ok) {
      res.setHeader('Retry-After', String(verdict.retryAfterS));
      res.status(429).json({ error: 'too many requests' });
      return;
    }

    let outcome: Outcome;
    try {
      outcome = await gate.run(() => lookup(host));
    } catch {
      res.setHeader('Retry-After', '5');
      res.status(429).json({ error: 'too many requests' });
      return;
    }

    if (outcome.kind === 'icon') {
      store(host, { status: 200, type: outcome.type, body: outcome.body, expires: now() + POSITIVE_TTL_MS });
      sendIcon(res, outcome.type, outcome.body, 'MISS');
    } else if (outcome.kind === 'none') {
      store(host, { status: 404, type: '', body: Buffer.alloc(0), expires: now() + NEGATIVE_TTL_MS });
      sendNone(res, 'public, max-age=86400', 'MISS');
    } else {
      sendNone(res, 'no-store', 'MISS');
    }
  });

  return router;
};

export default createFaviconRouter();
