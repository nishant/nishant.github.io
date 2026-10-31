import { date, time } from '@nish/ui/format';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLatest } from '../../lib/useLatest';

/** One OpenWeatherMap condition entry. */
export interface OwmCondition {
  id: number;
  main: string;
  description: string;
  icon: string;
}

/** Raw One Call 3.0 `current` object (temperatures in Kelvin, wind in m/s, times in epoch seconds). */
export interface OwmCurrent {
  dt: number;
  sunrise?: number;
  sunset?: number;
  temp: number;
  feels_like: number;
  humidity: number;
  uvi?: number;
  wind_speed: number;
  wind_deg: number;
  weather: OwmCondition[];
}

export interface OwmHourly {
  dt: number;
  temp: number;
  pop?: number;
  weather: OwmCondition[];
}

export interface OwmDaily {
  dt: number;
  temp: { day?: number; min: number; max: number };
  pop?: number;
  weather: OwmCondition[];
}

/** The `/api/weather/data` response. */
export interface WeatherData {
  current: OwmCurrent | null;
  hourly: OwmHourly[];
  daily: OwmDaily[];
  timezone?: string | null;
  timezone_offset?: number;
}

/** The `/api/weather/location` response. */
export interface WeatherLocation {
  city: string;
  state?: string;
  country?: string;
  lat: number;
  lon: number;
}

/** What is stored in localStorage (shared by all tabs). */
export interface WeatherCache {
  data: WeatherData;
  location: WeatherLocation | null;
  at: number;
}

export type WeatherIconName =
  | 'sun'
  | 'moon'
  | 'cloud-sun'
  | 'cloud-moon'
  | 'cloud'
  | 'cloud-drizzle'
  | 'cloud-rain'
  | 'cloud-lightning'
  | 'snowflake'
  | 'cloud-fog';

export interface HourView {
  key: number;
  time: string;
  temp: number;
  icon: WeatherIconName;
  /** Chance of rain in percent, only when it is at least 20%. */
  rain: number | null;
}

export interface DayView {
  key: number;
  label: string;
  icon: WeatherIconName;
  rain: number | null;
  low: number;
  high: number;
  /** The current temperature, on today's row only. */
  current: number | null;
}

export interface WeatherView {
  title: string;
  temp: number;
  feelsLike: number;
  description: string;
  icon: WeatherIconName;
  humidity: number;
  windMph: number;
  windDeg: number;
  uvi: number;
  rainChance: number | null;
  sunrise: string;
  sunset: string;
  high: number | null;
  low: number | null;
  hours: HourView[];
  days: DayView[];
  weekMin: number;
  weekMax: number;
}

export type WeatherErrorKind = 'denied' | 'unavailable' | 'server' | 'not-configured';

export type WeatherState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'loading' }
  | { status: 'ready'; cache: WeatherCache }
  | { status: 'error'; kind: WeatherErrorKind };

export const CACHE_KEY = 'start-weather';
export const CACHE_TTL_MS = 10 * 60_000;
export const REFRESH_AFTER_MS = 5 * 60_000;

/** Kelvin to whole degrees Fahrenheit. */
export function kelvinToF(k: number): number {
  const f = Math.round(((k - 273.15) * 9) / 5 + 32);
  return Object.is(f, -0) ? 0 : f;
}

/** Metres per second to whole miles per hour. */
export function msToMph(ms: number): number {
  return Math.round(ms * 2.23694);
}

/** OpenWeatherMap icon code (`10d`, `01n`, ...) to an icon name. Unknown codes read as a plain cloud. */
export function iconNameFor(code: string | undefined): WeatherIconName {
  const night = code?.endsWith('n') ?? false;
  switch (code?.slice(0, 2)) {
    case '01':
      return night ? 'moon' : 'sun';
    case '02':
      return night ? 'cloud-moon' : 'cloud-sun';
    case '03':
    case '04':
      return 'cloud';
    case '09':
      return 'cloud-drizzle';
    case '10':
      return 'cloud-rain';
    case '11':
      return 'cloud-lightning';
    case '13':
      return 'snowflake';
    case '50':
      return 'cloud-fog';
    default:
      return 'cloud';
  }
}

/** "Austin, TX" when there is a state, else "Austin", else "Weather". */
export function locationTitle(loc: WeatherLocation | null): string {
  if (!loc?.city) return 'Weather';
  return loc.state ? `${loc.city}, ${loc.state}` : loc.city;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Percent chance of rain, or null under 20% (not worth showing). */
function rainPct(pop: number | undefined): number | null {
  if (typeof pop !== 'number' || pop < 0.2) return null;
  return Math.round(pop * 100);
}

function safeTimeZone(tz: string | null | undefined): string | undefined {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

/** Turns the raw API data into what the sheet draws. Returns null when there is no current block. */
export function buildView(data: WeatherData, location: WeatherLocation | null): WeatherView | null {
  const cur = data.current;
  if (!cur) return null;
  const timeZone = safeTimeZone(data.timezone);
  const cond = cur.weather?.[0];
  const today = data.daily[0];

  const hours: HourView[] = data.hourly.slice(0, 24).map((h) => ({
    key: h.dt,
    time: time(h.dt * 1000, { timeZone }),
    temp: kelvinToF(h.temp),
    icon: iconNameFor(h.weather?.[0]?.icon),
    rain: rainPct(h.pop),
  }));

  const days: DayView[] = data.daily.slice(0, 7).map((d, i) => ({
    key: d.dt,
    label: i === 0 ? 'Today' : date(d.dt * 1000, 'weekday'),
    icon: iconNameFor(d.weather?.[0]?.icon),
    rain: rainPct(d.pop),
    low: kelvinToF(d.temp.min),
    high: kelvinToF(d.temp.max),
    current: i === 0 ? kelvinToF(cur.temp) : null,
  }));

  const lows = days.map((d) => d.low);
  const highs = days.map((d) => d.high);

  return {
    title: locationTitle(location),
    temp: kelvinToF(cur.temp),
    feelsLike: kelvinToF(cur.feels_like),
    description: capitalize(cond?.description ?? ''),
    icon: iconNameFor(cond?.icon),
    humidity: Math.round(cur.humidity),
    windMph: msToMph(cur.wind_speed),
    windDeg: cur.wind_deg,
    uvi: Math.round((cur.uvi ?? 0) * 10) / 10,
    rainChance: today ? Math.round((today.pop ?? 0) * 100) : null,
    sunrise: cur.sunrise ? time(cur.sunrise * 1000, { timeZone }) : '—',
    sunset: cur.sunset ? time(cur.sunset * 1000, { timeZone }) : '—',
    high: today ? kelvinToF(today.temp.max) : null,
    low: today ? kelvinToF(today.temp.min) : null,
    hours,
    days,
    weekMin: lows.length ? Math.min(...lows) : 0,
    weekMax: highs.length ? Math.max(...highs) : 0,
  };
}

/** The cached weather, or null when missing, unreadable or older than `maxAgeMs`. */
export function readWeatherCache(maxAgeMs = CACHE_TTL_MS, now = Date.now()): WeatherCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<WeatherCache>;
    if (!c || typeof c.at !== 'number' || !c.data?.current || !Array.isArray(c.data.hourly) || !Array.isArray(c.data.daily)) {
      return null;
    }
    if (now - c.at > maxAgeMs) return null;
    return { data: c.data, location: c.location ?? null, at: c.at };
  } catch {
    return null;
  }
}

/** Fired on `window` after the cache is written, so the home chip can update. */
export const CACHE_EVENT = 'start-weather-updated';

export function writeWeatherCache(cache: WeatherCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // The cache is only a speed-up.
  }
  window.dispatchEvent(new Event(CACHE_EVENT));
}

class WeatherError extends Error {
  constructor(readonly kind: WeatherErrorKind) {
    super(kind);
  }
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new WeatherError('unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (e) => reject(new WeatherError(e.code === 1 ? 'denied' : 'unavailable')), {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 600_000,
    });
  });
}

async function getJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new WeatherError('server');
  }
  if (res.status === 429) throw new WeatherError('server');
  if (res.status === 503) {
    let code: unknown;
    try {
      code = ((await res.json()) as { code?: unknown } | null)?.code;
    } catch {
      code = undefined;
    }
    throw new WeatherError(code === 'daily_cap' ? 'server' : 'not-configured');
  }
  if (!res.ok) throw new WeatherError('server');
  try {
    return (await res.json()) as T;
  } catch {
    throw new WeatherError('server');
  }
}

/** Fetches weather for the device's position. Throws a WeatherError carrying the failure kind. */
async function fetchWeather(onLoading: () => void): Promise<WeatherCache> {
  const pos = await getPosition();
  onLoading();
  // Two decimals (about 1 km) is plenty for a forecast and matches what the server uses.
  const lat = Math.round(pos.coords.latitude * 100) / 100;
  const lon = Math.round(pos.coords.longitude * 100) / 100;
  const q = `lat=${lat}&lon=${lon}`;
  const [data, location] = await Promise.all([
    getJson<WeatherData>(`/api/weather/data?${q}`),
    getJson<WeatherLocation>(`/api/weather/location?${q}`).catch((e: unknown) => {
      // A missing city name is not worth failing the forecast; a missing key is.
      if (e instanceof WeatherError && e.kind === 'not-configured') throw e;
      return null;
    }),
  ]);
  if (!data.current) throw new WeatherError('server');
  const cache: WeatherCache = {
    data: { ...data, hourly: data.hourly ?? [], daily: data.daily ?? [] },
    location,
    at: Date.now(),
  };
  writeWeatherCache(cache);
  return cache;
}

/**
 * Weather for the sheet. While `open` is true: a fresh cache (under 10 minutes) shows
 * instantly and refreshes in the background when older than 5; otherwise it asks for
 * the location and loads. `refresh()` always reloads.
 */
export function useWeather(open: boolean): { state: WeatherState; refreshing: boolean; refresh: () => void } {
  const [state, setState] = useState<WeatherState>({ status: 'idle' });
  const [refreshing, setRefreshing] = useState(false);
  const run = useRef(0);
  const ready = useLatest(state.status === 'ready');

  const load = useCallback((keepCurrent: boolean) => {
    const id = ++run.current;
    const alive = () => run.current === id;
    if (keepCurrent) setRefreshing(true);
    else setState({ status: 'locating' });
    fetchWeather(() => {
      if (alive() && !keepCurrent) setState({ status: 'loading' });
    })
      .then((cache) => {
        if (!alive()) return;
        setState({ status: 'ready', cache });
        setRefreshing(false);
      })
      .catch((e: unknown) => {
        if (!alive()) return;
        setRefreshing(false);
        // A failed background refresh keeps the cached forecast on screen.
        if (keepCurrent) return;
        setState({ status: 'error', kind: e instanceof WeatherError ? e.kind : 'server' });
      });
  }, []);

  useEffect(() => {
    if (!open) {
      run.current++;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs state from the localStorage cache when the sheet opens
      setRefreshing(false);
      return;
    }
    const cached = readWeatherCache();
    if (cached) {
      setState({ status: 'ready', cache: cached });
      if (Date.now() - cached.at > REFRESH_AFTER_MS) load(true);
    } else {
      load(false);
    }
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- `run` is a request counter, not a DOM ref; the cleanup must bump the current value
      run.current++;
    };
  }, [open, load]);

  const refresh = useCallback(() => load(ready.current), [load, ready]);

  return { state, refreshing, refresh };
}
