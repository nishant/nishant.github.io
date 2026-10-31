import { useCallback, useEffect, useRef, useState } from 'react';
import { inboxApi, type InboxCounts } from './api';
import { useLatest } from '../../lib/useLatest';
import { inboxLive, subscribeInboxChanges } from './live';

const POLL_MS = 60_000;

/** Calls `fn` on window focus, when the tab becomes visible, every 60 s while visible (skipped while the
 *  live stream is open), when the stream reports a change, and when the service worker posts
 *  `{ type: 'inbox-updated' }`. */
export function useInboxRefresh(fn: () => void): void {
  const ref = useLatest(fn);
  useEffect(() => {
    const tick = (): void => {
      if (document.visibilityState === 'visible') ref.current();
    };
    const id = window.setInterval(() => {
      if (!inboxLive()) tick();
    }, POLL_MS);
    const unsubscribe = subscribeInboxChanges(() => ref.current());
    const onMessage = (e: MessageEvent): void => {
      if ((e.data as { type?: unknown } | null)?.type === 'inbox-updated') ref.current();
    };
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    const sw = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined;
    sw?.addEventListener('message', onMessage);
    return () => {
      window.clearInterval(id);
      unsubscribe();
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
      sw?.removeEventListener('message', onMessage);
    };
  }, [ref]);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the counts once on mount
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
