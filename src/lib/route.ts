import { useEffect, useState } from 'react';

export type Route = 'home' | 'jp';

function routeFromHash(hash: string): Route {
  return hash === '#/jp' ? 'jp' : 'home';
}

/** '#/jp' → 'jp'; '#/home', '', '#/', anything else → 'home' (and the URL is rewritten to '#/home'). */
export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash));

  useEffect(() => {
    const sync = (): void => {
      const hash = window.location.hash;
      if (hash !== '#/home' && hash !== '#/jp') {
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
