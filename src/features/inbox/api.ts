import type { InboxItem, InboxListResponse, InboxSettings, InboxView } from '@nish/ui';

/** Every call returns this: the data, or the HTTP status and the text to show. `status` is 0 when
 *  the request never reached a server (offline) or the answer was not JSON. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

const BASE = '/api/inbox';

/** Text to show for a status when the server sent none. */
function fallbackError(status: number): string {
  switch (status) {
    case 401:
      return 'Log in to see this.';
    case 404:
      return 'Inbox is not available here.';
    case 503:
      return 'Inbox service is not answering.';
    default:
      return 'Something went wrong. Try again.';
  }
}

/** One call to `/api/inbox<path>`. A 204 resolves `data: undefined`. Status mapping: 401 logged out,
 *  404 no API on this host, 503 service down, 0 network failure or a non-JSON answer. Never throws. */
export async function inboxRequest<T>(path: string, init?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: init?.method ?? 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, error: 'Could not reach the server.' };
  }
  if (res.status === 204) return { ok: true, data: undefined as T };
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    if (res.ok) return { ok: false, status: 0, error: 'Unexpected answer from the server.' };
    return { ok: false, status: res.status, error: fallbackError(res.status) };
  }
  if (!res.ok) {
    const text =
      body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : fallbackError(res.status);
    return { ok: false, status: res.status, error: text };
  }
  return { ok: true, data: body as T };
}

export interface InboxCounts {
  open: number;
  urgent: number;
}

export interface ListParams {
  view: InboxView;
  source?: string | null;
  cursor?: string | null;
  limit?: number;
}

export const inboxApi = {
  session: () => inboxRequest<{ authed: boolean }>('/session'),
  login: (password: string) => inboxRequest<void>('/login', { method: 'POST', body: { password } }),
  logout: () => inboxRequest<void>('/logout', { method: 'POST', body: {} }),
  counts: () => inboxRequest<InboxCounts>('/counts'),
  list: ({ view, source, cursor, limit }: ListParams) => {
    const q = new URLSearchParams({ view });
    if (source) q.set('source', source);
    if (cursor) q.set('cursor', cursor);
    if (limit) q.set('limit', String(limit));
    return inboxRequest<InboxListResponse>(`/items?${q.toString()}`);
  },
  item: (id: number) => inboxRequest<InboxItem>(`/items/${id}`),
  handle: (id: number) => inboxRequest<InboxItem>(`/items/${id}/handle`, { method: 'POST', body: {} }),
  unhandle: (id: number) => inboxRequest<InboxItem>(`/items/${id}/unhandle`, { method: 'POST', body: {} }),
  snooze: (id: number, until: Date) =>
    inboxRequest<InboxItem>(`/items/${id}/snooze`, { method: 'POST', body: { until: until.toISOString() } }),
  unsnooze: (id: number) => inboxRequest<InboxItem>(`/items/${id}/unsnooze`, { method: 'POST', body: {} }),
  handleAll: (source?: string | null) =>
    inboxRequest<{ count: number }>('/items/handle-all', { method: 'POST', body: source ? { source } : {} }),
  getSettings: () => inboxRequest<InboxSettings>('/settings'),
  putSettings: (settings: InboxSettings) => inboxRequest<InboxSettings>('/settings', { method: 'PUT', body: settings }),
};
