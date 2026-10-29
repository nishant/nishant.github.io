// @vitest-environment jsdom
import { Toaster } from '@nish/ui';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationSettings } from './NotificationSettings';

const subscription = {
  endpoint: 'https://push.example/abc',
  toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }),
};

let calls: Array<{ url: string; method: string; body: unknown }>;
let putStatus: number;

beforeEach(() => {
  calls = [];
  putStatus = 200;
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
      if (init?.method === 'PUT' && putStatus !== 200) return new Response('{"error":"Inbox service is not answering."}', { status: putStatus });
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

  const puts = () => calls.filter((c) => c.url === '/api/inbox/settings' && c.method === 'PUT');

  function renderModal() {
    render(
      <>
        <Toaster />
        <NotificationSettings open onClose={() => undefined} sources={[{ id: 'trading', open: 1 }]} />
      </>,
    );
  }

  it('saves a switch change right away, with no Save button', async () => {
    renderModal();
    const quiet = await screen.findByRole('switch', { name: /Quiet hours/ });
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();

    fireEvent.click(quiet);

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect((puts()[0]!.body as { quietHours: { enabled: boolean } }).quietHours.enabled).toBe(false);
    expect(await screen.findByText('Saved')).toBeTruthy();
  });

  it('saves a typed time once, after the pause', async () => {
    renderModal();
    const from = (await screen.findByLabelText('From')) as HTMLInputElement;
    fireEvent.change(from, { target: { value: '21:00' } });
    fireEvent.change(from, { target: { value: '21:30' } });
    expect(puts()).toHaveLength(0);

    await waitFor(() => expect(puts()).toHaveLength(1), { timeout: 2000 });
    expect((puts()[0]!.body as { quietHours: { start: string } }).quietHours.start).toBe('21:30');
  });

  it('puts the last saved value back when a save fails', async () => {
    putStatus = 503;
    renderModal();
    const quiet = await screen.findByRole('switch', { name: /Quiet hours/ });
    fireEvent.click(quiet);

    expect(await screen.findByText('Inbox service is not answering.')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('switch', { name: /Quiet hours/ }).getAttribute('aria-checked')).toBe('true'));
  });
});
