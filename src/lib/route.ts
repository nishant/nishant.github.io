import { useEffect, useState } from 'react';

export type Route = 'home' | 'jp' | 'inbox';

/** The path part of a hash: '#/inbox?item=12' → '#/inbox'. */
function pathOf(hash: string): string {
  const q = hash.indexOf('?');
  return q === -1 ? hash : hash.slice(0, q);
}

function routeFromHash(hash: string): Route {
  const path = pathOf(hash);
  if (path === '#/jp') return 'jp';
  if (path === '#/inbox') return 'inbox';
  return 'home';
}

/** The query of an inbox hash: `#/inbox?item=12` → item 12, `#/inbox?source=trading` → source 'trading'.
 *  A missing, non-numeric or non-positive item, or a source that is not a lowercase id, is null. */
export function inboxParams(hash: string): { item: number | null; source: string | null } {
  const q = hash.indexOf('?');
  if (q === -1) return { item: null, source: null };
  const params = new URLSearchParams(hash.slice(q + 1));
  const rawItem = params.get('item');
  const item = rawItem !== null && /^[0-9]{1,15}$/.test(rawItem) && Number(rawItem) > 0 ? Number(rawItem) : null;
  const rawSource = params.get('source');
  const source = rawSource !== null && /^[a-z0-9][a-z0-9-]{0,31}$/.test(rawSource) ? rawSource : null;
  return { item, source };
}

/** '#/jp' → 'jp'; '#/inbox' (with an optional '?item=…&source=…') → 'inbox'; '#/home', '', '#/', anything else → 'home' (and the URL is rewritten to '#/home'). */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash));

  useEffect(() => {
    const sync = (): void => {
      const hash = window.location.hash;
      const path = pathOf(hash);
      if (path !== '#/home' && path !== '#/jp' && path !== '#/inbox') {
        window.history.replaceState(null, '', '#/home');
      }
      setRoute(routeFromHash(hash));
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  return route;
}

/** The current `?item=` and `?source=` of the hash, updated on hashchange. */
export function useInboxParams(): { item: number | null; source: string | null } {
  const [params, setParams] = useState(() => inboxParams(window.location.hash));
  useEffect(() => {
    const sync = (): void => {
      const next = inboxParams(window.location.hash);
      setParams((prev) => (prev.item === next.item && prev.source === next.source ? prev : next));
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  return params;
}
