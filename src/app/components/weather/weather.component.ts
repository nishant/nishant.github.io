import { Component, OnInit } from '@angular/core';
import { CurrentWeatherData, DailyWeatherData, HourlyWeatherData, IconCodes, WeatherResponse } from './weather';
import { WeatherService } from './weather.service';
import moment from 'moment';

@Component({
  selector: 'app-weather',
  templateUrl: './weather.component.html',
  styleUrls: ['./weather.component.scss']
})
export class WeatherComponent implements OnInit {
  location = '';
  currentWeatherData?: CurrentWeatherData;
  hourlyWeatherData?: HourlyWeatherData;
  dailyWeatherData?: DailyWeatherData;


  showCurrentWeather = true;
  showHourlyWeather = false;
  showDailyWeather = false;

  constructor(private weatherService: WeatherService) {}

  ngOnInit(): void {
    this.getGeolocation();
  }

  setCurrentWeatherData = (data: WeatherResponse): void => {
    this.currentWeatherData = {
      location: this.location,
      sunrise: this.convertTime(this.getDateTime(data.current.sunrise)),
      sunset: this.convertTime(this.getDateTime(data.current.sunset)),
      temp: this.kelvinToFahrenheit(data.current.temp),
      feelsLike: this.kelvinToFahrenheit(data.current.feels_like),
      humidity: data.current.humidity,
      description: data.current.weather[0].main,
      icon: IconCodes.get(data.current.weather[0].icon),
    };
  }

  setHourlyWeatherData = (data: WeatherResponse): void => {
    this.hourlyWeatherData = { data: [] };
    data.hourly.forEach(hour => {
      this.hourlyWeatherData?.data.push({
        time: this.convertTime(this.getDateTime(hour.dt), 'ha'),
        temp: this.kelvinToFahrenheit(hour.temp),
        feelsLike: this.kelvinToFahrenheit(hour.feels_like),
        icon: IconCodes.get(hour.weather[0].icon),
      })
    });
  }

  setDailyWeatherData = (data: WeatherResponse): void => {
    this.dailyWeatherData = { data: [] };
    data.daily.forEach(day => {
      this.dailyWeatherData?.data.push({
        day: this.getDateTime(day.dt, true),
        dayTemp: this.kelvinToFahrenheit(day.temp.day),
        nightTemp: this.kelvinToFahrenheit(day.temp.night),
        high: this.kelvinToFahrenheit(day.temp.max),
        low: this.kelvinToFahrenheit(day.temp.min),
        icon: IconCodes.get(day.weather[0].icon),
      })
    });
  }

  getGeolocation = (): void => {
    if (!navigator.geolocation) { alert('Geolocation not supported.'); }

    if (Date.now() <= this.weatherService.lastGeoRequestTimestamp.value + 300000) { // 5 mins
      if (this.weatherService.cachedWeatherResponse.value === null) { return; }
      this.location = this.weatherService.cachedLocation.value?.location ?? '';
      this.setCurrentWeatherData(this.weatherService.cachedWeatherResponse.value);
      return;
    }

    const success = (pos: GeolocationPosition) => {
      const crd = pos.coords;
      navigator.geolocation.clearWatch(id);

      this.weatherService.getWeatherData(crd.latitude, crd.longitude).subscribe(dataResponse => {
        this.weatherService.cachedWeatherResponse.next(dataResponse);

        this.weatherService.getLocation(crd.latitude, crd.longitude).subscribe(locationResponse => {
          this.weatherService.cachedLocation.next({ location: locationResponse.city, lat: crd.latitude, lon: crd.longitude });
          this.location = locationResponse.city;
          this.setCurrentWeatherData(dataResponse);
        });
      });
    }

    const error = (err: { code: unknown, message: string }) => {
      console.error(`ERROR ${err.code}: ${err.message}`);
    }

    const options: PositionOptions = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
    const id = navigator.geolocation.watchPosition(success, error, options);

    this.weatherService.lastGeoRequestTimestamp.next(Date.now());
  }

  kelvinToFahrenheit = (kelvin: number) => {
    return Math.round(9 / 5 * (kelvin - 273.15) + 32)
  }

  convertTime = (time: string, format = 'h:mma') => {
    return moment(time, 'HH:mm').format(format);
  };

  getDateTime = (dt: number, dayDate = false) => {
    const date = new Date(dt * 1000);

    // const year = date.getFullYear();
    // const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    // const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    // const seconds = String(date.getSeconds()).padStart(2, '0');

    if (dayDate) {
      const day = date.toDateString().split(' ')[0];
      const split = date.toLocaleDateString().split('/');
      split.pop();
      return `${day} ${split.join('/')}`;
    }

    return `${hours}:${minutes}`
  };

  getCurrentWeather = () => {
    this.showCurrentWeather = true;
    this.showHourlyWeather = false;
    this.showDailyWeather = false;

    this.setCurrentWeatherData(this.weatherService.cachedWeatherResponse.value!);
  };

  getHourlyWeather = () => {
    this.showCurrentWeather = false;
    this.showHourlyWeather = true;
    this.showDailyWeather = false;

    this.setHourlyWeatherData(this.weatherService.cachedWeatherResponse.value!);
  };

  getDailyWeather = () => {
    this.showCurrentWeather = false;
    this.showHourlyWeather = false;
    this.showDailyWeather = true;


    this.setDailyWeatherData(this.weatherService.cachedWeatherResponse.value!);
  };
}
