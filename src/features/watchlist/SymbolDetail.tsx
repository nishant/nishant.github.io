import { Badge, ErrorState, KeyValueList, LineChart, RelativeTime, Segmented, cn, linkClass } from '@nish/ui';
import { date, money, num, time } from '@nish/ui/format';
import { useEffect, useMemo, useState } from 'react';
import {
  TradingAuthError,
  TradingUnreachableError,
  formatChange,
  getBars,
  type BarRange,
  type BarsData,
  type Snapshot,
} from './trading';

const RANGES: { value: BarRange; label: string }[] = [
  { value: '1D', label: '1D' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '1Y', label: '1Y' },
];

interface BarsState {
  data: BarsData | null;
  loading: boolean;
  error: Error | null;
}

/** Closes for one symbol and range. The previous series stays in `data` while the next one loads. */
function useBars(symbol: string, range: BarRange): BarsState & { retry: () => void } {
  const [state, setState] = useState<BarsState>({ data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    getBars(symbol, range, { signal: ctrl.signal })
      .then((data) => {
        if (!ctrl.signal.aborted) setState({ data, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e : new Error('Could not load the chart') }));
      });
    return () => ctrl.abort();
  }, [symbol, range, attempt]);

  return { ...state, retry: () => setAttempt((n) => n + 1) };
}

function barsErrorMessage(e: Error): string {
  if (e instanceof TradingUnreachableError) return "Can't reach Trading. Check your Tailscale connection.";
  if (e instanceof TradingAuthError) return 'Your Trading sign-in has expired. Open Trading to sign in again.';
  return e.message;
}

/** The chart and numbers for one watchlist symbol, shown inside the Watchlist sheet. */
export function SymbolDetail({ snapshot, tradingUrl }: { snapshot: Snapshot; tradingUrl: string }) {
  const [range, setRange] = useState<BarRange>('1D');
  const { data, loading, error, retry } = useBars(snapshot.symbol, range);
  const change = formatChange(snapshot.dayChangePct);

  const points = useMemo(() => (data?.bars ?? []).map((b) => ({ x: Date.parse(b.t), y: b.c })), [data]);
  const shownRange = data?.range ?? range;
  const first = points[0]?.y;
  const last = points[points.length - 1]?.y;
  const tone = first !== undefined && last !== undefined && last < first ? 'loss' : 'ok';
  const intraday = shownRange === '1D';
  const switching = loading && data !== null;

  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-lg font-semibold text-th-hi">{snapshot.symbol}</div>
          <div className="text-3xl font-semibold tabular-nums text-th-hi">{money(snapshot.price)}</div>
        </div>
        <Badge tone={change.tone}>{change.text}</Badge>
      </div>

      <Segmented label="Chart range" options={RANGES} value={range} onChange={setRange} block />

      {error ? (
        <ErrorState compact message={barsErrorMessage(error)} onRetry={retry} />
      ) : (
        <div className={cn('transition-opacity', switching && 'opacity-50')} aria-busy={loading}>
          <LineChart
            data={points}
            height={220}
            area
            tone={tone}
            baseline={intraday && data?.prevClose != null ? data.prevClose : undefined}
            yFormat={(v) => money(v)}
            xFormat={intraday ? (v) => time(v) : (v) => date(v, 'short')}
            label={`${snapshot.symbol} price, ${shownRange}`}
            loading={loading && data === null}
          />
        </div>
      )}

      <KeyValueList
        dense
        className="sm:grid sm:grid-cols-2 sm:gap-x-6"
        items={[
          {
            key: 'range',
            label: 'Day range',
            value: <span className="tabular-nums">{`${money(snapshot.dayLow)} – ${money(snapshot.dayHigh)}`}</span>,
          },
          { key: 'prev', label: 'Previous close', value: <span className="tabular-nums">{money(snapshot.prevClose)}</span> },
          { key: 'vol', label: 'Volume', value: <span className="tabular-nums">{num(snapshot.dayVolume, { compact: true })}</span> },
          { key: 'upd', label: 'Updated', value: <RelativeTime value={snapshot.updatedAt} /> },
        ]}
      />

      <a
        href={`${tradingUrl.replace(/\/+$/, '')}/tickers/${encodeURIComponent(snapshot.symbol)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass({ className: 'self-start text-sm' })}
      >
        Open in Trading
      </a>
    </div>
  );
}
