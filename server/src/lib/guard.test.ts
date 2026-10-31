import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';
import express, { Request } from 'express';
import { clientIp, createDailyCap, createLimiter, sameSiteOnly, upstreamGate } from './guard';

const fakeReq = (headers: Record<string, string>, remote = '10.0.0.9'): Request =>
  ({ headers, socket: { remoteAddress: remote } }) as unknown as Request;

describe('clientIp', () => {
  it('prefers cf-connecting-ip', () => {
    assert.equal(
      clientIp(fakeReq({ 'cf-connecting-ip': ' 1.2.3.4 , 5.6.7.8', 'x-forwarded-for': '9.9.9.9' })),
      '1.2.3.4',
    );
  });
  it('uses the rightmost non-loopback X-Forwarded-For entry', () => {
    assert.equal(
      clientIp(fakeReq({ 'x-forwarded-for': '6.6.6.6,  203.0.113.5 , 127.0.0.1, ::1, ::ffff:127.0.0.1' })),
      '203.0.113.5',
    );
  });
  it('ignores an empty cf header and empty XFF entries', () => {
    assert.equal(clientIp(fakeReq({ 'cf-connecting-ip': '  ', 'x-forwarded-for': ' , 8.8.8.8 , ' })), '8.8.8.8');
  });
  it('falls back to the socket address, then unknown', () => {
    assert.equal(clientIp(fakeReq({ 'x-forwarded-for': '' })), '10.0.0.9');
    assert.equal(clientIp(fakeReq({ 'x-forwarded-for': '127.0.0.1' })), '10.0.0.9');
    assert.equal(clientIp({ headers: {}, socket: {} } as unknown as Request), 'unknown');
  });
});

describe('createLimiter', () => {
  it('allows up to the limit, then denies with a retry time, then resets', () => {
    const l = createLimiter({ limit: 2, windowMs: 10_000 });
    assert.equal(l.hit('a', 0).ok, true);
    assert.equal(l.hit('a', 1000).ok, true);
    const denied = l.hit('a', 4000);
    assert.equal(denied.ok, false);
    assert.equal(denied.retryAfterS, 6);
    assert.equal(l.hit('b', 4000).ok, true);
    assert.equal(l.hit('a', 10_000).ok, true);
  });
  it('evicts the oldest keys at maxKeys', () => {
    const l = createLimiter({ limit: 1, windowMs: 60_000, maxKeys: 3 });
    for (const k of ['a', 'b', 'c', 'd']) l.hit(k, 0);
    assert.equal(l.size(), 3);
    // 'a' was evicted, so it gets a fresh window; 'd' is still counted.
    assert.equal(l.hit('d', 1).ok, false);
    assert.equal(l.hit('a', 1).ok, true);
    assert.ok(l.size() <= 3);
  });
});

describe('createDailyCap', () => {
  it('counts per UTC day and rolls over at midnight', () => {
    const cap = createDailyCap(2);
    const t = Date.UTC(2026, 9, 31, 23, 59, 0);
    assert.equal(cap.take(t), true);
    assert.equal(cap.take(t), true);
    assert.equal(cap.take(t), false);
    assert.equal(cap.used(t), 2);
    const next = Date.UTC(2026, 10, 1, 0, 0, 1);
    assert.equal(cap.used(next), 0);
    assert.equal(cap.take(next), true);
  });
});

describe('upstreamGate', () => {
  it('limits concurrency, queues, and rejects with busy when the queue is full', async () => {
    const gate = upstreamGate(2, 1);
    let running = 0;
    let peak = 0;
    const releases: Array<() => void> = [];
    const job = () =>
      gate.run(
        () =>
          new Promise<void>((resolve) => {
            running += 1;
            peak = Math.max(peak, running);
            releases.push(() => {
              running -= 1;
              resolve();
            });
          }),
      );
    const p1 = job();
    const p2 = job();
    const p3 = job(); // queued
    await assert.rejects(job(), /busy/);
    assert.equal(releases.length, 2);
    releases[0]();
    await p1;
    await new Promise((r) => setImmediate(r));
    assert.equal(releases.length, 3);
    releases[1]();
    releases[2]();
    await Promise.all([p2, p3]);
    assert.equal(peak, 2);
  });
});

describe('sameSiteOnly', () => {
  const app = express();
  app.use(sameSiteOnly(new Set(['https://start.nish.software'])));
  app.get('/', (_req, res) => {
    res.json({ ok: true });
  });
  const server = http.createServer(app);

  const get = (headers: Record<string, string>): Promise<number> =>
    new Promise((resolve, reject) => {
      const port = (server.address() as AddressInfo).port;
      http
        .get({ host: '127.0.0.1', port, path: '/', headers }, (res) => {
          res.resume();
          res.on('end', () => resolve(res.statusCode ?? 0));
        })
        .on('error', reject);
    });

  it('allows same-origin, the self origin, the allowed list and matching referers; rejects the rest', async () => {
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    try {
      const self = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      assert.equal(await get({ 'sec-fetch-site': 'same-origin' }), 200);
      assert.equal(await get({ origin: self }), 200);
      assert.equal(await get({ origin: 'https://start.nish.software' }), 200);
      assert.equal(await get({ referer: 'https://start.nish.software/#/home' }), 200);
      assert.equal(await get({ referer: `${self}/x` }), 200);
      assert.equal(await get({}), 403);
      assert.equal(await get({ origin: 'https://evil.example' }), 403);
      assert.equal(await get({ 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' }), 403);
      assert.equal(await get({ 'sec-fetch-site': 'cross-site', referer: 'https://start.nish.software/' }), 403);
      assert.equal(await get({ referer: 'not a url' }), 403);
    } finally {
      server.close();
    }
  });
});
