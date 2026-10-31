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

/** One watchlist symbol in trading's `GET /api/watchlist/summary` (copied from its shared
 *  `WatchlistSymbolSummary`). */
export interface WatchlistSymbolSummary {
  symbol: string;
  /** Highest composite score (0..100) in the newest finished scan; null when there is none, never 0. */
  topPickScore: number | null;
  /** That candidate's strategy (`long_call`, `long_put`, `csp`, `covered_call`); null with the score. */
  topPickStrategy: string | null;
  /** At least one taken (real-money) pick on the symbol is open. */
  hasOpenPosition: boolean;
  openPositionCount: number;
}

export interface WatchlistSummaryData {
  symbols: WatchlistSymbolSummary[];
  scanRunId: number | null;
  scannedAt: string | null;
  updatedAt: string;
}

/** What a watchlist row shows beside its symbol. */
export interface SymbolBadges {
  /** The top pick's score, rounded for the badge; null means no badge. */
  score: number | null;
  /** The unrounded score, for the tooltip and the row's label. */
  scoreExact: number | null;
  /** "Long Call"; null with the score. */
  strategy: string | null;
  /** Open taken positions on the symbol; 0 means no marker. */
  openCount: number;
}

const STRATEGY_LABELS: Record<string, string> = {
  long_call: 'Long Call',
  long_put: 'Long Put',
  csp: 'Cash-Secured Put',
  covered_call: 'Covered Call',
};

/** "Long Call" for `long_call`; an unknown id is title-cased so a new strategy still reads. */
export function strategyLabel(id: string): string {
  const known = STRATEGY_LABELS[id];
  if (known) return known;
  return id
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Badges by symbol from a summary body. Anything malformed yields no badges rather than a wrong
 *  one: a missing or non-numeric score is no badge (never a 0), and a bad body is an empty map. */
export function summaryBadges(data: unknown): Map<string, SymbolBadges> {
  const out = new Map<string, SymbolBadges>();
  const symbols = (data as { symbols?: unknown } | null)?.symbols;
  if (!Array.isArray(symbols)) return out;
  for (const raw of symbols as unknown[]) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Partial<Record<keyof WatchlistSymbolSummary, unknown>>;
    if (typeof r.symbol !== 'string' || !r.symbol) continue;
    const exact = typeof r.topPickScore === 'number' && Number.isFinite(r.topPickScore) ? r.topPickScore : null;
    const strategy =
      exact !== null && typeof r.topPickStrategy === 'string' && r.topPickStrategy
        ? strategyLabel(r.topPickStrategy)
        : null;
    const count =
      typeof r.openPositionCount === 'number' && Number.isFinite(r.openPositionCount)
        ? Math.max(0, Math.floor(r.openPositionCount))
        : 0;
    const openCount = r.hasOpenPosition === true ? Math.max(1, count) : 0;
    if (exact === null && openCount === 0) continue;
    out.set(r.symbol, { score: exact === null ? null : Math.round(exact), scoreExact: exact, strategy, openCount });
  }
  return out;
}

/** Per-symbol badges from `GET /api/watchlist/summary`. Never rejects: any failure (a 404 from an
 *  older Trading, 401, CORS, network, timeout) resolves null, so the sheet works as it did before
 *  the route existed and a failed reload can keep the badges it has. Cookie auth only: this public
 *  page never holds a token. */
export async function getWatchlistBadges(o?: FetchOptions): Promise<Map<string, SymbolBadges> | null> {
  try {
    return summaryBadges(await fetchTrading<unknown>(await getTradingUrl(), '/api/watchlist/summary', o));
  } catch {
    return null;
  }
}

/** "Top pick 82.4 (Long Call). 1 open position." for a row's label; empty without badges. */
export function badgesLabel(b: SymbolBadges | undefined): string {
  if (!b) return '';
  const parts: string[] = [];
  if (b.scoreExact !== null) parts.push(`Top pick ${b.scoreExact}${b.strategy ? ` (${b.strategy})` : ''}.`);
  if (b.openCount > 0) parts.push(`${b.openCount} open position${b.openCount === 1 ? '' : 's'}.`);
  return parts.join(' ');
}

export type ChangeTone = 'ok' | 'loss' | 'neutral';

/** "+1.2%" or "−0.4%" for a day change that is already a percent, with its badge tone. A change that rounds to 0.0% is neutral. */
export function formatChange(dayChangePct: number): { text: string; tone: ChangeTone } {
  const text = pct(dayChangePct, { fromRatio: false, signed: true });
  if (!Number.isFinite(dayChangePct) || Math.abs(dayChangePct) < 0.05) return { text, tone: 'neutral' };
  return { text, tone: dayChangePct > 0 ? 'ok' : 'loss' };
}

export type LocalNetworkState = 'granted' | 'prompt' | 'denied' | 'unsupported';

/** Chrome's "Local network access" permission for this page. Trading resolves to a Tailscale
 *  address, which Chrome treats as local, so a public page needs it to reach Trading. */
export async function localNetworkAccess(): Promise<LocalNetworkState> {
  try {
    const status = await navigator.permissions.query({ name: 'local-network-access' as PermissionName });
    return status.state;
  } catch {
    return 'unsupported';
  }
}
