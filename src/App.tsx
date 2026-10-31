import { AppHeader, Badge, Modal, Spinner, Toaster, cn, tabClass, useDocumentTitle } from '@nish/ui';
import { Suspense, lazy, useCallback, useState, type ComponentType } from 'react';
import { ConfigProvider } from './lib/config-context';
import { useHashRoute } from './lib/route';
import type { AppId } from './lib/api';
import { CommandMenu } from './features/palette/CommandMenu';
import { UrlImport } from './features/backup/UrlImport';
import { Home } from './pages/Home';
import { useInboxCounts } from './features/inbox/counts';

interface SheetProps {
  open: boolean;
  onClose: () => void;
}

const Anime = lazy(() => import('./pages/Anime').then((m) => ({ default: m.Anime })));
const InboxPage = lazy(() => import('./pages/Inbox').then((m) => ({ default: m.InboxPage })));
const NotesSheet = lazy(() =>
  import('./features/notes/NotesSheet').then((m) => ({ default: m.NotesSheet as ComponentType<SheetProps> })),
);
const SettingsSheet = lazy(() =>
  import('./features/settings/SettingsSheet').then((m) => ({ default: m.SettingsSheet as ComponentType<SheetProps> })),
);
const WeatherSheet = lazy(() =>
  import('./features/weather/WeatherSheet').then((m) => ({ default: m.WeatherSheet as ComponentType<SheetProps> })),
);
const MailSheet = lazy(() =>
  import('./features/mail/MailSheet').then((m) => ({ default: m.MailSheet as ComponentType<SheetProps> })),
);
const WatchlistSheet = lazy(() =>
  import('./features/watchlist/WatchlistSheet').then((m) => ({
    default: m.WatchlistSheet as ComponentType<SheetProps>,
  })),
);

const SHEETS: Record<AppId, ComponentType<SheetProps>> = {
  notes: NotesSheet,
  settings: SettingsSheet,
  weather: WeatherSheet,
  mail: MailSheet,
  watchlist: WatchlistSheet,
};

/** Shown in a Modal while a sheet's code loads. */
function SheetFallback({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} aria-label="Loading" size="md" sheetHeight="auto" hideClose>
      <div className="flex min-h-40 items-center justify-center">
        <Spinner />
      </div>
    </Modal>
  );
}

/** Renders the open sheet only (each sheet's code loads on first open). */
function Sheets({ sheet, onClose }: { sheet: AppId | null; onClose: () => void }) {
  if (!sheet) return null;
  const Sheet = SHEETS[sheet];
  return (
    <Suspense fallback={<SheetFallback onClose={onClose} />}>
      <Sheet key={sheet} open onClose={onClose} />
    </Suspense>
  );
}

function Shell() {
  const route = useHashRoute();
  const [sheet, setSheet] = useState<AppId | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const inbox = useInboxCounts();
  const openCount = inbox.counts?.open ?? 0;
  useDocumentTitle(
    route === 'jp'
      ? 'Anime + Manga'
      : route === 'inbox'
        ? openCount > 0
          ? `Inbox (${openCount})`
          : 'Inbox'
        : undefined,
    { app: 'Start' },
  );

  const nav = (
    <div className="flex gap-5">
      <a href="#/home" className={cn(tabClass({ active: route === 'home' }))} aria-current={route === 'home' ? 'page' : undefined}>
        Home
      </a>
      <a href="#/jp" className={cn(tabClass({ active: route === 'jp' }))} aria-current={route === 'jp' ? 'page' : undefined}>
        Anime
      </a>
      <a
        href="#/inbox"
        className={cn(tabClass({ active: route === 'inbox' }), 'flex-row items-center gap-1.5')}
        aria-current={route === 'inbox' ? 'page' : undefined}
      >
        Inbox
        {openCount > 0 ? (
          <Badge size="xs" tone={(inbox.counts?.urgent ?? 0) > 0 ? 'loss' : 'accent'}>
            {openCount}
            <span className="sr-only"> open</span>
          </Badge>
        ) : null}
      </a>
    </div>
  );

  return (
    <>
      <AppHeader name="Start" sticky={route === 'jp'} nav={nav} navLabel="Start" />
      {route === 'home' ? (
        <Home onOpen={setSheet} openSheet={sheet} />
      ) : (
        <Suspense
          fallback={
            <div className="flex min-h-60 items-center justify-center">
              <Spinner />
            </div>
          }
        >
          {route === 'jp' ? <Anime /> : <InboxPage onCounts={inbox.setCounts} />}
        </Suspense>
      )}
      <Sheets sheet={sheet} onClose={closeSheet} />
      <CommandMenu onOpenSheet={setSheet} />
      <UrlImport />
      <Toaster />
    </>
  );
}

/** The start page app: config, header, the routes, the sheets and the toasts. */
export function App() {
  return (
    <ConfigProvider>
      <Shell />
    </ConfigProvider>
  );
}
