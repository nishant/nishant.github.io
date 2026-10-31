import express, { NextFunction, Request, Response } from 'express';
import axios, { AxiosError } from 'axios';
import { ALLOWED_ORIGINS, clientIp, createDailyCap, createLimiter, sameSiteOnly } from '../lib/guard';

const DATA_BASE_URL = 'https://api.openweathermap.org/data/3.0/onecall';
const LOCATION_BASE_URL = 'https://api.openweathermap.org/geo/1.0/reverse';

const DATA_TTL_MS = 10 * 60_000; // forecasts change slowly; also keeps the free quota intact
const LOCATION_TTL_MS = 24 * 60 * 60_000; // a coordinate's city name does not change
// Upstream calls allowed per UTC day; One Call 3.0 gives 1,000 free.
const DAILY_CAP = Number(process.env.WEATHER_DAILY_CAP) || 900;

export const weatherConfigured = (): boolean => Boolean(process.env.OPENWEATHERMAP_API_KEY);

interface CacheEntry {
  expires: number;
  value: object;
}

/** Two decimals is about 1 km: plenty for weather, and nearby requests share a cache entry. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

const cacheKey = (prefix: string, lat: number, lon: number): string => `${prefix}:${lat.toFixed(2)}:${lon.toFixed(2)}`;

type FetchJson = (url: string, params: Record<string, unknown>) => Promise<unknown>;

const axiosFetchJson: FetchJson = async (url, params) => (await axios.get(url, { timeout: 10_000, params })).data;

export interface WeatherOptions {
  fetchJson?: FetchJson;
  dailyCap?: number;
  now?: () => number;
}

export const createWeatherRouter = (opts: WeatherOptions = {}): express.Router => {
  const router = express.Router();
  const fetchJson = opts.fetchJson ?? axiosFetchJson;
  const now = opts.now ?? Date.now;
  const dailyCap = createDailyCap(opts.dailyCap ?? DAILY_CAP);
  const limiter = createLimiter({ limit: 60, windowMs: 10 * 60_000 });
  // Expired entries are kept (bounded) so they can be served once the daily cap is reached.
  const cache = new Map<string, CacheEntry>();

  const getCached = (key: string): { value: object; fresh: boolean } | undefined => {
    const hit = cache.get(key);
    return hit ? { value: hit.value, fresh: hit.expires >= now() } : undefined;
  };

  const setCached = (key: string, value: object, ttl: number): void => {
    cache.delete(key);
    cache.set(key, { value, expires: now() + ttl });
    if (cache.size > 500) {
      // Bounded: drop the oldest entries. A handful of users never gets near this.
      for (const k of [...cache.keys()].slice(0, 100)) cache.delete(k);
    }
  };

  /** Parses ?lat&lon, answering 400 itself when they are missing or out of range. */
  const parseCoords = (req: Request, res: Response): { lat: number; lon: number } | undefined => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      res.status(400).json({ error: 'Latitude (lat) and Longitude (lon) are required and must be valid' });
      return undefined;
    }
    return { lat: round2(lat), lon: round2(lon) };
  };

  const upstreamError = (res: Response, what: string, error: unknown): void => {
    const status = error instanceof AxiosError ? error.response?.status : undefined;
    console.error(`[weather] ${what} failed`, status ?? '', error instanceof Error ? error.message : error);
    res.status(502).json({ error: `Failed to ${what}`, upstreamStatus: status ?? null });
  };

  /** Takes one unit of the daily cap; when spent, answers (stale copy or 503) and returns false. */
  const spend = (res: Response, stale: object | undefined): boolean => {
    if (dailyCap.take(now())) return true;
    if (stale) {
      res.setHeader('X-Cache', 'STALE');
      res.json(stale);
    } else {
      res.status(503).json({ error: "Weather has reached today's limit. Try again tomorrow.", code: 'daily_cap' });
    }
    return false;
  };

  router.use((_req: Request, res: Response, next: NextFunction) => {
    if (!weatherConfigured()) {
      res.status(503).json({ error: 'Weather is not configured on this server (OPENWEATHERMAP_API_KEY missing)' });
      return;
    }
    next();
  });

  router.use(sameSiteOnly(ALLOWED_ORIGINS));

  router.use((req: Request, res: Response, next: NextFunction) => {
    const verdict = limiter.hit(clientIp(req), now());
    if (!verdict.ok) {
      res.setHeader('Retry-After', String(verdict.retryAfterS));
      res.status(429).json({ error: 'Too many weather requests. Try again in a few minutes.' });
      return;
    }
    next();
  });

  router.get('/data', async (req: Request, res: Response) => {
    const coords = parseCoords(req, res);
    if (!coords) return;
    const key = cacheKey('data', coords.lat, coords.lon);
    const cached = getCached(key);
    if (cached?.fresh) {
      res.setHeader('X-Cache', 'HIT');
      res.json(cached.value);
      return;
    }
    if (!spend(res, cached?.value)) return;

    try {
      const data = ((await fetchJson(DATA_BASE_URL, {
        lat: coords.lat,
        lon: coords.lon,
        exclude: 'minutely,alerts',
        appid: process.env.OPENWEATHERMAP_API_KEY,
      })) ?? {}) as Record<string, any>;
      // One Call omits sections it cannot produce; the frontend needs a day of hours and a week of days.
      const payload = {
        current: data.current ?? null,
        hourly: Array.isArray(data.hourly) ? data.hourly.slice(0, 24) : [],
        daily: Array.isArray(data.daily) ? data.daily.slice(0, 7) : [],
        timezone: typeof data.timezone === 'string' ? data.timezone : null,
        timezone_offset: typeof data.timezone_offset === 'number' ? data.timezone_offset : 0,
      };
      setCached(key, payload, DATA_TTL_MS);
      res.setHeader('X-Cache', 'MISS');
      res.json(payload);
    } catch (error) {
      upstreamError(res, 'fetch weather data', error);
    }
  });

  router.get('/location', async (req: Request, res: Response) => {
    const coords = parseCoords(req, res);
    if (!coords) return;
    const key = cacheKey('location', coords.lat, coords.lon);
    const cached = getCached(key);
    if (cached?.fresh) {
      res.setHeader('X-Cache', 'HIT');
      res.json(cached.value);
      return;
    }
    if (!spend(res, cached?.value)) return;

    try {
      const result = await fetchJson(LOCATION_BASE_URL, {
        lat: coords.lat,
        lon: coords.lon,
        limit: 1,
        appid: process.env.OPENWEATHERMAP_API_KEY,
      });
      const location = Array.isArray(result) ? result[0] : undefined;
      if (!location) {
        res.status(404).json({ error: 'Location not found' });
        return;
      }
      const payload = {
        city: location.name,
        state: location.state,
        country: location.country,
        lat: location.lat,
        lon: location.lon,
      };
      setCached(key, payload, LOCATION_TTL_MS);
      res.setHeader('X-Cache', 'MISS');
      res.json(payload);
    } catch (error) {
      upstreamError(res, 'reverse geocode', error);
    }
  });

  return router;
};

export default createWeatherRouter();
