import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  Modal,
  RangeBar,
  RelativeTime,
  SkeletonRows,
  Tooltip,
  buttonClass,
  cn,
  linkClass,
  toast,
} from '@nish/ui';
import { money } from '@nish/ui/format';
import { ArrowLeft, Briefcase, ChartCandlestick, ExternalLink, Lock, RefreshCw, ShieldAlert, Star, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SymbolDetail } from './SymbolDetail';
import {
  TradingAuthError,
  TradingUnreachableError,
  formatChange,
  getOverview,
  getTradingUrl,
  badgesLabel,
  getWatchlistBadges,
  localNetworkAccess,
  type LocalNetworkState,
  type Overview,
  type Snapshot,
  type SymbolBadges,
} from './trading';

const POLL_MS = 30_000;
const FALLBACK_URL = 'https://trading.nish.software';

interface OverviewState {
  data: Overview | null;
  error: Error | null;
  loading: boolean;
}

/** The watchlist overview, refreshed every 30s while the tab is visible. A failed refresh keeps the last data. */
function useOverview(): OverviewState & { refresh: () => void } {
  const [state, setState] = useState<OverviewState>({ data: null, error: null, loading: true });
  const ctrl = useRef<AbortController | null>(null);
  const hasData = useRef(false);

  const load = useCallback((manual: boolean) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setState((s) => ({ ...s, loading: true }));
    getOverview({ signal: c.signal })
      .then((data) => {
        if (c.signal.aborted) return;
        hasData.current = true;
        setState({ data, error: null, loading: false });
      })
      .catch((e: unknown) => {
        if (c.signal.aborted) return;
        const error = e instanceof Error ? e : new Error('Could not load the watchlist');
        setState((s) => ({ ...s, error, loading: false }));
        if (manual && hasData.current) toast.error(`Could not refresh: ${error.message}`);
      });
  }, []);

  useEffect(() => {
    load(false);
    const tick = window.setInterval(() => {
      if (!document.hidden) load(false);
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) load(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
      ctrl.current?.abort();
    };
  }, [load]);

  return { ...state, refresh: () => load(true) };
}

/** Trading's per-symbol pick scores and open positions, loaded once when the sheet opens (and on a
 *  manual refresh), alongside the first overview request. It never errors: a Trading without the
 *  route, or any failure, leaves the map empty and the rows without badges. */
function useSummaryBadges(): { badges: Map<string, SymbolBadges>; reload: () => void } {
  const [badges, setBadges] = useState<Map<string, SymbolBadges>>(() => new Map());
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    void getWatchlistBadges({ signal: c.signal }).then((b) => {
      // null is a failure: keep whatever is shown (nothing, on the first load).
      if (!c.signal.aborted && b) setBadges(b);
    });
    return () => c.abort();
  }, [attempt]);
  return { badges, reload: () => setAttempt((n) => n + 1) };
}

function RowBadges({ b }: { b: SymbolBadges }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {b.score !== null && (
        <Tooltip
          focusable={false}
          tip={`Top pick ${b.scoreExact}${b.strategy ? `: ${b.strategy}` : ''} (newest scan)`}
        >
          <Badge size="xs" tone="accent" className="gap-0.5 tabular-nums">
            <Star size={10} aria-hidden="true" className="fill-current" />
            {b.score}
          </Badge>
        </Tooltip>
      )}
      {b.openCount > 0 && (
        <Tooltip focusable={false} tip={`${b.openCount} open position${b.openCount === 1 ? '' : 's'}`}>
          <Badge size="xs" tone="info" className="gap-0.5 tabular-nums">
            <Briefcase size={10} aria-hidden="true" />
            {b.openCount > 1 ? `${b.openCount} Open` : 'Open'}
          </Badge>
        </Tooltip>
      )}
    </span>
  );
}

function SymbolRow({ s, badges, onSelect }: { s: Snapshot; badges?: SymbolBadges; onSelect: () => void }) {
  const change = formatChange(s.dayChangePct);
  const hasRange = Number.isFinite(s.dayLow) && Number.isFinite(s.dayHigh) && s.dayHigh > s.dayLow;
  const extra = badgesLabel(badges);
  return (
    <li className="border-b border-th-line last:border-b-0">
      <button
        type="button"
        onClick={onSelect}
        aria-label={`${s.symbol}, ${money(s.price)}, ${change.text}.${extra ? ` ${extra}` : ''} Show chart`}
        className={cn(
          'flex w-full flex-col justify-center gap-1 px-4 py-2 text-left outline-none',
          'min-h-[52px] hover:bg-th-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-th-accent',
        )}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-mono font-semibold text-th-hi">{s.symbol}</span>
              {badges && <RowBadges b={badges} />}
            </span>
            <span className="hidden text-xs tabular-nums text-th-hi3 min-[400px]:block">
              {`${money(s.dayLow)} – ${money(s.dayHigh)}`}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="tabular-nums text-th-hi">{money(s.price)}</span>
            <Badge tone={change.tone} className="min-w-[4.5rem] justify-center tabular-nums">
              {change.text}
            </Badge>
          </span>
        </span>
        {hasRange && (
          <span className="hidden sm:block" aria-hidden="true">
            <RangeBar min={s.dayLow} max={s.dayHigh} low={s.dayLow} high={s.dayHigh} current={s.price} />
          </span>
        )}
      </button>
    </li>
  );
}

function WatchlistModal({ onClose }: { onClose: () => void }) {
  const { data, error, loading, refresh: refreshOverview } = useOverview();
  const { badges, reload: reloadBadges } = useSummaryBadges();
  const refresh = () => {
    refreshOverview();
    reloadBadges();
  };
  const [tradingUrl, setTradingUrl] = useState(FALLBACK_URL);
  const [selected, setSelected] = useState<string | null>(null);
  const [lna, setLna] = useState<LocalNetworkState>('unsupported');

  const unreachable = error instanceof TradingUnreachableError;
  useEffect(() => {
    if (!unreachable) return;
    let live = true;
    void localNetworkAccess().then((s) => {
      if (live) setLna(s);
    });
    return () => {
      live = false;
    };
  }, [unreachable, error]);

  useEffect(() => {
    let live = true;
    getTradingUrl().then((u) => {
      if (live) setTradingUrl(u);
    });
    return () => {
      live = false;
    };
  }, []);

  // The detail view gets its own history entry, so Back returns to the list, not out of the sheet.
  const inDetail = selected !== null;
  useEffect(() => {
    if (!inDetail) return;
    let pushed = false;
    // Deferred so StrictMode's mount/cleanup/mount does not push, queue a back(), then push again.
    const t = window.setTimeout(() => {
      history.pushState({ ...(history.state as object | null), watchlistDetail: true }, '');
      pushed = true;
    }, 0);
    const onPop = () => setSelected(null);
    // Escape steps back to the list; capture phase on window runs before the design system's document listener.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setSelected(null);
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey, true);
      if (pushed && (history.state as { watchlistDetail?: boolean } | null)?.watchlistDetail) history.back();
    };
  }, [inDetail]);
  const backToList = () => setSelected(null);

  const trading = tradingUrl.replace(/\/+$/, '');
  const snapshot = selected ? (data?.snapshots.find((s) => s.symbol === selected) ?? null) : null;

  const retry = (
    <Button variant="secondary" onClick={refresh}>
      Try again
    </Button>
  );
  const openTrading = (
    <a href={trading} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: 'primary' })}>
      Open Trading
    </a>
  );

  let body;
  if (snapshot) {
    body = <SymbolDetail snapshot={snapshot} tradingUrl={trading} />;
  } else if (data) {
    body =
      data.snapshots.length === 0 ? (
        <EmptyState
          icon={<ChartCandlestick size={28} aria-hidden="true" />}
          title="Your watchlist is empty"
          detail={
            <a href={trading} target="_blank" rel="noopener noreferrer" className={linkClass()}>
              Add symbols in Trading
            </a>
          }
        />
      ) : (
        <ul>
          {data.snapshots.map((s) => (
            <SymbolRow key={s.symbol} s={s} badges={badges.get(s.symbol)} onSelect={() => setSelected(s.symbol)} />
          ))}
        </ul>
      );
  } else if (error instanceof TradingAuthError) {
    body = (
      <EmptyState
        icon={<Lock size={28} aria-hidden="true" />}
        title="Sign in to Trading"
        detail="The watchlist uses your Trading sign-in."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {openTrading}
            {retry}
          </div>
        }
      />
    );
  } else if (error instanceof TradingUnreachableError) {
    // Trading resolves to a Tailscale address, which Chrome treats as a local network: a public
    // page needs the site's "Local network access" permission before it can reach it.
    body =
      lna === 'denied' ? (
        <EmptyState
          icon={<ShieldAlert size={28} aria-hidden="true" />}
          title="Chrome is blocking Trading"
          detail="Trading is on your tailnet, which Chrome treats as a local network. Allow Local network access for start.nish.software in the site settings (the icon left of the address), then try again."
          action={retry}
        />
      ) : lna === 'prompt' ? (
        <EmptyState
          icon={<ShieldAlert size={28} aria-hidden="true" />}
          title="Allow local network access"
          detail="Chrome asks before this page can reach Trading on your tailnet. Tap Try again and choose Allow."
          action={retry}
        />
      ) : (
        <EmptyState
          icon={<WifiOff size={28} aria-hidden="true" />}
          title="Can't reach Trading"
          detail="Trading is only available on Tailscale. Connect to your tailnet and try again."
          action={retry}
        />
      );
  } else if (error) {
    body = <ErrorState message={error.message} onRetry={refresh} retrying={loading} />;
  } else {
    body = (
      <div className="p-4">
        <SkeletonRows rows={6} height={52} label="Loading watchlist" />
      </div>
    );
  }

  const subtitle = (
    <div className="flex items-center gap-1">
      {selected && (
        <IconButton label="Back to list" size="sm" onClick={backToList}>
          <ArrowLeft size={16} aria-hidden="true" />
        </IconButton>
      )}
      <span className="min-w-0 flex-1 truncate">
        {data ? (
          <>
            Updated <RelativeTime value={data.updatedAt} />
          </>
        ) : loading ? (
          'Loading…'
        ) : (
          'Not connected'
        )}
      </span>
      <IconButton label="Refresh" size="sm" onClick={refresh} disabled={loading}>
        <RefreshCw size={16} aria-hidden="true" className={cn(loading && 'motion-safe:animate-spin')} />
      </IconButton>
      <a
        href={trading}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass({ variant: 'ghost', size: 'sm', className: 'whitespace-nowrap' })}
      >
        Open Trading
        <ExternalLink size={14} aria-hidden="true" />
      </a>
    </div>
  );

  return (
    <Modal title={snapshot ? snapshot.symbol : 'Watchlist'} subtitle={subtitle} size="lg" sheetHeight="tall" onClose={onClose}>
      {body}
    </Modal>
  );
}

/** The watchlist from Trading (prices, day change, and a price chart per symbol), opened from the home page's Watchlist button. */
export function WatchlistSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <WatchlistModal onClose={onClose} /> : null;
}
