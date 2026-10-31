import { Toaster } from '@nish/ui';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WatchlistSheet } from './WatchlistSheet';

const NOW = '2026-10-31T15:00:00.000Z';

function snap(symbol: string, price: number) {
  return { symbol, price, prevClose: price, dayChangePct: 0.5, dayHigh: price + 1, dayLow: price - 1, dayVolume: 1, updatedAt: NOW };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Overview answers two symbols once `release()` is called; summary answers `summary()`. */
function install(summary: () => Promise<Response>) {
  const calls: string[] = [];
  let release!: () => void;
  const overviewGate = new Promise<void>((r) => (release = r));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      if (url === '/api/config') return json(404, {});
      if (url.endsWith('/api/market/overview')) {
        await overviewGate;
        return json(200, { snapshots: [snap('AAPL', 200), snap('MSFT', 400)], updatedAt: NOW });
      }
      if (url.endsWith('/api/watchlist/summary')) return summary();
      return json(404, {});
    }),
  );
  return { calls, release: () => release() };
}

function renderSheet() {
  return render(
    <>
      <Toaster />
      <WatchlistSheet open onClose={() => {}} />
    </>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('WatchlistSheet summary badges', () => {
  it('shows a score badge and an open marker, and no badge for a null score', async () => {
    const server = install(() =>
      Promise.resolve(
        json(200, {
          symbols: [
            { symbol: 'AAPL', topPickScore: 82.4, topPickStrategy: 'long_call', hasOpenPosition: true, openPositionCount: 1 },
            { symbol: 'MSFT', topPickScore: null, topPickStrategy: null, hasOpenPosition: false, openPositionCount: 0 },
          ],
          scanRunId: 3,
          scannedAt: NOW,
          updatedAt: NOW,
        }),
      ),
    );
    renderSheet();
    // The summary goes out before the overview has answered: the two run in parallel.
    await waitFor(() => expect(server.calls.some((u) => u.endsWith('/api/watchlist/summary'))).toBe(true));
    server.release();

    const aapl = await screen.findByRole('button', { name: /^AAPL,/ });
    await waitFor(() => expect(aapl.textContent).toContain('82'));
    expect(aapl.getAttribute('aria-label')).toContain('Top pick 82.4 (Long Call). 1 open position.');
    expect(aapl.textContent).toContain('Open');

    const msft = screen.getByRole('button', { name: /^MSFT,/ });
    expect(msft.getAttribute('aria-label')).not.toContain('Top pick');
    expect(msft.querySelectorAll('.lucide-star')).toHaveLength(0);
    expect(server.calls.filter((u) => u.endsWith('/api/watchlist/summary'))).toHaveLength(1);
  });

  it.each([
    ['404', () => Promise.resolve(json(404, { error: 'Not Found' }))],
    ['401', () => Promise.resolve(json(401, { error: 'Not authenticated' }))],
    ['a network failure', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('works as before with no badges and no toast when the summary fails with %s', async (_n, summary) => {
    const server = install(summary);
    renderSheet();
    server.release();
    const aapl = await screen.findByRole('button', { name: /^AAPL,/ });
    await waitFor(() => expect(server.calls.some((u) => u.endsWith('/api/watchlist/summary'))).toBe(true));
    // Let the rejected summary settle before asserting nothing changed.
    await new Promise((r) => setTimeout(r, 20));
    expect(aapl.getAttribute('aria-label')).toBe('AAPL, $200.00, +0.5%. Show chart');
    expect(document.querySelectorAll('.lucide-star, .lucide-briefcase')).toHaveLength(0);
    expect(screen.queryByRole('status')?.textContent ?? '').not.toMatch(/could not|error/i);
    expect(screen.queryByText(/could not/i)).toBeNull();
  });
});
