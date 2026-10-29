/* global self, fetch, navigator */
/* Start page service worker: web push for the Inbox. No fetch handler and no caching,
   so the page keeps updating on deploy exactly as it does without a worker. */

async function setBadge(open) {
  try {
    if (!('setAppBadge' in navigator)) return;
    if (open > 0) await navigator.setAppBadge(open);
    else await navigator.clearAppBadge();
  } catch {
    // Badging is not supported everywhere (Chrome on Android has no setAppBadge).
  }
}

async function tellWindows() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of windows) client.postMessage({ type: 'inbox-updated' });
}

async function onPush(event) {
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = null;
  }
  if (!payload || payload.v !== 1 || typeof payload.title !== 'string') return;
  const isItem = payload.type === 'item';
  await self.registration.showNotification(payload.title, {
    body: typeof payload.body === 'string' ? payload.body : '',
    tag: payload.tag,
    renotify: isItem,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload,
    requireInteraction: payload.severity === 'urgent',
    actions: isItem
      ? [
          { action: 'handle', title: 'Mark handled' },
          { action: 'snooze', title: 'Snooze 1h' },
        ]
      : [],
  });
  if (typeof payload.open === 'number') await setBadge(payload.open);
  await tellWindows();
}

self.addEventListener('push', (event) => {
  event.waitUntil(onPush(event));
});

/** Focuses a window that already shows this address, else opens it. */
async function openTarget(url) {
  const target = new URL(url, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of windows) {
    if (client.url === target && 'focus' in client) return client.focus();
  }
  return self.clients.openWindow(target);
}

async function refreshBadge() {
  try {
    const res = await fetch('/api/inbox/counts', { credentials: 'same-origin' });
    if (res.ok) await setBadge((await res.json()).open);
  } catch {
    // Offline: leave the badge as it is.
  }
}

/** Runs "handle" or "snooze" on the item. Without a live session (or on any failure) opens the item instead. */
async function runAction(action, id) {
  try {
    const init = { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } };
    if (action === 'snooze') init.body = JSON.stringify({ until: new Date(Date.now() + 3600000).toISOString() });
    const res = await fetch('/api/inbox/items/' + id + '/' + action, init);
    if (!res.ok) return openTarget('/#/inbox?item=' + id);
  } catch {
    return openTarget('/#/inbox?item=' + id);
  }
  await refreshBadge();
  await tellWindows();
}

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const data = notification.data || {};
  notification.close();
  if ((event.action === 'handle' || event.action === 'snooze') && typeof data.id === 'number') {
    event.waitUntil(runAction(event.action, data.id));
    return;
  }
  const url = typeof data.url === 'string' && data.url ? data.url : '/#/inbox';
  event.waitUntil(openTarget(url));
});
