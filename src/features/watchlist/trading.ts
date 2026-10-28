import { pct } from '@nish/ui/format';
import { getAppConfig } from '../../lib/api';

/** One watchlist symbol's latest state (copied from trading's shared `Snapshot`). */
export interface Snapshot {
  symbol: string;
  price: number;
  /** Previous session close. */
  prevClose: number;
  /** A percent number: -0.42 means -0.42%. */
  dayChangePct: number;
  dayHigh: number;
  dayLow: number;
  dayVolume: number;
  /** ISO timestamp of the trade this snapshot reflects. */
  updatedAt: string;
}

export type BarRange = '1D' | '1M' | '3M' | '1Y';

export interface BarPoint {
  t: string;
  c: number;
}

export interface BarsData {
  symbol: string;
  range: string;
  prevClose: number | null;
  bars: BarPoint[];
}

export interface Overview {
  snapshots: Snapshot[];
  updatedAt: string;
}

/** Trading answered 401: the browser has no Trading sign-in. */
export class TradingAuthError extends Error {
  constructor(message = 'Not signed in to Trading') {
    super(message);
    this.name = 'TradingAuthError';
  }
}

/** The fetch never got an answer: offline, off the tailnet, blocked by CORS, or timed out. */
export class TradingUnreachableError extends Error {
  constructor(message = 'Trading is unreachable') {
    super(message);
    this.name = 'TradingUnreachableError';
  }
}

/** Trading answered with another error status. */
export class TradingError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = 'TradingError';
    this.status = status;
  }
}

/** Maps an HTTP error status to the error the sheet branches on. */
export function classifyStatus(status: number, message?: string): Error {
  if (status === 401) return new TradingAuthError();
  return new TradingError(message || `Trading returned ${status}`, status);
}

/** Maps a thrown fetch failure (a TypeError from a network or CORS failure, an AbortError from the timeout) to an error. */
export function classifyFetchError(e: unknown): Error {
  if (e instanceof TradingAuthError || e instanceof TradingError || e instanceof TradingUnreachableError) return e;
  return new TradingUnreachableError();
}

export const DEFAULT_TIMEOUT_MS = 8000;

interface FetchOptions {
  timeoutMs?: number;
  /** Caller cancellation (the sheet closed): the abort is rethrown as-is, not classified. */
  signal?: AbortSignal;
}

async function errorMessage(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { error?: unknown; message?: unknown };
    if (typeof body.error === 'string') return body.error;
    if (typeof body.message === 'string') return body.message;
  } catch {
    /* not JSON */
  }
  return undefined;
}

/** GET `${base}${path}` with the Trading session cookie, a timeout and classified errors. */
export async function fetchTrading<T>(base: string, path: string, o: FetchOptions = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onCallerAbort = () => ctrl.abort();
  o.signal?.addEventListener('abort', onCallerAbort);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}${path}`, {
      credentials: 'include',
      cache: 'no-store',
      signal: ctrl.signal,
    });
    if (!res.ok) throw classifyStatus(res.status, await errorMessage(res));
    return (await res.json()) as T;
  } catch (e) {
    if (o.signal?.aborted) throw e;
    throw classifyFetchError(e);
  } finally {
    clearTimeout(timer);
    o.signal?.removeEventListener('abort', onCallerAbort);
  }
}

/** The Trading base URL from the start page server's config. */
export async function getTradingUrl(): Promise<string> {
  return (await getAppConfig()).tradingUrl;
}

/** The watchlist's snapshots (`GET /api/market/overview`). */
export async function getOverview(o?: FetchOptions): Promise<Overview> {
  return fetchTrading<Overview>(await getTradingUrl(), '/api/market/overview', o);
}

/** Closes for a price chart (`GET /api/tickers/{symbol}/bars?range=`). */
export async function getBars(symbol: string, range: BarRange, o?: FetchOptions): Promise<BarsData> {
  return fetchTrading<BarsData>(
    await getTradingUrl(),
    `/api/tickers/${encodeURIComponent(symbol)}/bars?range=${range}`,
    o,
  );
}

export type ChangeTone = 'ok' | 'loss' | 'neutral';

/** "+1.2%" or "−0.4%" for a day change that is already a percent, with its badge tone. A change that rounds to 0.0% is neutral. */
export function formatChange(dayChangePct: number): { text: string; tone: ChangeTone } {
  const text = pct(dayChangePct, { fromRatio: false, signed: true });
  if (!Number.isFinite(dayChangePct) || Math.abs(dayChangePct) < 0.05) return { text, tone: 'neutral' };
  return { text, tone: dayChangePct > 0 ? 'ok' : 'loss' };
}
