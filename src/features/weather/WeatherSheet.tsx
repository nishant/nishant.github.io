import { ErrorState, IconButton, KeyValueList, Modal, RangeBar, RelativeTime, ScrollRow, Segmented, Skeleton, Spinner, cn } from '@nish/ui';
import { ArrowDown, RefreshCw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { WeatherIcon } from './WeatherIcon';
import { buildView, useWeather, type DayView, type HourView, type WeatherErrorKind, type WeatherView } from './weather';

type Tab = 'hours' | 'days';

const ERROR_COPY: Record<WeatherErrorKind, { title: string; body: string }> = {
  denied: {
    title: 'Location is blocked',
    body: 'Allow location for start.nish.software in your browser settings, then try again.',
  },
  unavailable: { title: "Couldn't find your location", body: 'Try again in a moment.' },
  server: { title: 'Weather is unavailable', body: "The weather service didn't answer. Try again in a moment." },
  'not-configured': { title: "Weather isn't set up", body: 'Add OPENWEATHERMAP_API_KEY to server/.env on the PC.' },
};

/** The weather dialog: current conditions, an hourly strip and a daily list. */
export function WeatherSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, refreshing, refresh } = useWeather(open);
  const [tab, setTab] = useState<Tab>('hours');
  if (!open) return null;

  const cache = state.status === 'ready' ? state.cache : null;
  const view = cache ? buildView(cache.data, cache.location) : null;
  const busy = state.status === 'locating' || state.status === 'loading' || refreshing;

  const subtitle = (
    <div className="flex min-h-8 items-center justify-between gap-2 text-sm text-th-hi3">
      <span aria-live="polite">
        {state.status === 'locating' ? (
          'Finding your location…'
        ) : cache ? (
          <>
            Updated <RelativeTime value={cache.at} />
          </>
        ) : state.status === 'loading' ? (
          'Loading the forecast…'
        ) : null}
      </span>
      <IconButton label="Refresh weather" onClick={refresh} disabled={busy}>
        {busy ? <Spinner size="sm" /> : <RefreshCw size={16} aria-hidden="true" />}
      </IconButton>
    </div>
  );

  return (
    <Modal title={view?.title ?? 'Weather'} subtitle={subtitle} onClose={onClose} size="md" sheetHeight="auto">
      {view ? (
        <Forecast view={view} tab={tab} onTab={setTab} />
      ) : state.status === 'error' ? (
        <ErrorState
          message={
            <>
              <span className="block font-semibold text-th-hi">{ERROR_COPY[state.kind].title}</span>
              <span className="block">{ERROR_COPY[state.kind].body}</span>
            </>
          }
          onRetry={state.kind === 'not-configured' ? undefined : refresh}
          compact
        />
      ) : (
        <ForecastSkeleton locating={state.status === 'locating'} />
      )}
    </Modal>
  );
}

function Forecast({ view, tab, onTab }: { view: WeatherView; tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <WeatherIcon name={view.icon} size={48} className="shrink-0 text-th-accent" />
        <div className="min-w-0 flex-1">
          <div className="text-5xl leading-none font-semibold tabular-nums text-th-hi">{view.temp}°</div>
          <div className="mt-1.5 text-sm text-th-hi3">
            Feels like <span className="tabular-nums">{view.feelsLike}°</span>
          </div>
          {view.description ? <div className="truncate text-sm text-th-hi2">{view.description}</div> : null}
        </div>
        {view.high !== null && view.low !== null ? (
          <div className="shrink-0 text-right text-sm tabular-nums text-th-hi2">
            H {view.high}° · L {view.low}°
          </div>
        ) : null}
      </div>

      <KeyValueList
        dense
        className="grid sm:grid-cols-2 sm:gap-x-6"
        items={[
          { key: 'humidity', label: 'Humidity', value: <span className="tabular-nums">{view.humidity}%</span> },
          {
            key: 'wind',
            label: 'Wind',
            value: (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <ArrowDown
                  size={14}
                  aria-hidden="true"
                  className="text-th-hi3"
                  style={{ transform: `rotate(${view.windDeg}deg)` }}
                />
                {view.windMph} mph
              </span>
            ),
          },
          { key: 'uv', label: 'UV index', value: <span className="tabular-nums">{view.uvi}</span> },
          {
            key: 'rain',
            label: 'Chance of rain',
            value: <span className="tabular-nums">{view.rainChance === null ? '—' : `${view.rainChance}%`}</span>,
          },
          { key: 'sunrise', label: 'Sunrise', value: <span className="tabular-nums">{view.sunrise}</span> },
          { key: 'sunset', label: 'Sunset', value: <span className="tabular-nums">{view.sunset}</span> },
        ]}
      />

      <Segmented<Tab>
        label="Forecast range"
        block
        options={[
          { value: 'hours', label: 'Next hours' },
          { value: 'days', label: 'Next days' },
        ]}
        value={tab}
        onChange={onTab}
      />

      {tab === 'hours' ? <HourStrip hours={view.hours} /> : <DayList days={view.days} min={view.weekMin} max={view.weekMax} />}
    </div>
  );
}

function HourStrip({ hours }: { hours: HourView[] }) {
  if (hours.length === 0) return <Empty>No hourly forecast available.</Empty>;
  return (
    <ScrollRow snap label="Next 24 hours">
      {hours.map((h) => (
        <div
          key={h.key}
          className="flex w-16 shrink-0 snap-start flex-col items-center gap-1 rounded-lg px-1 py-2 text-sm"
        >
          <span className="text-xs whitespace-nowrap text-th-hi3">{h.time}</span>
          <WeatherIcon name={h.icon} size={22} className="text-th-hi2" />
          <span className="font-medium tabular-nums text-th-hi">{h.temp}°</span>
          <span className={cn('h-4 text-xs tabular-nums text-th-sky', h.rain === null && 'invisible')}>
            {h.rain === null ? '0%' : `${h.rain}%`}
          </span>
        </div>
      ))}
    </ScrollRow>
  );
}

function DayList({ days, min, max }: { days: DayView[]; min: number; max: number }) {
  if (days.length === 0) return <Empty>No daily forecast available.</Empty>;
  return (
    <ul className="divide-y divide-th-line">
      {days.map((d) => (
        <li key={d.key} className="flex min-h-11 items-center gap-2 py-1.5 text-sm">
          <span className="w-[4.5rem] shrink-0 text-th-hi">{d.label}</span>
          <WeatherIcon name={d.icon} size={20} className="shrink-0 text-th-hi2" />
          <span className={cn('w-9 shrink-0 text-right text-xs tabular-nums text-th-sky', d.rain === null && 'invisible')}>
            {d.rain === null ? '0%' : `${d.rain}%`}
          </span>
          <RangeBar
            className="min-w-12 flex-1"
            min={min}
            max={max}
            low={d.low}
            high={d.high}
            current={d.current ?? undefined}
          />
          <span className="shrink-0 text-right tabular-nums text-th-hi2">
            <span className="text-th-hi3">{d.low}°</span> / {d.high}°
          </span>
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-th-hi3">{children}</p>;
}

function ForecastSkeleton({ locating }: { locating: boolean }) {
  return (
    <div className="flex flex-col gap-5" role="status" aria-busy="true">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="grid gap-x-6 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex h-8 items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-full rounded-lg" />
      <p className="sr-only">{locating ? 'Finding your location…' : 'Loading the forecast…'}</p>
    </div>
  );
}
