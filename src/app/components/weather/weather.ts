export interface RawWeatherData {
  coord: {
    lon: number,
    lat: number
  };
  weather: [{
    id: number,
    main: string,
    description: string,
    icon: string
  }];
  base: string;
  main: {
    temp: number,
    feels_like: number,
    temp_min: number,
    temp_max: number,
    pressure: number,
    humidity: number
  };
  visibility: number;
  wind: {
    speed: number,
    deg: number
  };
  clouds: {
    all: number;
  };
  dt: number;
  sys: {
    type: number,
    id: number,
    country: string,
    sunrise: number,
    sunset: number
  };
  timezone: number;
  id: number;
  name: string;
  cod: number;
}

export interface WeatherData {
  location: string;
  sunset: string;
  sunrise: string;
  tempFahrenheit: number;
  tempMin: number;
  tempMax: number;
  tempFeelsLike: number;
  humidity: number;
  description: string;
  icon: string;
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


