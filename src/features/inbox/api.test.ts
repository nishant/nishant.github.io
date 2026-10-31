import { afterEach, describe, expect, it, vi } from 'vitest';
import { inboxApi, inboxRequest } from './api';
import { closeInbox, inboxLive, subscribeInboxChanges } from './live';

function respond(status: number, body?: unknown, raw?: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(status === 204 ? null : (raw ?? JSON.stringify(body)), { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('inboxRequest status mapping', () => {
  it('returns the data on 200', async () => {
    respond(200, { authed: true });
    expect(await inboxApi.session()).toEqual({ ok: true, data: { authed: true } });
  });

  it('maps 204 to ok with no data', async () => {
    respond(204);
    expect(await inboxApi.login('x')).toEqual({ ok: true, data: undefined });
  });

  it('maps 401 and uses the server text', async () => {
    respond(401, { error: 'Wrong password.' });
    expect(await inboxApi.login('nope')).toEqual({ ok: false, status: 401, error: 'Wrong password.' });
  });

  it('maps 401 with no body to a default', async () => {
    respond(401, undefined, '');
    expect(await inboxApi.counts()).toEqual({ ok: false, status: 401, error: 'Log in to see this.' });
  });

  it('maps 404 (no API on this host, an HTML page)', async () => {
    respond(404, undefined, '<html>Not found</html>');
    expect(await inboxApi.session()).toEqual({ ok: false, status: 404, error: 'Inbox is not available here.' });
  });

  it('maps 503 with the proxy text', async () => {
    respond(503, { error: 'Inbox service is not answering.' });
    expect(await inboxApi.session()).toEqual({ ok: false, status: 503, error: 'Inbox service is not answering.' });
  });

  it('maps a network failure to status 0', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    expect(await inboxApi.session()).toEqual({ ok: false, status: 0, error: 'Could not reach the server.' });
  });

  it('maps a 200 that is not JSON to status 0', async () => {
    respond(200, undefined, '<html></html>');
    const r = await inboxRequest('/session');
    expect(r).toMatchObject({ ok: false, status: 0 });
  });
});

describe('request shape', () => {
  it('sends same-origin credentials and the query', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await inboxApi.list({ view: 'open', source: 'trading', cursor: '5_9', limit: 50 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/inbox/items?view=open&source=trading&cursor=5_9&limit=50');
    expect(init.credentials).toBe('same-origin');
    expect(init.method).toBe('GET');
  });

  it('posts snooze as JSON with an ISO time', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await inboxApi.snooze(7, new Date('2026-10-30T13:00:00Z'));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/inbox/items/7/snooze');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ until: '2026-10-30T13:00:00.000Z' });
  });

  it('handle-all sends the source only when given', async () => {
    const fetchMock = vi.fn(async () => new Response('{"count":2}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await inboxApi.handleAll('ci');
    await inboxApi.handleAll(null);
    const bodies = fetchMock.mock.calls.map((c) =>
      JSON.parse((c as unknown as [string, RequestInit])[1].body as string),
    );
    expect(bodies).toEqual([{ source: 'ci' }, {}]);
  });
});

describe('inboxApi.runAction', () => {
  it('POSTs to the action route and returns the updated item', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 7 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await inboxApi.runAction(7, 'restart_task')).toEqual({ ok: true, data: { id: 7 } });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/inbox/items/7/actions/restart_task',
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
  });

  it('passes a failed target through as an error', async () => {
    respond(502, { error: 'Target answered 500.' });
    expect(await inboxApi.runAction(7, 'go')).toEqual({ ok: false, status: 502, error: 'Target answered 500.' });
  });
});

describe('inboxApi bodies', () => {
  it('handleAll sends source and before only when given', async () => {
    respond(200, { count: 1 });
    await inboxApi.handleAll('trackers', '2026-10-29T12:00:00.000Z');
    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(call[0]).toBe('/api/inbox/items/handle-all');
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({
      source: 'trackers',
      before: '2026-10-29T12:00:00.000Z',
    });
    await inboxApi.handleAll();
    expect(JSON.parse((vi.mocked(fetch).mock.calls[1]![1] as RequestInit).body as string)).toEqual({});
  });

  it('removeDevice sends DELETE', async () => {
    respond(204);
    await inboxApi.removeDevice('0123456789abcdef');
    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(call[0]).toBe('/api/inbox/push/subscriptions/0123456789abcdef');
    expect((call[1] as RequestInit).method).toBe('DELETE');
  });
});

describe('subscribeInboxChanges', () => {
  class FakeEventSource {
    static all: FakeEventSource[] = [];
    readyState = 0;
    closed = false;
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    listeners = new Map<string, Array<() => void>>();
    constructor(public url: string) {
      FakeEventSource.all.push(this);
    }
    addEventListener(type: string, fn: () => void): void {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
    }
    emit(type: string): void {
      for (const fn of this.listeners.get(type) ?? []) fn();
    }
    close(): void {
      this.closed = true;
      this.readyState = 2;
    }
  }

  afterEach(() => {
    closeInbox();
    FakeEventSource.all = [];
    vi.useRealTimers();
  });

  it('calls back once per burst, shares one stream and closes on the last unsubscribe', () => {
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', FakeEventSource);
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeInboxChanges(a);
    const offB = subscribeInboxChanges(b);
    expect(FakeEventSource.all).toHaveLength(1);
    const es = FakeEventSource.all[0]!;
    expect(es.url).toBe('/api/inbox/events');
    expect(inboxLive()).toBe(false);
    es.onopen?.();
    expect(inboxLive()).toBe(true);

    es.emit('changed');
    es.emit('changed');
    es.emit('changed');
    vi.advanceTimersByTime(299);
    expect(a).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    es.emit('changed');
    vi.advanceTimersByTime(300);
    expect(a).toHaveBeenCalledTimes(2);

    offA();
    expect(es.closed).toBe(false);
    offB();
    expect(es.closed).toBe(true);
    expect(inboxLive()).toBe(false);
  });

  it('does nothing without EventSource', () => {
    vi.stubGlobal('EventSource', undefined);
    const off = subscribeInboxChanges(() => undefined);
    expect(inboxLive()).toBe(false);
    off();
  });
});
