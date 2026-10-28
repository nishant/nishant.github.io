import { KEYS } from '../../lib/storage';

/** How long a cached Google access token is trusted (Google issues 60 minutes; we stop a little early). */
export const TOKEN_TTL_MS = 55 * 60_000;

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const PAGE_SIZE = 25;
const MAX_IN_FLIGHT = 6;

export interface CachedToken {
  accessToken: string;
  timestamp: number;
}

export interface MailMessage {
  id: string;
  /** Display name, or the address when there is no name. */
  from: string;
  subject: string;
  snippet: string;
  /** Epoch milliseconds (Gmail's internalDate). */
  date: number;
  unread: boolean;
}

export interface InboxPage {
  messages: MailMessage[];
  nextPageToken?: string;
}

/** The token was rejected (HTTP 401) or the user cancelled sign-in. */
export class AuthError extends Error {
  constructor(message = 'Gmail session expired') {
    super(message);
    this.name = 'AuthError';
  }
}

// ---------------------------------------------------------------------------
// Token cache (localStorage, old key, old format)
// ---------------------------------------------------------------------------

/** True while `now` is before the token's timestamp plus 55 minutes. */
export function isTokenValid(t: CachedToken | null | undefined, now: number = Date.now()): boolean {
  if (!t || typeof t.accessToken !== 'string' || !t.accessToken) return false;
  if (typeof t.timestamp !== 'number' || !Number.isFinite(t.timestamp)) return false;
  return now < t.timestamp + TOKEN_TTL_MS;
}

/** The cached token (valid or not), or null when missing or unreadable. */
export function readCachedToken(): CachedToken | null {
  try {
    const raw = localStorage.getItem(KEYS.googleToken);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<CachedToken> | null;
    if (!v || typeof v.accessToken !== 'string' || typeof v.timestamp !== 'number') return null;
    return { accessToken: v.accessToken, timestamp: v.timestamp };
  } catch {
    return null;
  }
}

/** The access token to use right now, or null when absent or expired. */
export function getValidToken(now: number = Date.now()): string | null {
  const t = readCachedToken();
  return t && isTokenValid(t, now) ? t.accessToken : null;
}

export function writeCachedToken(accessToken: string, now: number = Date.now()): void {
  try {
    localStorage.setItem(KEYS.googleToken, JSON.stringify({ accessToken, timestamp: now }));
  } catch {
    // Storage blocked: the token still works for this session.
  }
}

export function clearCachedToken(): void {
  try {
    localStorage.removeItem(KEYS.googleToken);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Google Identity Services
// ---------------------------------------------------------------------------

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}
interface TokenClient {
  requestAccessToken: (o?: { prompt?: string }) => void;
}
interface GoogleOAuth2 {
  initTokenClient: (c: {
    client_id: string;
    scope: string;
    callback: (r: TokenResponse) => void;
    error_callback?: (e: { type?: string; message?: string }) => void;
  }) => TokenClient;
  revoke: (token: string, done?: () => void) => void;
}

function oauth2(): GoogleOAuth2 | undefined {
  return (window as unknown as { google?: { accounts?: { oauth2?: GoogleOAuth2 } } }).google?.accounts?.oauth2;
}

const GIS_FAILED = "Couldn't load Google sign-in. Check your connection and try again.";
let gisPromise: Promise<void> | null = null;

/** Injects the Google Identity Services script once. */
export function loadGis(): Promise<void> {
  if (oauth2()) return Promise.resolve();
  gisPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      s.remove();
      gisPromise = null;
      reject(new Error(GIS_FAILED));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}

/**
 * Asks Google for a read-only Gmail access token and caches it. `prompt` '' reuses an existing
 * grant silently when it can; 'consent' always shows the consent screen.
 */
export async function requestToken(clientId: string, prompt: '' | 'consent'): Promise<string> {
  await loadGis();
  const api = oauth2();
  if (!api) throw new Error(GIS_FAILED);
  return new Promise<string>((resolve, reject) => {
    const client = api.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => {
        if (r.access_token) {
          writeCachedToken(r.access_token);
          resolve(r.access_token);
        } else {
          reject(new AuthError(r.error_description || r.error || 'Sign-in was cancelled'));
        }
      },
      error_callback: (e) => reject(new AuthError(e.message || e.type || 'Sign-in was cancelled')),
    });
    client.requestAccessToken({ prompt });
  });
}

/** Clears the cache and revokes the token with Google. */
export async function revokeToken(token: string): Promise<void> {
  clearCachedToken();
  await loadGis().catch(() => undefined);
  const api = oauth2();
  if (!api) return;
  await new Promise<void>((resolve) => api.revoke(token, () => resolve()));
}

// ---------------------------------------------------------------------------
// Message mapping
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  copy: '©',
  reg: '®',
  trade: '™',
};

/** Decodes the HTML entities Gmail leaves in snippets (&#39; &amp; &quot; and numeric forms). */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return m;
      try {
        return String.fromCodePoint(code);
      } catch {
        return m;
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}

/** `"Name" <a@b.c>` becomes `Name`; `a@b.c` or `<a@b.c>` becomes `a@b.c`; empty stays ''. */
export function parseFrom(header: string | undefined | null): string {
  const raw = (header ?? '').trim();
  if (!raw) return '';
  const angle = raw.match(/^(.*?)\s*<([^>]*)>\s*$/);
  if (angle) {
    const name = (angle[1] ?? '')
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .replace(/\\(.)/g, '$1')
      .trim();
    return name || (angle[2] ?? '').trim();
  }
  return raw.replace(/^"(.*)"$/, '$1').trim();
}

export interface RawMessage {
  id: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: { headers?: { name: string; value: string }[] };
}

/** Maps a Gmail `format=metadata` message to the sheet's row shape. */
export function mapMessage(m: RawMessage): MailMessage {
  const headers = m.payload?.headers ?? [];
  const h = (name: string) => headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value;
  const subject = decodeEntities((h('Subject') ?? '').trim());
  const internal = Number(m.internalDate);
  const headerDate = Date.parse(h('Date') ?? '');
  return {
    id: m.id,
    from: decodeEntities(parseFrom(h('From'))) || 'Unknown sender',
    subject: subject || '(no subject)',
    snippet: decodeEntities(m.snippet ?? ''),
    date: Number.isFinite(internal) && internal > 0 ? internal : Number.isFinite(headerDate) ? headerDate : 0,
    unread: (m.labelIds ?? []).includes('UNREAD'),
  };
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

async function gmailGet<T>(url: string, token: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new Error("Couldn't reach Gmail. Check your connection and try again.");
  }
  if (res.status === 401) throw new AuthError();
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body.error?.message ?? '';
    } catch {
      // not JSON
    }
    throw new Error(detail || `Gmail answered ${res.status}`);
  }
  return (await res.json()) as T;
}

/** Runs `fn` over `items` with at most `limit` in flight, keeping order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i] as T);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** One page of the inbox (25 messages, newest first). A 401 throws AuthError. */
export async function listInbox(token: string, pageToken?: string): Promise<InboxPage> {
  const q = new URLSearchParams({ labelIds: 'INBOX', maxResults: String(PAGE_SIZE) });
  if (pageToken) q.set('pageToken', pageToken);
  const list = await gmailGet<{ messages?: { id: string }[]; nextPageToken?: string }>(`${API}?${q}`, token);
  const ids = (list.messages ?? []).map((m) => m.id);
  const meta = new URLSearchParams([
    ['format', 'metadata'],
    ['metadataHeaders', 'From'],
    ['metadataHeaders', 'Subject'],
    ['metadataHeaders', 'Date'],
  ]);
  const messages = await mapLimit(ids, MAX_IN_FLIGHT, async (id) =>
    mapMessage(await gmailGet<RawMessage>(`${API}/${encodeURIComponent(id)}?${meta}`, token)),
  );
  return { messages, nextPageToken: list.nextPageToken };
}
