import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Inbox,
  Input,
  PageContainer,
  SettingsIcon,
  SkeletonRows,
  buttonClass,
  toast,
  type InboxItem,
  type InboxView,
} from '@nish/ui';
import { dateTime } from '@nish/ui/format';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { inboxApi, type ApiResult, type InboxCounts } from '../features/inbox/api';
import { NotificationSettings } from '../features/inbox/NotificationSettings';
import { useInboxParams } from '../lib/route';

const POLL_MS = 60_000;

/** Calls `fn` on window focus, when the tab becomes visible, every 60 s while visible, and when the
 *  service worker posts `{ type: 'inbox-updated' }`. */
function useInboxRefresh(fn: () => void): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const tick = (): void => {
      if (document.visibilityState === 'visible') ref.current();
    };
    const id = window.setInterval(tick, POLL_MS);
    const onMessage = (e: MessageEvent): void => {
      if ((e.data as { type?: unknown } | null)?.type === 'inbox-updated') ref.current();
    };
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined;
    sw?.addEventListener('message', onMessage);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
      sw?.removeEventListener('message', onMessage);
    };
  }, []);
}

/** The open and urgent counts for the nav tab. `counts` is null until loaded and while logged out or
 *  when the API does not exist (401, 404). Also keeps the app badge in step when the browser has one. */
export function useInboxCounts(): {
  counts: InboxCounts | null;
  refresh: () => Promise<void>;
  setCounts: (c: InboxCounts | null) => void;
} {
  const [counts, setCounts] = useState<InboxCounts | null>(null);
  const noApi = useRef(false);
  const refresh = useCallback(async () => {
    if (noApi.current) return;
    const r = await inboxApi.counts();
    if (r.ok) setCounts({ open: r.data.open, urgent: r.data.urgent });
    else if (r.status === 404) {
      noApi.current = true;
      setCounts(null);
    } else if (r.status === 401) setCounts(null);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useInboxRefresh(() => void refresh());

  const open = counts?.open ?? null;
  useEffect(() => {
    if (open === null) return;
    try {
      if (open > 0 && 'setAppBadge' in navigator) void navigator.setAppBadge(open).catch(() => undefined);
      else if (open === 0 && 'clearAppBadge' in navigator) void navigator.clearAppBadge().catch(() => undefined);
    } catch {
      // The badge is a nicety.
    }
  }, [open]);

  return { counts, refresh, setCounts };
}

type Phase = 'checking' | 'noapi' | 'down' | 'login' | 'ready';
type ViewCounts = { open: number; snoozed: number; handled: number };

function LoginCard({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await inboxApi.login(password);
    setBusy(false);
    if (r.ok) onLoggedIn();
    else setError(r.error);
  };

  return (
    <Card className="mx-auto w-full max-w-sm">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-th-hi">Inbox</h2>
        <Field label="Password" error={error}>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" loading={busy}>
          Open inbox
        </Button>
      </form>
    </Card>
  );
}

/** The Inbox page (#/inbox): login, then the shared Inbox list with optimistic actions. */
export function InboxPage({ onCounts }: { onCounts: (c: InboxCounts | null) => void }) {
  const params = useInboxParams();
  const [phase, setPhase] = useState<Phase>('checking');
  const [view, setView] = useState<InboxView>('open');
  const [source, setSource] = useState<string | null>(params.source);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [counts, setCounts] = useState<ViewCounts>({ open: 0, snoozed: 0, handled: 0 });
  const [sources, setSources] = useState<Array<{ id: string; open: number }>>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [want, setWant] = useState<{ id: number; view: InboxView } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const viewRef = useRef(view);
  viewRef.current = view;
  const seq = useRef(0);
  // Bumped only when the view, source or login state changes, so "Load more" ignores silent refreshes.
  const context = useRef(0);
  // True while a non-silent load's result is still owed to the page, even if a silent load took over.
  const pendingInitial = useRef(false);
  const pending = useRef(new Set<number>());
  const dealtWith = useRef<number | null>(null);
  const onCountsRef = useRef(onCounts);
  onCountsRef.current = onCounts;

  const checkSession = useCallback(async () => {
    setPhase('checking');
    const r = await inboxApi.session();
    if (r.ok) setPhase(r.data.authed ? 'ready' : 'login');
    else if (r.status === 404 || r.status === 0) setPhase('noapi');
    else setPhase('down');
  }, []);
  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const loggedOut = useCallback(() => {
    seq.current++;
    context.current++;
    pendingInitial.current = false;
    setItems([]);
    setLoading(true);
    setPhase('login');
    onCountsRef.current(null);
  }, []);

  const load = useCallback(
    async (silent: boolean) => {
      const mine = ++seq.current;
      if (!silent) {
        pendingInitial.current = true;
        setLoading(true);
        setError(null);
      }
      const loaded = itemsRef.current.length;
      const limit = silent ? Math.min(100, Math.max(50, loaded)) : 50;
      const r = await inboxApi.list({ view, source, limit });
      if (mine !== seq.current) return;
      if (!r.ok) {
        if (r.status === 401) {
          loggedOut();
          return;
        }
        if (!silent || pendingInitial.current) {
          pendingInitial.current = false;
          setError(r.error);
          setItems([]);
          setNextCursor(null);
        }
        setLoading(false);
        return;
      }
      const d = r.data;
      pendingInitial.current = false;
      // With more than 100 rows loaded by "Load more", a refresh only updates the numbers.
      // The same goes when the list grew (a "Load more" page landed) while this request was in flight.
      if (!(silent && (loaded > 100 || itemsRef.current.length > limit))) {
        setItems(d.items.filter((i) => !pending.current.has(i.id)));
        setNextCursor(d.nextCursor);
      }
      setCounts({ open: d.counts.open, snoozed: d.counts.snoozed, handled: d.counts.handled });
      setSources(d.sources);
      onCountsRef.current({ open: d.counts.open, urgent: d.counts.urgent });
      setLoading(false);
    },
    [view, source, loggedOut],
  );
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (phase === 'ready') void load(false);
  }, [phase, load]);
  useInboxRefresh(() => {
    if (phase === 'ready') void loadRef.current(true);
  });

  const switchView = useCallback((next: InboxView) => {
    if (next === viewRef.current) return;
    context.current++;
    setItems([]);
    setNextCursor(null);
    setLoading(true);
    setView(next);
  }, []);
  const switchSource = useCallback((next: string | null) => {
    context.current++;
    setItems([]);
    setNextCursor(null);
    setLoading(true);
    setSource(next);
  }, []);

  // `?source=` in the hash (a link from another app) picks the filter.
  const lastParamSource = useRef(params.source);
  useEffect(() => {
    if (params.source === lastParamSource.current) return;
    lastParamSource.current = params.source;
    if (params.source !== null) switchSource(params.source);
  }, [params.source, switchSource]);

  // `?item=` in the hash: switch to the item's view, then highlight it.
  useEffect(() => {
    const id = params.item;
    if (phase !== 'ready' || id === null || dealtWith.current === id) return;
    dealtWith.current = id;
    void (async () => {
      const r = await inboxApi.item(id);
      if (!r.ok) {
        if (r.status === 401) loggedOut();
        return;
      }
      const target: InboxView = r.data.handledAt ? 'handled' : r.data.snoozedUntil ? 'snoozed' : 'open';
      if (source !== null && source !== r.data.source) switchSource(null);
      switchView(target);
      setWant({ id, view: target });
    })();
  }, [params.item, phase, source, loggedOut, switchSource, switchView]);
  useEffect(() => {
    if (!want || want.view !== view || loading) return;
    if (items.some((i) => i.id === want.id)) setSelectedId(want.id);
    setWant(null);
  }, [want, view, loading, items]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const mine = context.current;
    setLoadingMore(true);
    const r = await inboxApi.list({ view, source, cursor: nextCursor, limit: 50 });
    setLoadingMore(false);
    if (mine !== context.current) return;
    if (!r.ok) {
      if (r.status === 401) loggedOut();
      else toast.error(r.error, { id: 'inbox-more' });
      return;
    }
    setItems((cur) => {
      const seen = new Set(cur.map((i) => i.id));
      return [...cur, ...r.data.items.filter((i) => !seen.has(i.id) && !pending.current.has(i.id))];
    });
    setNextCursor(r.data.nextCursor);
  }, [nextCursor, loadingMore, view, source, loggedOut]);

  const shift = (from: InboxView, to: InboxView, n: number): void => {
    setCounts((c) => ({ ...c, [from]: Math.max(0, c[from] - n), [to]: c[to] + n }));
  };

  /** Removes rows at once, runs the call, and puts the rows back where they were if it fails. */
  const mutate = async <T,>(
    ids: number[],
    to: InboxView,
    call: () => Promise<ApiResult<T>>,
    errorSlot: string,
  ): Promise<ApiResult<T>> => {
    const from = viewRef.current;
    const removed = itemsRef.current.map((item, index) => ({ item, index })).filter((r) => ids.includes(r.item.id));
    for (const id of ids) pending.current.add(id);
    setItems((cur) => cur.filter((i) => !ids.includes(i.id)));
    shift(from, to, removed.length);
    const r = await call();
    for (const id of ids) pending.current.delete(id);
    if (!r.ok) {
      if (viewRef.current === from) {
        shift(to, from, removed.length);
        setItems((cur) => {
          const next = [...cur];
          for (const { item, index } of removed) {
            if (!next.some((i) => i.id === item.id)) next.splice(Math.min(index, next.length), 0, item);
          }
          return next;
        });
      }
      if (r.status === 401) loggedOut();
      else toast.error(r.error, { id: errorSlot });
    }
    void loadRef.current(true);
    return r;
  };

  const undo = async (id: number, call: () => Promise<ApiResult<InboxItem>>): Promise<void> => {
    const r = await call();
    if (!r.ok) {
      if (r.status === 401) loggedOut();
      else toast.error(r.error, { id: `inbox-${id}` });
    }
    void loadRef.current(true);
  };

  const onHandle = async (id: number): Promise<void> => {
    const r = await mutate([id], 'handled', () => inboxApi.handle(id), `inbox-${id}`);
    if (r.ok) {
      toast.success('Marked handled', {
        id: `inbox-${id}`,
        action: { label: 'Undo', onClick: () => void undo(id, () => inboxApi.unhandle(id)) },
      });
    }
  };
  const onSnooze = async (id: number, until: Date): Promise<void> => {
    const r = await mutate([id], 'snoozed', () => inboxApi.snooze(id, until), `inbox-${id}`);
    if (r.ok) {
      toast.success(`Snoozed until ${dateTime(until)}`, {
        id: `inbox-${id}`,
        action: { label: 'Undo', onClick: () => void undo(id, () => inboxApi.unsnooze(id)) },
      });
    }
  };
  const onHandleAll = async (): Promise<void> => {
    const ids = itemsRef.current.map((i) => i.id);
    const r = await mutate(ids, 'handled', () => inboxApi.handleAll(source), 'inbox-all');
    if (r.ok) toast.success(`Marked ${r.data.count} handled`, { id: 'inbox-all' });
  };

  if (phase === 'noapi') {
    return (
      <PageContainer size="wide">
        <EmptyState
          title="Inbox is on start.nish.software"
          action={
            <a href="https://start.nish.software/#/inbox" className={buttonClass({ variant: 'secondary', size: 'sm' })}>
              Open it there
            </a>
          }
        />
      </PageContainer>
    );
  }

  let body;
  if (phase === 'checking') {
    body = (
      <Card padding="none">
        <SkeletonRows rows={6} label="Checking your session" />
      </Card>
    );
  } else if (phase === 'down') {
    body = (
      <div className="flex flex-col items-center gap-3">
        <ErrorState message="Inbox service is not answering" />
        <Button onClick={() => void checkSession()}>Try again</Button>
      </div>
    );
  } else if (phase === 'login') {
    body = (
      <LoginCard
        onLoggedIn={() => {
          setLoading(true);
          setError(null);
          setPhase('ready');
        }}
      />
    );
  } else {
    body = (
      <Inbox
        items={items}
        view={view}
        onViewChange={switchView}
        counts={counts}
        sources={sources}
        source={source}
        onSourceChange={switchSource}
        onHandle={(id) => void onHandle(id)}
        onUnhandle={(id) => void mutate([id], 'open', () => inboxApi.unhandle(id), `inbox-${id}`)}
        onSnooze={(id, until) => void onSnooze(id, until)}
        onUnsnooze={(id) => void mutate([id], 'open', () => inboxApi.unsnooze(id), `inbox-${id}`)}
        onHandleAll={view === 'open' ? () => void onHandleAll() : undefined}
        loading={loading}
        error={error}
        onRetry={() => void load(false)}
        hasMore={nextCursor !== null}
        onLoadMore={() => void loadMore()}
        loadingMore={loadingMore}
        selectedId={selectedId}
      />
    );
  }

  return (
    <PageContainer size="wide">
      {phase !== 'login' ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold text-th-hi">Inbox</h1>
          {phase === 'ready' ? (
            <IconButton label="Notification settings" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon aria-hidden />
            </IconButton>
          ) : null}
        </div>
      ) : null}
      {body}
      {settingsOpen ? (
        <NotificationSettings open onClose={() => setSettingsOpen(false)} sources={sources} />
      ) : null}
    </PageContainer>
  );
}
