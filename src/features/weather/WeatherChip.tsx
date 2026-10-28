import { useEffect, useState } from 'react';
import { WeatherIcon } from './WeatherIcon';
import { CACHE_EVENT, iconNameFor, kelvinToF, readWeatherCache, type WeatherCache } from './weather';

const MAX_AGE_MS = 60 * 60_000;

/**
 * The home page's weather chip: icon and temperature from the cached forecast. It never asks
 * for the location by itself and renders nothing until a forecast has been loaded this session.
 */
export function WeatherChip({ onOpen }: { onOpen: () => void }) {
  const [cache, setCache] = useState<WeatherCache | null>(() => readWeatherCache(MAX_AGE_MS));

  useEffect(() => {
    const update = () => setCache(readWeatherCache(MAX_AGE_MS));
    window.addEventListener(CACHE_EVENT, update);
    return () => window.removeEventListener(CACHE_EVENT, update);
  }, []);

  const current = cache?.data.current;
  if (!current) return null;
  const temp = kelvinToF(current.temp);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`Weather, ${temp} degrees. Open forecast`}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-th-hi2 hover:bg-th-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-th-accent pointer-fine:min-h-8"
    >
      <WeatherIcon name={iconNameFor(current.weather?.[0]?.icon)} size={18} className="text-th-accent" />
      <span className="tabular-nums">{temp}°</span>
    </button>
  );
}
