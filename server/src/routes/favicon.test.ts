import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';
import express from 'express';
import { createFaviconRouter } from './favicon';

interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

const start = async (router: express.Router) => {
  const app = express();
  app.use('/api/favicon', router);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, port: (server.address() as AddressInfo).port };
};

const get = (port: number, query: string, headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' }) =>
  new Promise<Reply>((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: `/api/favicon?${query}`, headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }),
        );
      })
      .on('error', reject);
  });

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const img = (type: string, body: Buffer = PNG, url = ''): Response => {
  const res = new Response(new Uint8Array(body), { status: 200, headers: { 'content-type': type } });
  if (url) Object.defineProperty(res, 'url', { value: url });
  return res;
};
const notFound = (): Response => new Response('nope', { status: 404 });
const timeout = (): Promise<Response> => Promise.reject(new DOMException('timed out', 'TimeoutError'));

const fakeFetch = (impl: (url: string) => Promise<Response> | Response, log: string[] = []): typeof fetch =>
  (async (input: string | URL | Request) => {
    const url = String(input);
    log.push(url);
    return impl(url);
  }) as typeof fetch;

const isDdg = (u: string): boolean => u.startsWith('https://icons.duckduckgo.com/ip3/');

describe('favicon router', () => {
  it('serves a DuckDuckGo icon with the right headers and caches it', async () => {
    const log: string[] = [];
    const { server, port } = await start(
      createFaviconRouter({ fetchImpl: fakeFetch((u) => (isDdg(u) ? img('image/x-icon') : notFound()), log) }),
    );
    try {
      const a = await get(port, 'host=github.com');
      assert.equal(a.status, 200);
      assert.equal(a.headers['content-type'], 'image/x-icon');
      assert.equal(a.headers['cache-control'], 'public, max-age=604800');
      assert.equal(a.headers['x-content-type-options'], 'nosniff');
      assert.equal(a.headers['x-cache'], 'MISS');
      assert.deepEqual(a.body, PNG);
      assert.equal(log[0], 'https://icons.duckduckgo.com/ip3/github.com.ico');
      const b = await get(port, 'host=GitHub.com');
      assert.equal(b.headers['x-cache'], 'HIT');
      assert.equal(log.length, 1);
    } finally {
      server.close();
    }
  });

  it('rejects bad hosts with 400 and never fetches', async () => {
    const log: string[] = [];
    const { server, port } = await start(createFaviconRouter({ fetchImpl: fakeFetch(() => notFound(), log) }));
    try {
      for (const host of ['127.0.0.1', 'localhost', 'a.b', 'a.1', '', 'ex ample.com', 'evil.com/x', '-a.com']) {
        const r = await get(port, `host=${encodeURIComponent(host)}`);
        assert.equal(r.status, 400, host);
        assert.deepEqual(JSON.parse(r.body.toString()), { error: 'bad host' });
      }
      assert.equal((await get(port, '')).status, 400);
      assert.equal(log.length, 0);
    } finally {
      server.close();
    }
  });

  it('accepts an uppercase host and punycode', async () => {
    const { server, port } = await start(createFaviconRouter({ fetchImpl: fakeFetch(() => img('image/png')) }));
    try {
      assert.equal((await get(port, 'host=EXAMPLE.COM')).status, 200);
      assert.equal((await get(port, 'host=xn--bcher-kva.example')).status, 200);
    } finally {
      server.close();
    }
  });

  it('rejects cross-site callers with 403', async () => {
    const { server, port } = await start(createFaviconRouter({ fetchImpl: fakeFetch(() => img('image/png')) }));
    try {
      const r = await get(port, 'host=github.com', { origin: 'https://evil.example' });
      assert.equal(r.status, 403);
      assert.deepEqual(JSON.parse(r.body.toString()), { error: 'forbidden' });
      assert.equal((await get(port, 'host=github.com', {})).status, 403);
    } finally {
      server.close();
    }
  });

  it('falls back to Google when DuckDuckGo has no icon', async () => {
    const { server, port } = await start(
      createFaviconRouter({
        fetchImpl: fakeFetch((u) =>
          isDdg(u) ? notFound() : img('image/png', PNG, 'https://t1.gstatic.com/faviconV2?x=1'),
        ),
      }),
    );
    try {
      const r = await get(port, 'host=example.com');
      assert.equal(r.status, 200);
      assert.equal(r.headers['content-type'], 'image/png');
    } finally {
      server.close();
    }
  });

  it('ignores a Google redirect that leaves gstatic.com without fetching it', async () => {
    const log: string[] = [];
    const redirect = (to: string): Response => new Response(null, { status: 302, headers: { location: to } });
    const { server, port } = await start(
      createFaviconRouter({
        fetchImpl: fakeFetch((u) => (isDdg(u) ? notFound() : redirect('https://evil.example/x.png')), log),
      }),
    );
    try {
      assert.equal((await get(port, 'host=example.com')).status, 404);
      assert.equal(log.some((u) => u.includes('evil.example')), false);
    } finally {
      server.close();
    }
  });

  it('treats an SVG upstream type as no icon, and tries Google', async () => {
    const log: string[] = [];
    const { server, port } = await start(
      createFaviconRouter({ fetchImpl: fakeFetch((u) => (isDdg(u) ? img('image/svg+xml') : notFound()), log) }),
    );
    try {
      const r = await get(port, 'host=example.com');
      assert.equal(r.status, 404);
      assert.deepEqual(JSON.parse(r.body.toString()), { error: 'no icon' });
      assert.equal(r.headers['cache-control'], 'public, max-age=86400');
      assert.equal(log.length, 2);
    } finally {
      server.close();
    }
  });

  it('treats a body over 100 KB as no icon', async () => {
    const { server, port } = await start(
      createFaviconRouter({ fetchImpl: fakeFetch(() => img('image/png', Buffer.alloc(100 * 1024 + 1, 1))) }),
    );
    try {
      assert.equal((await get(port, 'host=example.com')).status, 404);
    } finally {
      server.close();
    }
  });

  it('caches a double 404 for a day', async () => {
    let t = 1_000_000;
    const log: string[] = [];
    const { server, port } = await start(
      createFaviconRouter({ now: () => t, fetchImpl: fakeFetch(() => notFound(), log) }),
    );
    try {
      assert.equal((await get(port, 'host=nothing.example')).status, 404);
      assert.equal(log.length, 2);
      assert.equal((await get(port, 'host=nothing.example')).headers['x-cache'], 'HIT');
      assert.equal(log.length, 2);
      t += 25 * 60 * 60_000;
      await get(port, 'host=nothing.example');
      assert.equal(log.length, 4);
    } finally {
      server.close();
    }
  });

  it('tries Google after a DuckDuckGo timeout', async () => {
    const { server, port } = await start(
      createFaviconRouter({ fetchImpl: fakeFetch((u) => (isDdg(u) ? timeout() : img('image/png'))) }),
    );
    try {
      assert.equal((await get(port, 'host=example.com')).status, 200);
    } finally {
      server.close();
    }
  });

  it('answers 404 no-store, uncached, when Google times out too', async () => {
    const log: string[] = [];
    const { server, port } = await start(createFaviconRouter({ fetchImpl: fakeFetch(() => timeout(), log) }));
    try {
      const r = await get(port, 'host=example.com');
      assert.equal(r.status, 404);
      assert.equal(r.headers['cache-control'], 'no-store');
      await get(port, 'host=example.com');
      assert.equal(log.length, 4);
    } finally {
      server.close();
    }
  });

  it('limits upstream fetches to 300 per IP per hour; cache hits are free', async () => {
    const { server, port } = await start(createFaviconRouter({ fetchImpl: fakeFetch(() => img('image/png')) }));
    try {
      for (let i = 0; i < 300; i += 1) assert.equal((await get(port, `host=site${i}.example.com`)).status, 200);
      const denied = await get(port, 'host=overflow.example.com');
      assert.equal(denied.status, 429);
      assert.ok(Number(denied.headers['retry-after']) > 0);
      assert.equal((await get(port, 'host=site0.example.com')).headers['x-cache'], 'HIT');
    } finally {
      server.close();
    }
  });
});
