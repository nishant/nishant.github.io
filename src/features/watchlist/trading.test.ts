import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TradingAuthError,
  TradingError,
  TradingUnreachableError,
  badgesLabel,
  classifyFetchError,
  classifyStatus,
  fetchTrading,
  formatChange,
  getWatchlistBadges,
  strategyLabel,
  summaryBadges,
} from './trading';

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** A fetch that never answers and rejects with an AbortError when its signal aborts. */
function hangingFetch() {
  return vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('classifyStatus', () => {
  it('maps 401 to the auth error', () => {
    expect(classifyStatus(401)).toBeInstanceOf(TradingAuthError);
  });
  it('maps other statuses to TradingError with the message or a default', () => {
    const e = classifyStatus(500, 'boom');
    expect(e).toBeInstanceOf(TradingError);
    expect(e.message).toBe('boom');
    expect(classifyStatus(502).message).toBe('Trading returned 502');
  });
});

describe('classifyFetchError', () => {
  it('maps a network TypeError and an abort to unreachable', () => {
    expect(classifyFetchError(new TypeError('Failed to fetch'))).toBeInstanceOf(TradingUnreachableError);
    expect(classifyFetchError(new DOMException('aborted', 'AbortError'))).toBeInstanceOf(TradingUnreachableError);
  });
  it('keeps already classified errors', () => {
    const e = new TradingAuthError();
    expect(classifyFetchError(e)).toBe(e);
  });
});

describe('fetchTrading', () => {
  it('sends credentials and no-store, and joins base and path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchTrading('https://t.example/', '/api/x')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://t.example/api/x',
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });
  it('throws the auth error on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(401, { error: 'no' })));
    await expect(fetchTrading('https://t.example', '/api/x')).rejects.toBeInstanceOf(TradingAuthError);
  });
  it('uses the server error message on other statuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(500, { error: 'Provider down' })));
    await expect(fetchTrading('https://t.example', '/api/x')).rejects.toMatchObject({
      name: 'TradingError',
      message: 'Provider down',
      status: 500,
    });
  });
  it('throws unreachable on a network TypeError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(fetchTrading('https://t.example', '/api/x')).rejects.toBeInstanceOf(TradingUnreachableError);
  });
  it('throws unreachable when the request times out', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    await expect(fetchTrading('https://t.example', '/api/x', { timeoutMs: 10 })).rejects.toBeInstanceOf(
      TradingUnreachableError,
    );
  });
  it('rethrows the abort when the caller cancelled', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const caller = new AbortController();
    const p = fetchTrading('https://t.example', '/api/x', { signal: caller.signal });
    caller.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('formatChange', () => {
  it('formats a percent number with a sign and tone', () => {
    expect(formatChange(1.234)).toEqual({ text: '+1.2%', tone: 'ok' });
    expect(formatChange(-0.42)).toEqual({ text: '−0.4%', tone: 'loss' });
  });
  it('treats a change that rounds to zero as neutral', () => {
    expect(formatChange(0)).toEqual({ text: '0.0%', tone: 'neutral' });
    expect(formatChange(0.03).tone).toBe('neutral');
  });
  it('does not treat the value as a ratio', () => {
    expect(formatChange(12).text).toBe('+12.0%');
  });
});

function summaryRow(over: Record<string, unknown> = {}) {
  return {
    symbol: 'AAPL',
    topPickScore: 82.4,
    topPickStrategy: 'long_call',
    hasOpenPosition: false,
    openPositionCount: 0,
    ...over,
  };
}

function summaryBody(symbols: unknown[]) {
  return { symbols, scanRunId: 7, scannedAt: '2026-10-30T20:10:00.000Z', updatedAt: '2026-10-31T12:00:00.000Z' };
}

describe('strategyLabel', () => {
  it('names the four strategies and title-cases an unknown one', () => {
    expect(strategyLabel('long_call')).toBe('Long Call');
    expect(strategyLabel('long_put')).toBe('Long Put');
    expect(strategyLabel('csp')).toBe('Cash-Secured Put');
    expect(strategyLabel('covered_call')).toBe('Covered Call');
    expect(strategyLabel('iron_condor')).toBe('Iron Condor');
  });
});

describe('summaryBadges', () => {
  it('maps a score, its strategy and the open count', () => {
    const b = summaryBadges(summaryBody([summaryRow({ hasOpenPosition: true, openPositionCount: 2 })]));
    expect(b.get('AAPL')).toEqual({ score: 82, scoreExact: 82.4, strategy: 'Long Call', openCount: 2 });
  });
  it('gives a null score no badge, never a 0', () => {
    const b = summaryBadges(summaryBody([summaryRow({ topPickScore: null, topPickStrategy: null })]));
    expect(b.has('AAPL')).toBe(false);
    expect(b.get('AAPL')?.score).toBeUndefined();
  });
  it('keeps the open marker when the score is null', () => {
    const b = summaryBadges(
      summaryBody([summaryRow({ topPickScore: null, topPickStrategy: null, hasOpenPosition: true, openPositionCount: 1 })]),
    );
    expect(b.get('AAPL')).toEqual({ score: null, scoreExact: null, strategy: null, openCount: 1 });
  });
  it('treats a missing or non-numeric score as unknown, not 0', () => {
    const b = summaryBadges(
      summaryBody([
        summaryRow({ symbol: 'A', topPickScore: undefined }),
        summaryRow({ symbol: 'B', topPickScore: '82' }),
        summaryRow({ symbol: 'C', topPickScore: Number.NaN }),
      ]),
    );
    expect(b.size).toBe(0);
  });
  it('shows a real score of 0, which the route only sends for a measured candidate', () => {
    expect(summaryBadges(summaryBody([summaryRow({ topPickScore: 0 })])).get('AAPL')?.score).toBe(0);
  });
  it('shows no marker unless hasOpenPosition is true', () => {
    const b = summaryBadges(summaryBody([summaryRow({ topPickScore: null, hasOpenPosition: false, openPositionCount: 3 })]));
    expect(b.has('AAPL')).toBe(false);
    expect(summaryBadges(summaryBody([summaryRow({ hasOpenPosition: true, openPositionCount: 0 })])).get('AAPL')?.openCount).toBe(1);
  });
  it('returns an empty map for a malformed body', () => {
    expect(summaryBadges(null).size).toBe(0);
    expect(summaryBadges({}).size).toBe(0);
    expect(summaryBadges({ symbols: 'x' }).size).toBe(0);
    expect(summaryBadges(summaryBody([null, 4, { topPickScore: 50 }])).size).toBe(0);
  });
});

describe('badgesLabel', () => {
  it('reads the score, strategy and positions', () => {
    expect(badgesLabel({ score: 82, scoreExact: 82.4, strategy: 'Long Call', openCount: 1 })).toBe(
      'Top pick 82.4 (Long Call). 1 open position.',
    );
    expect(badgesLabel({ score: null, scoreExact: null, strategy: null, openCount: 2 })).toBe('2 open positions.');
    expect(badgesLabel(undefined)).toBe('');
  });
});

describe('getWatchlistBadges', () => {
  /** /api/config answers 404 (the fallback Trading URL); the summary route answers `summary`. */
  function install(summary: () => Promise<Response>) {
    const fetchMock = vi.fn((url: string) => (url === '/api/config' ? Promise.resolve(respond(404, {})) : summary()));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('fetches the summary with the session cookie and no token', async () => {
    const fetchMock = install(() => Promise.resolve(respond(200, summaryBody([summaryRow()]))));
    const b = await getWatchlistBadges();
    expect(b?.get('AAPL')?.score).toBe(82);
    const call = fetchMock.mock.calls.find(([u]) => u.endsWith('/api/watchlist/summary'));
    expect(call?.[0]).toBe('https://trading.nish.software/api/watchlist/summary');
    const init = (call as unknown as [string, RequestInit])[1];
    expect(init.credentials).toBe('include');
    expect(init.headers).toBeUndefined();
  });
  it.each([
    ['a 404 from an older Trading', () => Promise.resolve(respond(404, { error: 'Not Found' }))],
    ['a 401', () => Promise.resolve(respond(401, { error: 'Not authenticated' }))],
    ['a 500', () => Promise.resolve(respond(500, { error: 'boom' }))],
    ['a network or CORS failure', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a body that is not JSON', () => Promise.resolve(new Response('<html>', { status: 200 }))],
  ])('resolves null, not an empty success, on %s', async (_name, summary) => {
    install(summary);
    await expect(getWatchlistBadges()).resolves.toBeNull();
  });
  it('resolves null when the request times out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) =>
        url === '/api/config' ? Promise.resolve(respond(404, {})) : hangingFetch()(url, init),
      ),
    );
    await expect(getWatchlistBadges({ timeoutMs: 10 })).resolves.toBeNull();
  });
  it('tells a scan with no picks (empty map) apart from a failure (null)', async () => {
    install(() => Promise.resolve(respond(200, summaryBody([summaryRow({ topPickScore: null, topPickStrategy: null })]))));
    const b = await getWatchlistBadges();
    expect(b).not.toBeNull();
    expect(b?.size).toBe(0);
  });
});
