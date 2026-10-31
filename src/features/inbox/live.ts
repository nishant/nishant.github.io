const STREAM_URL = '/api/inbox/events';
const DEBOUNCE_MS = 300;
const CLOSED = 2;
const RETRY_MS = [30_000, 60_000, 120_000];

const subscribers = new Set<() => void>();
let source: EventSource | null = null;
let live = false;
let timer: number | undefined;
let retryTimer: number | undefined;
let retryCount = 0;
let loggedOut = false;

function fire(): void {
  timer = undefined;
  for (const fn of [...subscribers]) fn();
}

function onChanged(): void {
  if (timer !== undefined) window.clearTimeout(timer);
  timer = window.setTimeout(fire, DEBOUNCE_MS);
}

function clearRetry(): void {
  if (retryTimer !== undefined) {
    window.clearTimeout(retryTimer);
    retryTimer = undefined;
  }
}

function scheduleRetry(): void {
  if (retryTimer !== undefined || subscribers.size === 0 || loggedOut) return;
  const delay = RETRY_MS[Math.min(retryCount, RETRY_MS.length - 1)];
  retryCount += 1;
  retryTimer = window.setTimeout(() => {
    retryTimer = undefined;
    open();
  }, delay);
}

function open(): void {
  if (source || loggedOut || typeof EventSource === 'undefined') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const es = new EventSource(STREAM_URL);
  source = es;
  es.onopen = () => {
    if (source !== es) return;
    live = true;
    retryCount = 0;
  };
  es.addEventListener('changed', onChanged);
  es.onerror = () => {
    if (source !== es) return;
    live = false;
    // A stream the browser gave up on (a 401 answer) never retries; drop it so a login can open a new one.
    if (es.readyState === CLOSED) {
      es.close();
      source = null;
      // Closed for good (503 when the service is full, or a 401): retry with backoff; a login also reopens it.
      scheduleRetry();
    }
  };
}

function close(): void {
  clearRetry();
  retryCount = 0;
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timer = undefined;
  }
  live = false;
  source?.close();
  source = null;
}

// Background tabs close the stream so they do not hold one of the service's stream slots.
function onVisibility(): void {
  if (subscribers.size === 0) return;
  if (document.visibilityState === 'hidden') {
    clearRetry();
    live = false;
    source?.close();
    source = null;
  } else if (!source && !loggedOut) {
    retryCount = 0;
    open();
    onChanged(); // refresh what was missed while hidden
  }
}

/** Calls fn (debounced 300 ms) whenever the inbox changes. Returns unsubscribe. Opens the stream on the first subscriber, closes it on the last. */
export function subscribeInboxChanges(fn: () => void): () => void {
  const wrapped = (): void => fn();
  subscribers.add(wrapped);
  if (subscribers.size === 1 && typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
  open();
  return () => {
    subscribers.delete(wrapped);
    if (subscribers.size === 0) {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      close();
    }
  };
}

/** True while the stream is open. */
export function inboxLive(): boolean {
  return live;
}

/** Re-open after a login (a 401 closes the stream for good). */
export function reconnectInbox(): void {
  loggedOut = false;
  if (subscribers.size === 0) return;
  close();
  open();
}

/** Close it (logout). */
export function closeInbox(): void {
  loggedOut = true;
  close();
}
