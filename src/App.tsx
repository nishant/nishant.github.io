import { AppHeader, Modal, Spinner, Toaster, cn, tabClass, useDocumentTitle } from '@nish/ui';
import { Suspense, lazy, useCallback, useState, type ComponentType } from 'react';
import { ConfigProvider } from './lib/config-context';
import { useHashRoute } from './lib/route';
import type { AppId } from './lib/api';
import { Anime } from './pages/Anime';
import { Home } from './pages/Home';

interface SheetProps {
  open: boolean;
  onClose: () => void;
}

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
  useDocumentTitle(route === 'jp' ? 'Anime + Manga' : undefined, { app: 'Start' });

  const nav = (
    <div className="flex gap-5">
      <a href="#/home" className={cn(tabClass({ active: route === 'home' }))} aria-current={route === 'home' ? 'page' : undefined}>
        Home
      </a>
      <a href="#/jp" className={cn(tabClass({ active: route === 'jp' }))} aria-current={route === 'jp' ? 'page' : undefined}>
        Anime
      </a>
    </div>
  );

  return (
    <>
      <AppHeader name="Start" sticky={route === 'jp'} nav={nav} navLabel="Start" />
      {route === 'jp' ? <Anime /> : <Home onOpen={setSheet} openSheet={sheet} />}
      <Sheets sheet={sheet} onClose={closeSheet} />
      <Toaster />
    </>
  );
}

/** The start page app: config, header, the two routes, the sheets and the toasts. */
export function App() {
  return (
    <ConfigProvider>
      <Shell />
    </ConfigProvider>
  );
}
