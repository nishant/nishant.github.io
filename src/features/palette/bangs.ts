import type { Config } from '../../lib/storage';

export interface Bang {
  bang: string;
  name: string;
  /** Search address; `%s` stands for the encoded terms. */
  url: string;
  /** Where a bang with no terms goes. */
  home: string;
}

export const BUILTIN_BANGS: Bang[] = [
  { bang: 'g', name: 'Google', url: 'https://www.google.com/search?q=%s', home: 'https://www.google.com' },
  { bang: 'gh', name: 'GitHub', url: 'https://github.com/search?q=%s', home: 'https://github.com' },
  { bang: 'yt', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s', home: 'https://www.youtube.com' },
  { bang: 'w', name: 'Wikipedia', url: 'https://en.wikipedia.org/w/index.php?search=%s', home: 'https://en.wikipedia.org' },
  { bang: 'a', name: 'Amazon', url: 'https://www.amazon.com/s?k=%s', home: 'https://www.amazon.com' },
  { bang: 'm', name: 'Google Maps', url: 'https://www.google.com/maps/search/%s', home: 'https://www.google.com/maps' },
  { bang: 'i', name: 'Google Images', url: 'https://www.google.com/search?tbm=isch&q=%s', home: 'https://images.google.com' },
  { bang: 'r', name: 'Reddit', url: 'https://www.reddit.com/search/?q=%s', home: 'https://www.reddit.com' },
  { bang: 'so', name: 'Stack Overflow', url: 'https://stackoverflow.com/search?q=%s', home: 'https://stackoverflow.com' },
  { bang: 'mdn', name: 'MDN', url: 'https://developer.mozilla.org/en-US/search?q=%s', home: 'https://developer.mozilla.org' },
  { bang: 'npm', name: 'npm', url: 'https://www.npmjs.com/search?q=%s', home: 'https://www.npmjs.com' },
  { bang: 'hn', name: 'Hacker News', url: 'https://hn.algolia.com/?q=%s', home: 'https://news.ycombinator.com' },
  { bang: 'ddg', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', home: 'https://duckduckgo.com' },
  { bang: 'tr', name: 'Google Translate', url: 'https://translate.google.com/?sl=auto&text=%s', home: 'https://translate.google.com' },
  { bang: 'imdb', name: 'IMDb', url: 'https://www.imdb.com/find/?q=%s', home: 'https://www.imdb.com' },
];

function customBang(raw: unknown): Bang | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r['bang'] !== 'string' || typeof r['name'] !== 'string' || typeof r['url'] !== 'string') return null;
  const bang = r['bang'].trim().toLowerCase();
  const name = r['name'].trim();
  const url = r['url'].trim();
  if (!/^[a-z0-9]{1,15}$/.test(bang)) return null;
  if (name.length < 1 || name.length > 40) return null;
  if (!/^https?:\/\//i.test(url) || !url.includes('%s')) return null;
  let home: string;
  try {
    home = new URL(url.replace('%s', 'x')).origin;
  } catch {
    return null;
  }
  return { bang, name, url, home };
}

/** Custom bangs from config.bangs (valid entries only), then the built-ins they do not override. */
export function allBangs(config: Config): Bang[] {
  const raw = config['bangs'];
  const custom: Bang[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const b = customBang(item);
      if (b && !custom.some((c) => c.bang === b.bang)) custom.push(b);
    }
  }
  return [...custom, ...BUILTIN_BANGS.filter((b) => !custom.some((c) => c.bang === b.bang))];
}

/** "!gh react hooks" or "react hooks !gh" gives { bang, terms: 'react hooks' }; "!gh" gives empty terms.
 *  Not a bang query, or an unknown bang, gives null. */
export function parseBang(query: string, bangs: Bang[]): { bang: Bang; terms: string } | null {
  const q = query.trim();
  const lead = /^!(\S+)(?:\s+(.*))?$/.exec(q);
  const trail = lead ? null : /^(.*\S)\s+!(\S+)$/.exec(q);
  const name = (lead ? lead[1] : trail ? trail[2] : undefined)?.toLowerCase();
  const terms = (lead ? (lead[2] ?? '') : trail ? (trail[1] ?? '') : '').trim();
  if (!name) return null;
  const bang = bangs.find((b) => b.bang === name);
  return bang ? { bang, terms } : null;
}

/** With terms: the search address with the terms encoded; without: the site's home. */
export function bangUrl(b: Bang, terms: string): string {
  return terms ? b.url.replace('%s', () => encodeURIComponent(terms)) : b.home;
}
