import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import { inboxRouter } from './inbox';

interface Seen {
  method?: string;
  url?: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}

const listen = (server: http.Server): Promise<number> =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)));

describe('inboxRouter', () => {
  let upstream: http.Server;
  let front: http.Server;
  let frontUrl: string;
  let seen: Seen | undefined;
  let upstreamHits = 0;
  let streamClosed = 0;

  before(async () => {
    upstream = http.createServer((req, res) => {
      upstreamHits += 1;
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        seen = { method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks).toString() };
        if (req.url?.startsWith('/api/events') && !req.headers.cookie) {
          res.writeHead(401, { 'content-type': 'application/json' });
          res.end('{"error":"Not signed in."}');
        } else if (req.url?.startsWith('/api/events')) {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          res.write('event: changed\ndata: {"open":1,"urgent":0}\n\n');
          const timer = setTimeout(() => {
            res.write('event: changed\ndata: {"open":2,"urgent":0}\n\n');
          }, 300);
          res.on('close', () => {
            clearTimeout(timer);
            streamClosed += 1;
          });
        } else if (req.url?.startsWith('/api/slow')) {
          setTimeout(() => {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end('{}');
          }, 400);
        } else if (req.url?.startsWith('/api/session')) {
          res.writeHead(200, {
            'content-type': 'application/json',
            'set-cookie': ['inbox_session=abc; HttpOnly', 'other=1; Path=/'],
          });
          res.end('{"ok":true}');
        } else if (req.url?.startsWith('/api/gone')) {
          res.writeHead(204);
          res.end();
        } else if (req.url?.startsWith('/api/cached')) {
          res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'max-age=5' });
          res.end('{}');
        } else {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ echo: req.url }));
        }
      });
    });
    const upstreamPort = await listen(upstream);

    // A port that was free a moment ago and now refuses connections.
    const probe = http.createServer();
    const deadPort = await listen(probe);
    await new Promise((r) => probe.close(r));

    const app = express();
    app.use('/api/inbox', inboxRouter(`http://127.0.0.1:${upstreamPort}`));
    app.use('/short/inbox', inboxRouter(`http://127.0.0.1:${upstreamPort}`, { timeoutMs: 100 }));
    app.use('/dead/inbox', inboxRouter(`http://127.0.0.1:${deadPort}`));
    front = http.createServer(app);
    frontUrl = `http://127.0.0.1:${await listen(front)}`;
  });

  after(() => {
    upstream.close();
    front.close();
  });

  it('forwards method, body, selected headers and the query string to /api/*', async () => {
    const res = await fetch(`${frontUrl}/api/inbox/items?view=open&limit=5`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'inbox_session=x', 'x-secret': 'no' },
      body: '{"a":1}',
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { echo: '/api/items?view=open&limit=5' });
    assert.equal(seen?.method, 'POST');
    assert.equal(seen?.body, '{"a":1}');
    assert.equal(seen?.headers.cookie, 'inbox_session=x');
    assert.equal(seen?.headers['content-type'], 'application/json');
    assert.equal(seen?.headers['x-secret'], undefined);
    assert.equal(seen?.headers['x-forwarded-proto'], 'http');
    assert.ok(seen?.headers['x-forwarded-for']);
  });

  it('passes every set-cookie header back', async () => {
    const res = await fetch(`${frontUrl}/api/inbox/session`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.headers.getSetCookie(), ['inbox_session=abc; HttpOnly', 'other=1; Path=/']);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });

  it('keeps the upstream cache-control', async () => {
    const res = await fetch(`${frontUrl}/api/inbox/cached`);
    assert.equal(res.headers.get('cache-control'), 'max-age=5');
  });

  it('relays a 204 without a body', async () => {
    const res = await fetch(`${frontUrl}/api/inbox/gone`, { method: 'DELETE' });
    assert.equal(res.status, 204);
    assert.equal(await res.text(), '');
  });

  it('answers 404 for paths that must not be forwarded', async () => {
    const hitsBefore = upstreamHits;
    for (const p of ['/ingest/events', '/health', '/..%2Fhealth', '/a.b', '/x%20y']) {
      const res = await fetch(`${frontUrl}/api/inbox${p}`, { method: 'POST', body: '{}' });
      assert.equal(res.status, 404, p);
      assert.deepEqual(await res.json(), { error: 'Not found.' });
    }
    assert.equal(upstreamHits, hitsBefore);
  });

  it('answers 404 for literal dot-segment paths sent by a raw client', async () => {
    const hitsBefore = upstreamHits;
    const port = Number(new URL(frontUrl).port);
    const rawGet = (path: string): Promise<{ status?: number; body: string }> =>
      new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
        });
        req.on('error', reject);
        req.end();
      });
    for (const p of ['/api/inbox/../health', '/api/inbox/../ingest/events']) {
      const res = await rawGet(p);
      assert.equal(res.status, 404, p);
      assert.deepEqual(JSON.parse(res.body), { error: 'Not found.' }, p);
    }
    assert.equal(upstreamHits, hitsBefore);
  });

  it('answers 413 for a body over 64 KB', async () => {
    const res = await fetch(`${frontUrl}/api/inbox/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'x'.repeat(70 * 1024),
    });
    assert.equal(res.status, 413);
  });

  it('answers 503 when the upstream is down', async () => {
    const res = await fetch(`${frontUrl}/dead/inbox/counts`);
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: 'Inbox service is not answering.' });
  });

  it('streams /events without buffering or the buffered-path timeout', async () => {
    const res = await fetch(`${frontUrl}/short/inbox/events`, { headers: { cookie: 'inbox_session=x' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/event-stream');
    assert.equal(res.headers.get('cache-control'), 'no-cache, no-transform');
    assert.equal(res.headers.get('x-accel-buffering'), 'no');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let text = '';
    const started = Date.now();
    while (!text.includes('"open":2')) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
      if (!text.includes('"open":2')) assert.ok(Date.now() - started < 5000);
    }
    assert.ok(Date.now() - started >= 250, 'first event arrived before the second was sent');
    assert.ok(text.indexOf('"open":1') < text.indexOf('"open":2'));
    const closedBefore = streamClosed;
    await reader.cancel();
    for (let i = 0; i < 50 && streamClosed === closedBefore; i += 1) await new Promise((r) => setTimeout(r, 20));
    assert.equal(streamClosed, closedBefore + 1, 'upstream connection closed after the client left');
  });

  it('still times out other paths at the buffered limit', async () => {
    const res = await fetch(`${frontUrl}/short/inbox/slow`);
    assert.equal(res.status, 503);
  });

  it('relays a non-stream answer from /events like any response', async () => {
    const started = Date.now();
    const res = await fetch(`${frontUrl}/api/inbox/events`, { signal: AbortSignal.timeout(3000) });
    assert.equal(res.status, 401);
    assert.match(res.headers.get('content-type') ?? '', /^application\/json/);
    assert.deepEqual(await res.json(), { error: 'Not signed in.' });
    assert.ok(Date.now() - started < 2000, 'answered without hanging');
  });

  it('answers 503 for /events when the inbox is down', async () => {
    const res = await fetch(`${frontUrl}/dead/inbox/events`);
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: 'Inbox service is not answering.' });
  });
});
