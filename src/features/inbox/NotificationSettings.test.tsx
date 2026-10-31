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
let settingsBody: string;
let devicesBody: unknown;
const hint = subscription.endpoint.slice(-12);
const device = (over: Record<string, unknown> = {}) => ({
  id: '0123456789abcdef',
  label: 'Phone',
  endpointHint: hint,
  createdAt: '2026-10-01T10:00:00.000Z',
  lastOkAt: '2026-10-30T10:00:00.000Z',
  lastFailAt: null,
  failCount: 0,
  stale: false,
  ...over,
});

beforeEach(() => {
  calls = [];
  putStatus = 200;
  settingsBody = '{}';
  devicesBody = [];
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
      if (init?.method === 'DELETE' && url.includes('/push/subscriptions/')) return new Response(null, { status: 204 });
      if (url === '/api/inbox/push/subscriptions' && (init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify(devicesBody), { status: 200 });
      return new Response(url.endsWith('/settings') ? settingsBody : '{"ok":true}', { status: 200 });
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
    const post = calls.find((c) => c.url === '/api/inbox/push/subscriptions' && c.method === 'POST')!;
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

  const lastPut = () => puts()[puts().length - 1]!.body as { rules: Record<string, unknown> };

  it('saves a severity rule under rules', async () => {
    renderModal();
    fireEvent.click(await screen.findByRole('button', { name: 'Rules for Trading' }));
    expect(screen.getByRole('button', { name: 'Rules for Trading' }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'urgent' } });

    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(lastPut().rules).toEqual({ trading: { severity: 'urgent', autoHandleHours: null, noReopenHours: null } });
    expect(await screen.findByText('Urgent', { selector: 'p' })).toBeTruthy();
  });

  it('saves hours as numbers and an emptied field as null', async () => {
    settingsBody = JSON.stringify({ rules: { trading: { severity: 'urgent', autoHandleHours: 24, noReopenHours: 6 } } });
    renderModal();
    expect(await screen.findByText('Urgent · auto-handle 24 h · no reopen 6 h')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Rules for Trading' }));
    const auto = screen.getByLabelText('Auto-handle after (hours)') as HTMLInputElement;
    expect(auto.value).toBe('24');
    fireEvent.change(auto, { target: { value: '' } });

    await waitFor(() => expect(puts()).toHaveLength(1), { timeout: 2000 });
    expect(lastPut().rules).toEqual({ trading: { severity: 'urgent', autoHandleHours: null, noReopenHours: 6 } });
  });

  it('shows an error for 999 hours and saves null', async () => {
    renderModal();
    fireEvent.click(await screen.findByRole('button', { name: 'Rules for Trading' }));
    fireEvent.change(screen.getByLabelText("Don't reopen for (hours)"), { target: { value: '999' } });

    expect(await screen.findByText('Use 1 to 720 hours.')).toBeTruthy();
    await waitFor(() => expect(puts()).toHaveLength(1), { timeout: 2000 });
    expect(lastPut().rules).toEqual({});
  });

  it('lists devices, marks this one and flags a stale one', async () => {
    devicesBody = [
      device(),
      device({ id: 'fedcba9876543210', label: 'Computer', endpointHint: 'other-hint-xx', lastOkAt: null, stale: true, failCount: 4 }),
    ];
    renderModal();
    expect(await screen.findByText('Phone (this device)')).toBeTruthy();
    expect(screen.getByText('Computer')).toBeTruthy();
    expect(screen.getByText('No notification delivered yet')).toBeTruthy();
    expect(screen.getByText(/the last 4 tries failed./)).toBeTruthy();
  });

  it('says so when no device gets notifications', async () => {
    renderModal();
    expect(await screen.findByText('No devices get notifications yet.')).toBeTruthy();
  });

  it('removes a device with DELETE and reloads the list', async () => {
    devicesBody = [device({ endpointHint: 'other-hint-xx' })];
    renderModal();
    const remove = await screen.findByRole('button', { name: 'Remove Phone' });
    devicesBody = [];
    fireEvent.click(remove);

    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.url === '/api/inbox/push/subscriptions/0123456789abcdef')).toBe(true),
    );
    expect(await screen.findByText('No devices get notifications yet.')).toBeTruthy();
    expect(screen.getByText('Notifications are on for this device.')).toBeTruthy();
  });

  it('turns this device off in the modal when its own entry is removed', async () => {
    devicesBody = [device()];
    renderModal();
    await screen.findByText('Phone (this device)');
    await waitFor(() => expect(screen.getByText('Notifications are on for this device.')).toBeTruthy());
    devicesBody = [];
    fireEvent.click(screen.getByRole('button', { name: 'Remove Phone' }));

    expect(await screen.findByRole('button', { name: 'Turn on notifications' })).toBeTruthy();
  });
});
