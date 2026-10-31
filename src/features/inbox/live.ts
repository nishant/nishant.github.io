const STREAM_URL = '/api/inbox/events';
const DEBOUNCE_MS = 300;
const CLOSED = 2;

const subscribers = new Set<() => void>();
let source: EventSource | null = null;
let live = false;
let timer: number | undefined;

function fire(): void {
  timer = undefined;
  for (const fn of [...subscribers]) fn();
}

function onChanged(): void {
  if (timer !== undefined) window.clearTimeout(timer);
  timer = window.setTimeout(fire, DEBOUNCE_MS);
}

function open(): void {
  if (source || typeof EventSource === 'undefined') return;
  const es = new EventSource(STREAM_URL);
  source = es;
  es.onopen = () => {
    if (source === es) live = true;
  };
  es.addEventListener('changed', onChanged);
  es.onerror = () => {
    if (source !== es) return;
    live = false;
    // A stream the browser gave up on (a 401 answer) never retries; drop it so a login can open a new one.
    if (es.readyState === CLOSED) {
      es.close();
      source = null;
    }
  };
}

function close(): void {
  if (timer !== undefined) {
    window.clearTimeout(timer);
    timer = undefined;
  }
  live = false;
  source?.close();
  source = null;
}

/** Calls fn (debounced 300 ms) whenever the inbox changes. Returns unsubscribe. Opens the stream on the first subscriber, closes it on the last. */
export function subscribeInboxChanges(fn: () => void): () => void {
  const wrapped = (): void => fn();
  subscribers.add(wrapped);
  open();
  return () => {
    subscribers.delete(wrapped);
    if (subscribers.size === 0) close();
  };
}

/** True while the stream is open. */
export function inboxLive(): boolean {
  return live;
}

/** Re-open after a login (a 401 closes the stream for good). */
export function reconnectInbox(): void {
  if (subscribers.size === 0) return;
  close();
  open();
}

/** Close it (logout). */
export function closeInbox(): void {
  close();
}
