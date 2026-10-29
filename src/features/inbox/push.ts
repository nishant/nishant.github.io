/** Web push for the Inbox: browser support check, subscribe and unsubscribe. */

/** Hosts where the service worker is registered and push is offered. */
const PUSH_HOSTS = ['start.nish.software', 'localhost', '127.0.0.1'];

export type PushSupport = 'unsupported' | 'wrong-host' | 'denied' | 'ok';
export type PushResult = { ok: true } | { ok: false; error: string };

/** True on the hosts that run the service worker. */
export function isPushHost(hostname: string = location.hostname): boolean {
  return PUSH_HOSTS.includes(hostname);
}

/** Whether this browser, host and permission state allow turning push on. */
export function pushSupport(): PushSupport {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'unsupported';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  if (!isPushHost()) return 'wrong-host';
  if (Notification.permission === 'denied') return 'denied';
  return 'ok';
}

/** Decodes a base64url VAPID public key into the bytes `subscribe` wants. */
export function urlBase64ToUint8Array(key: string): Uint8Array {
  const padded = key + '='.repeat((4 - (key.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** The service worker registration, or null when it is not registered or not ready in time. */
async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registered = await navigator.serviceWorker.getRegistration();
  if (!registered) return null;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

/** This browser's push subscription, or null when there is none. Never throws. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  try {
    const registration = await readyRegistration();
    return registration ? await registration.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}

async function errorText(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error) return body.error;
  } catch {
    // Not JSON: use the fallback.
  }
  return fallback;
}

/** Posts this browser's subscription to the inbox service (an upsert on the server). */
export async function registerSubscription(sub: PushSubscription): Promise<PushResult> {
  const label = window.matchMedia('(pointer: coarse)').matches ? 'Phone' : 'Computer';
  const res = await fetch('/api/inbox/push/subscriptions', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), label }),
  });
  if (!res.ok) return { ok: false, error: await errorText(res, 'Could not turn on notifications.') };
  return { ok: true };
}

/** Asks for permission, subscribes this browser and registers it with the inbox service. */
export async function turnOn(): Promise<PushResult> {
  try {
    const support = pushSupport();
    if (support === 'unsupported' || support === 'wrong-host') {
      return { ok: false, error: "This browser can't get push notifications." };
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, error: 'Notifications were not allowed.' };

    const registration = await readyRegistration();
    if (!registration) return { ok: false, error: 'Notifications are not ready yet. Reload the page and try again.' };

    const keyRes = await fetch('/api/inbox/push/key', { credentials: 'same-origin' });
    if (!keyRes.ok) return { ok: false, error: await errorText(keyRes, 'Could not get the notification key.') };
    const { publicKey } = (await keyRes.json()) as { publicKey: string };

    // An existing browser subscription is reused, so turning on again re-posts it to the server.
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }));

    return await registerSubscription(subscription);
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'Could not turn on notifications.' };
  }
}

/** Unsubscribes this browser and removes it from the inbox service. */
export async function turnOff(): Promise<PushResult> {
  try {
    const subscription = await currentSubscription();
    if (!subscription) return { ok: true };
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    const res = await fetch('/api/inbox/push/subscriptions', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
    if (!res.ok && res.status !== 404) {
      return { ok: false, error: await errorText(res, 'Could not turn off notifications.') };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : 'Could not turn off notifications.' };
  }
}
