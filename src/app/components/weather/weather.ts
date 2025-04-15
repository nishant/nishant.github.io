export interface WeatherResponse {
  current: CurrentWeather;
  hourly: Array<HourlyWeather>;
  daily: Array<DailyWeather>;
}

export interface Weather {
  id: number;
  main: string;
  description: string;
  icon: string;
}

export interface CurrentWeather {
  dt: number;
  sunrise: number;
  sunset: number;
  temp: number;
  feels_like: number;
  pressure: number;
  humidity: number;
  dew_point: number;
  uvi: number;
  clouds: number;
  visibility: number;
  wind_speed: number;
  wind_deg: number;
  wind_gust: number;
  weather: Array<Weather>;
}

export interface HourlyWeather {
  dt: number;
  temp: number;
  feels_like: number;
  pressure: number;
  humidity: number;
  dew_point: number;
  uvi: number;
  clouds: number;
  visibility: number;
  wind_speed: number;
  wind_deg: number;
  wind_gust: number;
  weather: Array<Weather>;
  pop: number;
}

export interface DailyWeather {
  dt: number;
  sunrise: number;
  sunset: number;
  moonrise: number;
  moonset: number;
  moon_phase: number;
  summary: string;
  temp: {
    day: number;
    min: number;
    max: number;
    night: number;
    eve: number;
    morn: number;
  };
  feels_like: {
    day: number;
    night: number;
    eve: number;
    morn: number;
  };
  pressure: number;
  humidity: number;
  dew_point: number;
  wind_speed: number;
  wind_deg: number;
  wind_gust: number;
  weather: Array<Weather>;
  clouds: number;
  pop: number;
  uvi: number;
  rain?: number; // optional: only present on rainy days
}

export interface CurrentWeatherData {
  location: string;
  sunset: string;
  sunrise: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  description: string;
  icon?: string;
}

export interface HourlyWeatherData {
  data: Array<{
    time: string,
    temp: number,
    feelsLike: number,
    icon?: string
  }>
}

export interface DailyWeatherData {
  data: Array<{
    day: string,
    dayTemp: number,
    nightTemp: number,
    high: number,
    low: number
    icon?: string
  }>
}

export const IconCodes = new Map<string, string>([
  ['01d', 'clear_day'],
  ['01n', 'clear_night'],
  ['02d', 'partly_cloudy_day'],
  ['02n', 'partly_cloudy_night'],
  ['03d', 'cloud'],
  ['03n', 'cloud'],
  ['04d', 'cloud'],
  ['04n', 'cloud'],
  ['09d', 'rainy'],
  ['09n', 'rainy'],
  ['10d', 'rainy'],
  ['10n', 'rainy'],
  ['11d', 'thunderstorm'],
  ['11n', 'thunderstorm'],
  ['13d', 'cloudy_snowing'],
  ['13n', 'cloudy_snowing'],
  ['50d', 'foggy'],
  ['50n', 'foggy'],
]);

export interface LocationResponse {
  city: string,
  state: string,
  country: string,
  lat: number
  lon: number
}

export interface LocationData {
  location: string,
  lat: number,
  lon: number
}
