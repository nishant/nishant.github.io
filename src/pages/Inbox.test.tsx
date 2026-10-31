import { Toaster } from '@nish/ui';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InboxPage } from './Inbox';

vi.mock('../features/inbox/NotificationSettings', () => ({
  NotificationSettings: () => <div>settings modal</div>,
}));

const NOW = '2026-10-29T12:00:00.000Z';

function item(id: number, over: Record<string, unknown> = {}) {
  return {
    id,
    source: 'trackers',
    kind: 'price-drop',
    title: `Item ${id}`,
    body: null,
    url: null,
    severity: 'normal',
    count: 1,
    createdAt: NOW,
    updatedAt: NOW,
    occurredAt: NOW,
    handledAt: null as string | null,
    handledBy: null as string | null,
    snoozedUntil: null,
    data: null,
    ...over,
  };
}

interface Server {
  authed: boolean;
  open: ReturnType<typeof item>[];
  handled: ReturnType<typeof item>[];
  calls: string[];
  failHandle: boolean;
  /** The action route's answer: the target succeeded, failed, or the route errored. */
  action: 'ok' | 'fail' | 409;
  sessionStatus: number;
  devices: Array<Record<string, unknown>>;
  bodies: Record<string, unknown>;
}

function json(status: number, body?: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body ?? {}), { status });
}

function install(server: Server): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const path = String(input).replace('/api/inbox', '');
      server.calls.push(`${method} ${path}`);
      if (path === '/session') {
        if (server.sessionStatus !== 200) return json(server.sessionStatus, { error: 'nope' });
        return json(200, { authed: server.authed });
      }
      if (path === '/login') {
        const { password } = JSON.parse(init?.body as string) as { password: string };
        if (password !== 'test-password') return json(401, { error: 'Wrong password.' });
        server.authed = true;
        return json(204);
      }
      if (path === '/logout') {
        server.authed = false;
        return json(204);
      }
      if (!server.authed) return json(401, { error: 'Log in to see this.' });
      if (path === '/push/subscriptions') return json(200, server.devices);
      if (path === '/items/handle-all') {
        server.bodies[path] = JSON.parse(init?.body as string);
        const count = server.open.length;
        server.handled = [...server.open, ...server.handled];
        server.open = [];
        return json(200, { count });
      }
      if (path.startsWith('/items?')) {
        const view = new URL(`http://x${path}`).searchParams.get('view');
        const items = view === 'handled' ? server.handled : view === 'open' ? server.open : [];
        return json(200, {
          items,
          nextCursor: null,
          counts: { open: server.open.length, snoozed: 0, handled: server.handled.length, urgent: 0 },
          sources: [{ id: 'trackers', open: server.open.length }],
        });
      }
      const a = /^\/items\/(\d+)\/actions\/([a-z0-9-]+)$/.exec(path);
      if (a && method === 'POST') {
        const id = Number(a[1]);
        if (server.action === 409) return json(409, { error: 'That action is still running.' });
        const found = server.open.find((i) => i.id === id)!;
        const ok = server.action === 'ok';
        const lastAction = { actionId: a[2], ok, status: ok ? 200 : 500, error: ok ? null : 'The app answered 500.', at: NOW };
        if (!ok) {
          const updated = { ...found, lastAction };
          server.open = server.open.map((i) => (i.id === id ? updated : i));
          return json(200, updated);
        }
        const updated = { ...found, lastAction, handledAt: NOW, handledBy: 'user' };
        server.open = server.open.filter((i) => i.id !== id);
        server.handled = [updated, ...server.handled];
        return json(200, updated);
      }
      const m = /^\/items\/(\d+)\/(handle|unhandle)$/.exec(path);
      if (m) {
        const id = Number(m[1]);
        if (m[2] === 'handle') {
          if (server.failHandle) return json(500, { error: 'Disk is full.' });
          const found = server.open.find((i) => i.id === id)!;
          server.open = server.open.filter((i) => i.id !== id);
          server.handled = [found, ...server.handled];
          return json(200, found);
        }
        const found = server.handled.find((i) => i.id === id)!;
        server.handled = server.handled.filter((i) => i.id !== id);
        server.open = [found, ...server.open].sort((a, b) => a.id - b.id);
        return json(200, found);
      }
      return json(404, { error: 'Not found.' });
    }),
  );
}

let server: Server;
const onCounts = vi.fn();

function mount() {
  return render(
    <>
      <InboxPage onCounts={onCounts} />
      <Toaster />
    </>,
  );
}

beforeEach(() => {
  // A wide viewport, so the rows show their inline "Mark handled" button.
  window.matchMedia = ((query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  window.location.hash = '#/inbox';
  onCounts.mockClear();
  server = {
    authed: false,
    open: [item(1), item(2), item(3)],
    handled: [],
    calls: [],
    failHandle: false,
    action: 'ok',
    sessionStatus: 200,
    devices: [],
    bodies: {},
  };
  install(server);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = '';
});

describe('Inbox page', () => {
  it('login, list, handle, undo', async () => {
    mount();
    const password = await screen.findByLabelText('Password');

    fireEvent.change(password, { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open inbox' }));
    expect(await screen.findByText('Wrong password.')).toBeTruthy();

    fireEvent.change(password, { target: { value: 'test-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open inbox' }));

    expect(await screen.findByText('Item 1')).toBeTruthy();
    expect(screen.getByText('Item 3')).toBeTruthy();
    expect(onCounts).toHaveBeenLastCalledWith({ open: 3, urgent: 0 });

    const handleButtons = screen.getAllByRole('button', { name: 'Mark handled' });
    fireEvent.click(handleButtons[0]!);

    await waitFor(() => expect(screen.queryByText('Item 1')).toBeNull());
    expect(await screen.findByText('Marked handled')).toBeTruthy();
    expect(server.calls).toContain('POST /items/1/handle');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(server.calls).toContain('POST /items/1/unhandle'));
    expect(await screen.findByText('Item 1')).toBeTruthy();
  });

  it('puts the row back and shows the server error when handle fails', async () => {
    server.authed = true;
    server.failHandle = true;
    mount();
    await screen.findByText('Item 2');
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark handled' })[1]!);
    expect(await screen.findByText('Disk is full.')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Item 2')).toBeTruthy());
    const titles = screen.getAllByText(/^Item \d$/).map((n) => n.textContent);
    expect(titles).toEqual(['Item 1', 'Item 2', 'Item 3']);
  });

  describe('actions', () => {
    const restart = { id: 'restart', label: 'Restart task', method: 'POST', target: 'http://127.0.0.1:8810/restart' };
    beforeEach(() => {
      server.authed = true;
      server.open = [item(1), item(2, { actions: [restart], lastAction: null }), item(3)];
    });

    it('runs an action and drops the item once the target succeeded', async () => {
      mount();
      fireEvent.click(await screen.findByRole('button', { name: 'Restart task' }));
      await waitFor(() => expect(screen.queryByText('Item 2')).toBeNull());
      expect(server.calls).toContain('POST /items/2/actions/restart');
      expect(await screen.findByText('Restart task: done')).toBeTruthy();
    });

    it('keeps the item and shows the error when the target failed', async () => {
      server.action = 'fail';
      mount();
      fireEvent.click(await screen.findByRole('button', { name: 'Restart task' }));
      expect(await screen.findByText('Restart task failed: The app answered 500.')).toBeTruthy();
      expect(screen.getByText('Item 2')).toBeTruthy();
    });

    it('shows the route error (409 double tap) and keeps the item', async () => {
      server.action = 409;
      mount();
      fireEvent.click(await screen.findByRole('button', { name: 'Restart task' }));
      expect(await screen.findByText('That action is still running.')).toBeTruthy();
      expect(screen.getByText('Item 2')).toBeTruthy();
    });
  });

  it('shows the login card when the session ends (401 on a later call)', async () => {
    server.authed = true;
    mount();
    await screen.findByText('Item 1');
    server.authed = false;
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark handled' })[0]!);
    expect(await screen.findByLabelText('Password')).toBeTruthy();
    expect(onCounts).toHaveBeenLastCalledWith(null);
  });

  it('says the inbox lives on start.nish.software when there is no API (404)', async () => {
    server.sessionStatus = 404;
    mount();
    expect(await screen.findByText('Inbox is on start.nish.software')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Open it there' });
    expect(link.getAttribute('href')).toBe('https://start.nish.software/#/inbox');
  });

  it('shows an error state with Try again when the service is down (503)', async () => {
    server.sessionStatus = 503;
    mount();
    expect(await screen.findByText('Inbox service is not answering')).toBeTruthy();
    server.sessionStatus = 200;
    server.authed = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Item 1')).toBeTruthy();
  });

  it('sends before = the newest loaded updatedAt with Mark all handled', async () => {
    server.authed = true;
    server.open = [
      item(1, { updatedAt: '2026-10-29T10:00:00.000Z' }),
      item(2, { updatedAt: '2026-10-29T12:30:00.000Z' }),
      item(3, { updatedAt: '2026-10-29T11:00:00.000Z' }),
    ];
    mount();
    await screen.findByText('Item 1');
    fireEvent.click(screen.getByRole('button', { name: 'Mark all handled' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark handled' }));
    await waitFor(() => expect(server.calls).toContain('POST /items/handle-all'));
    expect(server.bodies['/items/handle-all']).toEqual({ before: '2026-10-29T12:30:00.000Z' });
  });

  it('Log out calls logout and shows the login card', async () => {
    server.authed = true;
    mount();
    await screen.findByText('Item 1');
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByLabelText('Password')).toBeTruthy();
    expect(server.calls).toContain('POST /logout');
    expect(onCounts).toHaveBeenLastCalledWith(null);
  });

  it('shows the stale device banner and opens settings from it', async () => {
    server.authed = true;
    server.devices = [
      {
        id: '0123456789abcdef',
        label: 'Fold',
        endpointHint: 'abcdefabcdef',
        createdAt: '2026-10-01T12:00:00.000Z',
        lastOkAt: '2026-10-20T12:00:00.000Z',
        lastFailAt: NOW,
        failCount: 4,
        stale: true,
      },
    ];
    mount();
    expect(await screen.findByText(/Notifications to Fold have failed since/)).toBeTruthy();
    expect(screen.queryByText('settings modal')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(await screen.findByText('settings modal')).toBeTruthy();
  });

  it('shows no banner when no device is stale', async () => {
    server.authed = true;
    server.devices = [{ id: '0123456789abcdef', label: 'Fold', stale: false, createdAt: NOW, lastOkAt: NOW }];
    mount();
    await screen.findByText('Item 1');
    expect(screen.queryByText(/have failed since/)).toBeNull();
  });

  it('ignores a non-numeric ?item= in the hash', async () => {
    window.location.hash = '#/inbox?item=abc';
    server.authed = true;
    mount();
    await screen.findByText('Item 1');
    expect(server.calls.some((c) => c.startsWith('GET /items/') && !c.includes('?'))).toBe(false);
  });
});
