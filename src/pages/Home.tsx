import { AppDock } from '../components/AppDock';
import { Clock } from '../components/Clock';
import { Footer } from '../components/Footer';
import { LinkGrid } from '../components/LinkGrid';
import { SearchBar } from '../components/SearchBar';
import { WeatherChip } from '../features/weather/WeatherChip';
import type { AppId } from '../lib/api';
import { useConfig } from '../lib/config-context';

/** The start page: clock and weather, search, the grid of link sections and the app buttons. */
export function Home({ onOpen, openSheet }: { onOpen: (id: AppId) => void; openSheet: AppId | null }) {
  const { config } = useConfig();
  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_top,var(--nish-accent-soft),transparent_60%)]"
      />
      <div className="nish-pad-bottom-inset mx-auto flex w-full max-w-[72rem] flex-col gap-4 px-[var(--nish-page-gutter)] pt-3">
        <Clock trailing={<WeatherChip onOpen={() => onOpen('weather')} />} />
        <SearchBar config={config} />
        <LinkGrid config={config} onOpenSettings={() => onOpen('settings')} />
        <AppDock onOpen={onOpen} openSheet={openSheet} />
        <Footer />
      </div>
    </div>
  );
}
