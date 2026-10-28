import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  ListRow,
  Modal,
  SkeletonRows,
  buttonClass,
  cn,
} from '@nish/ui';
import { ago, date } from '@nish/ui/format';
import { ExternalLink, Mail, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAppConfig, type AppConfig } from '../../lib/api';
import {
  AuthError,
  clearCachedToken,
  getValidToken,
  listInbox,
  loadGis,
  requestToken,
  revokeToken,
  type MailMessage,
} from './gmail';

const INBOX_URL = 'https://mail.google.com/mail/u/0/#inbox';
const DAY_MS = 86_400_000;

type View =
  | { kind: 'config' }
  | { kind: 'not-configured' }
  | { kind: 'signed-out'; expired: boolean; error?: string }
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

/** "3m ago" for the last six days, then "Oct 21". */
function whenLabel(t: number, now: number = Date.now()): string {
  if (!t) return '';
  return now - t < 6 * DAY_MS ? ago(t, { now }) : date(t, 'short');
}

function MailRow({ m }: { m: MailMessage }) {
  return (
    <ListRow
      dense
      href={`https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(m.id)}`}
      external
      title={
        <span className="flex items-center gap-2">
          {m.unread ? <span aria-hidden className="size-2 shrink-0 rounded-full bg-th-accent" /> : null}
          <span className={cn('truncate', m.unread ? 'font-semibold' : 'text-th-hi2')}>{m.from}</span>
          {m.unread ? <span className="sr-only">Unread</span> : null}
        </span>
      }
      meta={whenLabel(m.date)}
      subtitle={
        <>
          <span className={cn('block truncate', m.unread ? 'text-th-hi' : 'text-th-hi2')}>{m.subject}</span>
          {m.snippet ? <span className="block truncate">{m.snippet}</span> : null}
        </>
      }
    />
  );
}

function MailBody({ onClose }: { onClose: () => void }) {
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [view, setView] = useState<View>({ kind: 'config' });
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [next, setNext] = useState<string | undefined>();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const run = useRef(0);
  const mounted = useRef(true);
  const needConsent = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (tok: string) => {
    const id = ++run.current;
    setView({ kind: 'loading' });
    try {
      const page = await listInbox(tok, undefined);
      if (!mounted.current || id !== run.current) return;
      setMessages(page.messages);
      setNext(page.nextPageToken);
      setToken(tok);
      setView({ kind: 'ready' });
    } catch (e) {
      if (!mounted.current || id !== run.current) return;
      if (e instanceof AuthError) {
        clearCachedToken();
        setToken(null);
        setView({ kind: 'signed-out', expired: true });
      } else {
        setView({ kind: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' });
      }
    }
  }, []);

  // Resolve the server config, then use a cached token when there is one.
  useEffect(() => {
    let alive = true;
    void getAppConfig().then((cfg) => {
      if (!alive) return;
      setAppConfig(cfg);
      if (!cfg.googleClientId) {
        setView({ kind: 'not-configured' });
        return;
      }
      // Load the GIS script now so the Connect click can open its popup straight away.
      void loadGis().catch(() => {});
      const cached = getValidToken();
      if (cached) void load(cached);
      else setView({ kind: 'signed-out', expired: false });
    });
    return () => {
      alive = false;
    };
  }, [load]);

  async function connect() {
    const clientId = appConfig?.googleClientId;
    if (!clientId) return;
    setBusy(true);
    try {
      // A second popup opened after an await would be blocked, so a failed silent
      // attempt asks for consent on the next click instead of chaining it.
      const prompt = needConsent.current ? 'consent' : '';
      let tok: string;
      try {
        tok = await requestToken(clientId, prompt);
        needConsent.current = false;
      } catch (e) {
        if (e instanceof AuthError && prompt === '') needConsent.current = true;
        throw e;
      }
      if (!mounted.current) return;
      await load(tok);
    } catch (e) {
      if (!mounted.current) return;
      setView({
        kind: 'signed-out',
        expired: false,
        error: e instanceof Error ? e.message : 'Sign-in did not finish. Try again.',
      });
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function loadMore() {
    if (!token || !next) return;
    setLoadingMore(true);
    try {
      const page = await listInbox(token, next);
      if (!mounted.current) return;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...page.messages.filter((m) => !seen.has(m.id))];
      });
      setNext(page.nextPageToken);
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof AuthError) {
        clearCachedToken();
        setToken(null);
        setView({ kind: 'signed-out', expired: true });
      } else {
        setView({ kind: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' });
      }
    } finally {
      if (mounted.current) setLoadingMore(false);
    }
  }

  async function disconnect() {
    const t = token;
    setToken(null);
    setMessages([]);
    setNext(undefined);
    setView({ kind: 'signed-out', expired: false });
    clearCachedToken();
    if (t) await revokeToken(t).catch(() => undefined);
  }

  const signedIn = token !== null && (view.kind === 'ready' || view.kind === 'loading' || view.kind === 'error');

  const actions = (
    <div className="flex items-center gap-1">
      <IconButton
        label="Refresh inbox"
        onClick={() => {
          const t = token ?? getValidToken();
          if (t) void load(t);
        }}
        disabled={!signedIn || view.kind === 'loading'}
      >
        <RefreshCw size={16} className={view.kind === 'loading' ? 'motion-safe:animate-spin' : undefined} />
      </IconButton>
      <a href={INBOX_URL} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: 'ghost', size: 'sm' })}>
        <ExternalLink size={14} aria-hidden />
        Open Gmail
      </a>
    </div>
  );

  let content;
  switch (view.kind) {
    case 'config':
    case 'loading':
      content = <SkeletonRows rows={8} height={64} gap="sm" label="Loading your inbox" />;
      break;
    case 'not-configured':
      content = (
        <EmptyState
          compact
          icon={<Mail />}
          title="Gmail isn't set up yet"
          detail="Add GOOGLE_CLIENT_ID to server/.env on the PC, then reload."
        />
      );
      break;
    case 'signed-out':
      content = (
        <EmptyState
          compact
          icon={<Mail />}
          title="Connect Gmail to see your inbox"
          detail={
            view.error ??
            (view.expired ? 'Your Gmail session expired. Connect again to refresh it.' : 'Read-only. Your mail stays in this browser.')
          }
          action={
            <Button variant="primary" loading={busy} onClick={() => void connect()}>
              Connect Gmail
            </Button>
          }
        />
      );
      break;
    case 'error':
      content = (
        <ErrorState
          message={
            <>
              <strong className="block font-semibold">Couldn't load your inbox</strong>
              <span className="block">{view.message}</span>
            </>
          }
          onRetry={() => {
            const t = token ?? getValidToken();
            if (t) void load(t);
            else setView({ kind: 'signed-out', expired: true });
          }}
        />
      );
      break;
    case 'ready':
      content =
        messages.length === 0 ? (
          <EmptyState compact icon={<Mail />} title="Your inbox is empty" detail="Nothing to read right now." />
        ) : (
          <>
            <ul className="-mx-1 flex flex-col">
              {messages.map((m) => (
                <MailRow key={m.id} m={m} />
              ))}
            </ul>
            {next ? (
              <div className="flex justify-center pt-3">
                <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
                  Load more
                </Button>
              </div>
            ) : null}
          </>
        );
      break;
  }

  return (
    <Modal
      title="Inbox"
      onClose={onClose}
      size="lg"
      sheetHeight="tall"
      subtitle={actions}
      footer={
        <>
          {token ? (
            <Button variant="ghost" onClick={() => void disconnect()}>
              Disconnect
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {content}
    </Modal>
  );
}

/** The Gmail inbox sheet (read-only, Google sign-in in the browser). Mounts its body only while open. */
export function MailSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <MailBody onClose={onClose} /> : null;
}
