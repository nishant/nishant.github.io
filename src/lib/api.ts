export interface AppConfig {
  googleClientId: string | null;
  tradingUrl: string;
}

const FALLBACK: AppConfig = { googleClientId: null, tradingUrl: 'https://trading.nish.software' };

let cached: Promise<AppConfig> | null = null;

/** The server's public config (cached for the page's life). Any failure resolves the fallback. */
export function getAppConfig(): Promise<AppConfig> {
  cached ??= (async () => {
    try {
      const res = await fetch('/api/config');
      if (!res.ok) return FALLBACK;
      const body = (await res.json()) as Partial<AppConfig>;
      return {
        googleClientId: typeof body.googleClientId === 'string' && body.googleClientId ? body.googleClientId : null,
        tradingUrl: typeof body.tradingUrl === 'string' && body.tradingUrl ? body.tradingUrl : FALLBACK.tradingUrl,
      };
    } catch {
      return FALLBACK;
    }
  })();
  return cached;
}

/** The five sheets opened from the home page. */
export type AppId = 'notes' | 'weather' | 'watchlist' | 'mail' | 'settings';
