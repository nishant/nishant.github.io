import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TradingAuthError,
  TradingError,
  TradingUnreachableError,
  classifyFetchError,
  classifyStatus,
  fetchTrading,
  formatChange,
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
