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

/* ---- Offline shell (start-home). Keep separate from the push code above. ---- */
const SW_VERSION = '__SW_VERSION__';
const SW_PRECACHE = [];
const SHELL = 'start-shell-' + SW_VERSION;
const ASSETS = 'start-assets';
const ICONS = 'start-favicons';
const ENABLED = !SW_VERSION.startsWith('__');
const ASSET_LIMIT = 150;
const ICON_LIMIT = 300;
const SCOPE = new URL(self.registration.scope);
let putCount = 0;
let iconPuts = 0;

function rel(url) {
  const p = url.pathname;
  return p.startsWith(SCOPE.pathname) ? p.slice(SCOPE.pathname.length) : null;
}

function cacheable(response) {
  return response && response.ok && response.type === 'basic' && !response.headers.has('Set-Cookie');
}

async function prune(name, limit) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(key);
}

async function precache() {
  const shell = await caches.open(SHELL);
  const assets = await caches.open(ASSETS);
  const results = await Promise.allSettled(
    SW_PRECACHE.map(async (path) => {
      const isShell = path === './' || path === 'index.html';
      const res = await fetch(new Request(new URL(path, SCOPE), { cache: 'reload' }));
      if (!res.ok) throw new Error(path + ' ' + res.status);
      await (isShell ? shell : assets).put(new URL(path, SCOPE), res);
    }),
  );
  const home = SW_PRECACHE.indexOf('./');
  if (home < 0 || results[home].status === 'rejected') throw new Error('shell not cached');
}

async function cleanup() {
  for (const name of await caches.keys()) {
    if (name.startsWith('start-shell-') && name !== SHELL) await caches.delete(name);
  }
  await prune(ASSETS, ASSET_LIMIT);
  await prune(ICONS, ICON_LIMIT);
}

self.addEventListener('install', (event) => {
  if (ENABLED) event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  if (ENABLED) event.waitUntil(cleanup().then(() => self.clients.claim()));
});

async function navigate(request, shellPage) {
  try {
    const res = await fetch(request);
    if (shellPage && cacheable(res) && (res.headers.get('Content-Type') || '').includes('text/html')) {
      const cache = await caches.open(SHELL);
      await cache.put(new URL('./', SCOPE), res.clone());
    }
    return res;
  } catch {
    return (await caches.match(new URL('./', SCOPE), { cacheName: SHELL })) || Response.error();
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (cacheable(res)) {
    await cache.put(request, res.clone());
    putCount += 1;
    if (putCount % 20 === 0) await prune(ASSETS, ASSET_LIMIT);
  }
  return res;
}

async function favicon(request, event) {
  const cache = await caches.open(ICONS);
  const hit = await cache.match(request);
  const refresh = fetch(request).then(async (res) => {
    if (cacheable(res)) {
      await cache.put(request, res.clone());
      iconPuts += 1;
      if (iconPuts % 20 === 0) await prune(ICONS, ICON_LIMIT);
    }
    return res;
  });
  if (hit) {
    const quiet = refresh.catch(() => {});
    event.waitUntil(quiet);
    return hit;
  }
  return refresh;
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    if (cacheable(res)) (await caches.open(ASSETS)).put(request, res.clone());
    return res;
  } catch {
    return (await caches.match(request)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!ENABLED || request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const path = rel(url);
  if (request.mode === 'navigate') {
    if (path === null || path.startsWith('api/') || path === 'health') return;
    event.respondWith(navigate(request, path === '' || path === 'index.html'));
  } else if (path === null) {
    return;
  } else if (path.startsWith('assets/')) {
    event.respondWith(cacheFirstAsset(request));
  } else if (path.startsWith('api/favicon')) {
    event.respondWith(favicon(request, event));
  } else if (path.startsWith('api/')) {
    return;
  } else {
    event.respondWith(networkFirst(request));
  }
});
