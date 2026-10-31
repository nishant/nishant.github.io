import { afterEach, describe, expect, it } from 'vitest';
import fixture from './weather.fixture.json';
import {
  buildView,
  CACHE_KEY,
  iconNameFor,
  kelvinToF,
  locationTitle,
  msToMph,
  readWeatherCache,
  writeWeatherCache,
  type WeatherData,
} from './weather';

const data = fixture as unknown as WeatherData;
const austin = { city: 'Austin', state: 'TX', country: 'US', lat: 30.27, lon: -97.74 };

afterEach(() => localStorage.clear());

describe('kelvinToF', () => {
  it.each([
    [273.15, 32],
    [293.15, 68],
    [300.15, 81],
    [255.372, 0],
    [0, -460],
  ])('%f K is %i F', (k, f) => {
    expect(kelvinToF(k)).toBe(f);
  });

  it('never returns negative zero', () => {
    expect(Object.is(kelvinToF(255.3722), 0)).toBe(true);
  });
});

describe('msToMph', () => {
  it('converts and rounds', () => {
    expect(msToMph(5.5)).toBe(12);
    expect(msToMph(0)).toBe(0);
  });
});

describe('iconNameFor', () => {
  it.each([
    ['01d', 'sun'],
    ['01n', 'moon'],
    ['02d', 'cloud-sun'],
    ['02n', 'cloud-moon'],
    ['03d', 'cloud'],
    ['04n', 'cloud'],
    ['09d', 'cloud-drizzle'],
    ['10n', 'cloud-rain'],
    ['11d', 'cloud-lightning'],
    ['13d', 'snowflake'],
    ['50n', 'cloud-fog'],
    ['99x', 'cloud'],
    [undefined, 'cloud'],
  ])('%s is %s', (code, name) => {
    expect(iconNameFor(code)).toBe(name);
  });
});

describe('locationTitle', () => {
  it('adds the state when present', () => {
    expect(locationTitle(austin)).toBe('Austin, TX');
    expect(locationTitle({ ...austin, state: undefined })).toBe('Austin');
    expect(locationTitle(null)).toBe('Weather');
  });
});

describe('buildView', () => {
  const view = buildView(data, austin)!;

  it('maps the current block', () => {
    expect(view.title).toBe('Austin, TX');
    expect(view.temp).toBe(68);
    expect(view.feelsLike).toBe(66);
    expect(view.description).toBe('Light rain');
    expect(view.icon).toBe('cloud-rain');
    expect(view.humidity).toBe(55);
    expect(view.windMph).toBe(12);
    expect(view.windDeg).toBe(180);
    expect(view.uvi).toBe(6.3);
    expect(view.high).toBe(81);
    expect(view.low).toBe(32);
    expect(view.rainChance).toBe(60);
  });

  it('formats sunrise and sunset in the location time zone', () => {
    expect(view.sunrise).toMatch(/^\d{1,2}:\d{2} [AP]M$/);
    expect(view.sunset).toMatch(/^\d{1,2}:\d{2} [AP]M$/);
    expect(view.sunrise).not.toBe(view.sunset);
  });

  it('maps hours and shows rain only from 20%', () => {
    expect(view.hours).toHaveLength(4);
    expect(view.hours.map((h) => h.rain)).toEqual([null, null, 35, 80]);
    expect(view.hours.map((h) => h.icon)).toEqual(['cloud-sun', 'cloud-rain', 'cloud-rain', 'moon']);
    expect(view.hours[0]!.temp).toBe(68);
    expect(view.hours[3]!.temp).toBe(59);
    expect(view.hours[0]!.time).toMatch(/[AP]M$/);
  });

  it('maps days with a week range and the current temp on today only', () => {
    expect(view.days.map((d) => d.label)[0]).toBe('Today');
    expect(view.days[1]!.label).toMatch(/^[A-Z][a-z]{2} \d{1,2}\/\d{1,2}$/);
    expect(view.days.map((d) => [d.low, d.high])).toEqual([
      [32, 81],
      [27, 63],
      [45, 90],
    ]);
    expect(view.days.map((d) => d.rain)).toEqual([60, null, 20]);
    expect(view.days.map((d) => d.current)).toEqual([68, null, null]);
    expect(view.weekMin).toBe(27);
    expect(view.weekMax).toBe(90);
  });

  it('returns null without a current block and tolerates a bad time zone', () => {
    expect(buildView({ ...data, current: null }, austin)).toBeNull();
    expect(buildView({ ...data, timezone: 'Not/AZone' }, austin)!.hours).toHaveLength(4);
  });

  it('survives an older server response with no timezone and few days', () => {
    const old: WeatherData = { ...data, timezone: undefined, daily: data.daily.slice(0, 1) };
    const v = buildView(old, null)!;
    expect(v.title).toBe('Weather');
    expect(v.days).toHaveLength(1);
  });
});

describe('weather cache', () => {
  it('round-trips and expires after 10 minutes', () => {
    const at = 1_000_000;
    writeWeatherCache({ data, location: austin, at });
    expect(readWeatherCache(undefined, at + 9 * 60_000)?.location?.city).toBe('Austin');
    expect(readWeatherCache(undefined, at + 11 * 60_000)).toBeNull();
  });

  it('lives in localStorage, not sessionStorage', () => {
    writeWeatherCache({ data, location: austin, at: Date.now() });
    expect(localStorage.getItem(CACHE_KEY)).not.toBeNull();
    expect(sessionStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('ignores junk', () => {
    localStorage.setItem(CACHE_KEY, '{nope');
    expect(readWeatherCache()).toBeNull();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: {} }));
    expect(readWeatherCache()).toBeNull();
  });
});
