import { afterEach, describe, expect, it, vi } from 'vitest';
import { inboxApi, inboxRequest } from './api';

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
