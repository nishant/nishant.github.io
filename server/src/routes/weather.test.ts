import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import express from 'express';
import { createWeatherRouter } from './weather';

interface ReplyBody {
  error?: string;
  code?: string;
  city?: string;
  current?: { n: number };
}

interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  json: ReplyBody;
}

const request = (port: number, path: string, headers: Record<string, string> = { 'sec-fetch-site': 'same-origin' }) =>
  new Promise<Reply>((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path, headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          resolve({ status: res.statusCode ?? 0, headers: res.headers, json: text ? JSON.parse(text) : null });
        });
      })
      .on('error', reject);
  });

const start = async (router: express.Router) => {
  const app = express();
  app.use('/api/weather', router);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { server, port: (server.address() as AddressInfo).port };
};

const forecast = (n = 0) => ({ current: { n }, hourly: [], daily: [], timezone: 'UTC', timezone_offset: 0 });

describe('weather router', () => {
  before(() => {
    process.env.OPENWEATHERMAP_API_KEY = 'test-key';
  });

  after(() => {
    delete process.env.OPENWEATHERMAP_API_KEY;
  });

  it('rounds coordinates before the upstream call and shares the cache entry', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const { server, port } = await start(
      createWeatherRouter({
        fetchJson: async (_url, params) => {
          calls.push(params);
          return forecast();
        },
      }),
    );
    try {
      const a = await request(port, '/api/weather/data?lat=30.26789&lon=-97.74321');
      assert.equal(a.status, 200);
      assert.equal(a.headers['x-cache'], 'MISS');
      assert.equal(calls[0].lat, 30.27);
      assert.equal(calls[0].lon, -97.74);
      const b = await request(port, '/api/weather/data?lat=30.2701&lon=-97.7399');
      assert.equal(b.headers['x-cache'], 'HIT');
      assert.equal(calls.length, 1);
    } finally {
      server.close();
    }
  });

  it('rejects cross-site callers with 403', async () => {
    const { server, port } = await start(createWeatherRouter({ fetchJson: async () => forecast() }));
    try {
      assert.equal((await request(port, '/api/weather/data?lat=1&lon=1', {})).status, 403);
      const evil = await request(port, '/api/weather/data?lat=1&lon=1', { origin: 'https://evil.example' });
      assert.equal(evil.status, 403);
    } finally {
      server.close();
    }
  });

  it('limits each IP to 60 requests per window, with Retry-After', async () => {
    const { server, port } = await start(createWeatherRouter({ fetchJson: async () => forecast(), dailyCap: 1000 }));
    try {
      for (let i = 0; i < 60; i += 1) {
        assert.equal((await request(port, '/api/weather/data?lat=1&lon=1')).status, 200);
      }
      const denied = await request(port, '/api/weather/data?lat=1&lon=1');
      assert.equal(denied.status, 429);
      assert.equal(denied.json.error, 'Too many weather requests. Try again in a few minutes.');
      assert.ok(Number(denied.headers['retry-after']) > 0);
    } finally {
      server.close();
    }
  });

  it('answers 503 daily_cap when spent, serves a stale entry when one exists, and resets at UTC midnight', async () => {
    let t = Date.UTC(2026, 9, 31, 23, 0, 0);
    let upstream = 0;
    const { server, port } = await start(
      createWeatherRouter({
        dailyCap: 1,
        now: () => t,
        fetchJson: async () => {
          upstream += 1;
          return forecast(upstream);
        },
      }),
    );
    try {
      assert.equal((await request(port, '/api/weather/data?lat=10&lon=10')).status, 200);
      // A different place has nothing cached and the cap is spent.
      const capped = await request(port, '/api/weather/data?lat=20&lon=20');
      assert.equal(capped.status, 503);
      assert.equal(capped.json.code, 'daily_cap');
      assert.equal(capped.json.error, "Weather has reached today's limit. Try again tomorrow.");
      // Same place after the TTL: the entry is stale and the cap is spent, so the stale copy is served.
      t += 11 * 60_000;
      const stale = await request(port, '/api/weather/data?lat=10&lon=10');
      assert.equal(stale.status, 200);
      assert.equal(stale.headers['x-cache'], 'STALE');
      assert.equal(stale.json.current?.n, 1);
      assert.equal(upstream, 1);
      // Past UTC midnight the cap resets and the entry is refreshed.
      t = Date.UTC(2026, 10, 1, 0, 5, 0);
      const fresh = await request(port, '/api/weather/data?lat=10&lon=10');
      assert.equal(fresh.headers['x-cache'], 'MISS');
      assert.equal(fresh.json.current?.n, 2);
    } finally {
      server.close();
    }
  });

  it('counts location lookups against the cap and validates coordinates', async () => {
    const { server, port } = await start(
      createWeatherRouter({
        dailyCap: 1,
        fetchJson: async () => [{ name: 'Austin', state: 'Texas', country: 'US', lat: 30.27, lon: -97.74 }],
      }),
    );
    try {
      assert.equal((await request(port, '/api/weather/location?lat=abc&lon=1')).status, 400);
      const ok = await request(port, '/api/weather/location?lat=30.27&lon=-97.74');
      assert.equal(ok.json.city, 'Austin');
      const capped = await request(port, '/api/weather/location?lat=40&lon=-97.74');
      assert.equal(capped.status, 503);
      assert.equal(capped.json.code, 'daily_cap');
    } finally {
      server.close();
    }
  });

  it('answers 503 when no API key is configured', async () => {
    const { server, port } = await start(createWeatherRouter({ fetchJson: async () => forecast() }));
    const key = process.env.OPENWEATHERMAP_API_KEY;
    delete process.env.OPENWEATHERMAP_API_KEY;
    try {
      assert.equal((await request(port, '/api/weather/data?lat=1&lon=1')).status, 503);
    } finally {
      process.env.OPENWEATHERMAP_API_KEY = key;
      server.close();
    }
  });
});
