import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Origins besides the server's own that may call the API from a browser. */
export const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(['https://start.nish.software']);

const isLoopback = (ip: string): boolean => ip.startsWith('127.') || ip === '::1' || ip.startsWith('::ffff:127.');

/** cf-connecting-ip, else the rightmost non-loopback X-Forwarded-For entry, else the socket address. */
export const clientIp = (req: Request): string => {
  const header = (name: string): string | undefined => {
    const v = req.headers[name];
    return Array.isArray(v) ? v.join(',') : v;
  };
  const cf = header('cf-connecting-ip')?.split(',')[0]?.trim();
  if (cf) return cf;
  const xff = (header('x-forwarded-for') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (let i = xff.length - 1; i >= 0; i -= 1) {
    if (!isLoopback(xff[i])) return xff[i];
  }
  return req.socket?.remoteAddress ?? 'unknown';
};

export interface Limiter {
  hit(key: string, now?: number): { ok: boolean; retryAfterS: number };
  size(): number;
}

/** A fixed window per key, with a bounded key table (oldest keys dropped first). */
export const createLimiter = ({
  limit,
  windowMs,
  maxKeys = 5000,
}: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}): Limiter => {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    hit(key, now = Date.now()) {
      let w = windows.get(key);
      if (w && now - w.start >= windowMs) {
        windows.delete(key);
        w = undefined;
      }
      if (!w) {
        while (windows.size >= maxKeys) {
          const oldest = windows.keys().next();
          if (oldest.done) break;
          windows.delete(oldest.value);
        }
        w = { start: now, count: 0 };
        windows.set(key, w);
      }
      if (w.count >= limit) {
        return { ok: false, retryAfterS: Math.max(1, Math.ceil((w.start + windowMs - now) / 1000)) };
      }
      w.count += 1;
      return { ok: true, retryAfterS: 0 };
    },
    size: () => windows.size,
  };
};

export interface DailyCap {
  take(now?: number): boolean;
  used(now?: number): number;
}

const utcDay = (now: number): string => new Date(now).toISOString().slice(0, 10);

/** Counts calls per UTC date; the count resets when the date changes. */
export const createDailyCap = (cap: number): DailyCap => {
  let day = '';
  let count = 0;
  const roll = (now: number): void => {
    const d = utcDay(now);
    if (d !== day) {
      day = d;
      count = 0;
    }
  };
  return {
    take(now = Date.now()) {
      roll(now);
      if (count >= cap) return false;
      count += 1;
      return true;
    },
    used(now = Date.now()) {
      roll(now);
      return count;
    },
  };
};

const originOf = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
};

/**
 * Passes same-origin browser requests and requests from an allowed origin. Stops other sites and
 * casual scripts; the rate limits and the daily cap cover the rest.
 */
export const sameSiteOnly = (allowed: ReadonlySet<string>): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const self = `${req.protocol}://${req.get('host')}`;
    const fetchSite = req.get('sec-fetch-site');
    const origin = req.get('origin');
    const ok = (o: string | undefined): boolean => o !== undefined && (o === self || allowed.has(o));
    let pass = false;
    if (fetchSite === 'same-origin') pass = true;
    else if (origin) pass = ok(origin);
    else if (!fetchSite) pass = ok(originOf(req.get('referer')));
    if (pass) {
      next();
      return;
    }
    res.status(403).json({ error: 'forbidden' });
  };
};

export interface UpstreamGate {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

/** At most `max` calls in flight; up to `queue` more wait their turn; beyond that, reject with 'busy'. */
export const upstreamGate = (max = 6, queue = 50): UpstreamGate => {
  let active = 0;
  const waiting: Array<() => void> = [];
  const release = (): void => {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  };
  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      if (active >= max) {
        if (waiting.length >= queue) throw new Error('busy');
        await new Promise<void>((resolve) => waiting.push(resolve));
      } else {
        active += 1;
      }
      try {
        return await fn();
      } finally {
        release();
      }
    },
  };
};
