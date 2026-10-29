// @vitest-environment jsdom
import { Toaster } from '@nish/ui';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationSettings } from './NotificationSettings';

const subscription = {
  endpoint: 'https://push.example/abc',
  toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }),
};

let calls: Array<{ url: string; method: string; body: unknown }>;

beforeEach(() => {
  calls = [];
  const registration = { pushManager: { getSubscription: async () => subscription } };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: async () => registration, ready: Promise.resolve(registration) },
  });
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', { permission: 'granted' });
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)' }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(url.endsWith('/settings') ? '{}' : '{"ok":true}', { status: 200 });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('NotificationSettings', () => {
  it('silently re-registers an existing browser subscription when it opens', async () => {
    render(
      <>
        <Toaster />
        <NotificationSettings open onClose={() => undefined} sources={[]} />
      </>,
    );

    await waitFor(() => expect(screen.getByText('Notifications are on for this device.')).toBeTruthy());
    await waitFor(() =>
      expect(calls.find((c) => c.url === '/api/inbox/push/subscriptions' && c.method === 'POST')).toBeTruthy(),
    );
    const post = calls.find((c) => c.url === '/api/inbox/push/subscriptions')!;
    expect(post.body).toEqual({ subscription: subscription.toJSON(), label: 'Phone' });
  });
});
