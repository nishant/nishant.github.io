import express, { NextFunction, Request, Response } from 'express';
import axios, { AxiosError } from 'axios';

const router = express.Router();

const DATA_BASE_URL = 'https://api.openweathermap.org/data/3.0/onecall';
const LOCATION_BASE_URL = 'https://api.openweathermap.org/geo/1.0/reverse';

const DATA_TTL_MS = 10 * 60_000; // forecasts change slowly; also keeps the free quota intact
const LOCATION_TTL_MS = 24 * 60 * 60_000; // a coordinate's city name does not change

export const weatherConfigured = (): boolean => Boolean(process.env.OPENWEATHERMAP_API_KEY);

interface CacheEntry {
  expires: number;
  value: object;
}

const cache = new Map<string, CacheEntry>();

const getCached = (key: string): object | undefined => {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
};

const setCached = (key: string, value: object, ttl: number): void => {
  cache.set(key, { value, expires: Date.now() + ttl });
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
  return { lat, lon };
};

/** Two decimals is about 1 km: plenty for weather, and nearby requests share a cache entry. */
const cacheKey = (prefix: string, lat: number, lon: number): string =>
  `${prefix}:${lat.toFixed(2)}:${lon.toFixed(2)}`;

const upstreamError = (res: Response, what: string, error: unknown): void => {
  const status = error instanceof AxiosError ? error.response?.status : undefined;
  console.error(`[weather] ${what} failed`, status ?? '', error instanceof Error ? error.message : error);
  res.status(502).json({ error: `Failed to ${what}`, upstreamStatus: status ?? null });
};

router.use((_req: Request, res: Response, next: NextFunction) => {
  if (!weatherConfigured()) {
    res.status(503).json({ error: 'Weather is not configured on this server (OPENWEATHERMAP_API_KEY missing)' });
    return;
  }
  next();
});

router.get('/data', async (req: Request, res: Response) => {
  const coords = parseCoords(req, res);
  if (!coords) return;
  const key = cacheKey('data', coords.lat, coords.lon);
  const cached = getCached(key);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.json(cached);
    return;
  }

  try {
    const response = await axios.get(DATA_BASE_URL, {
      timeout: 10_000,
      params: {
        lat: coords.lat,
        lon: coords.lon,
        exclude: 'minutely,alerts',
        appid: process.env.OPENWEATHERMAP_API_KEY,
      },
    });
    const data = response.data ?? {};
    // One Call omits sections it cannot produce; the frontend only needs a few entries.
    const payload = {
      current: data.current ?? null,
      hourly: Array.isArray(data.hourly) ? data.hourly.slice(0, 5) : [],
      daily: Array.isArray(data.daily) ? data.daily.slice(0, 3) : [],
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
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    res.json(cached);
    return;
  }

  try {
    const response = await axios.get(LOCATION_BASE_URL, {
      timeout: 10_000,
      params: { lat: coords.lat, lon: coords.lon, limit: 1, appid: process.env.OPENWEATHERMAP_API_KEY },
    });
    const location = Array.isArray(response.data) ? response.data[0] : undefined;
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

export default router;
