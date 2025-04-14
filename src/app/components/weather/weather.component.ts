import { Component, OnInit } from '@angular/core';
import { IconCodes, LocationResponse, WeatherData, WeatherResponse } from './weather';
import Icon from 'ngx-editor/lib/icons';
import { WeatherService } from './weather.service';

@Component({
  selector: 'app-weather',
  templateUrl: './weather.component.html',
  styleUrls: ['./weather.component.scss']
})
export class WeatherComponent implements OnInit {
  location = '';
  weatherData?: WeatherData;

  constructor(private weatherService: WeatherService) {
  }

  ngOnInit(): void {
    this.getGeolocation();
  }

  setWeatherData = (data: WeatherResponse): void => {
    this.weatherData = {
      location: this.location,
      sunrise: this.getDateTime(data.current.sunrise),
      sunset: this.getDateTime(data.current.sunset),
      temp: this.kelvinToFahrenheit(data.current.temp),
      feelsLike: this.kelvinToFahrenheit(data.current.feels_like),
      humidity: data.current.humidity,
      description: data.current.weather[0].main,
      icon: IconCodes.get(data.current.weather[0].icon),
    };
  }

  getGeolocation = (): void => {
    if (!navigator.geolocation) { alert('Geolocation not supported.'); }

    if (Date.now() <= this.weatherService.lastGeoRequestTimestamp.value + 300000) { // 5 mins
      if (this.weatherService.cachedWeatherResponse.value === null) { return; }
      this.location = this.weatherService.cachedLocation.value;
      this.setWeatherData(this.weatherService.cachedWeatherResponse.value);
      return;
    }


    let id: number;
    let target: { latitude: number, longitude: number };
    let options: PositionOptions;

    const success = (pos: any) => {
      const crd = pos.coords;
      console.log(crd)
      navigator.geolocation.clearWatch(id);

      this.weatherService.getWeatherData(crd.latitude, crd.longitude).subscribe(dataResponse => {
        this.weatherService.cachedWeatherResponse.next(dataResponse);

        this.weatherService.getLocation(crd.latitude, crd.longitude).subscribe(locationResponse => {
          this.weatherService.cachedLocation.next(locationResponse.city);
          this.location = locationResponse.city;
          this.setWeatherData(dataResponse);
        });
      });
    }

    const error = (err: any) => {
      console.error(`ERROR(${err.code}): ${err.message}`);
    }

    options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    };

    id = navigator.geolocation.watchPosition(success, error, options);

    this.weatherService.lastGeoRequestTimestamp.next(Date.now());
  }

  kelvinToFahrenheit = (kelvin: number) => {
    return Math.round(9 / 5 * (kelvin - 273.15) + 32)
  }

  getDateTime = (dt: number) => {
    const date = new Date(dt * 1000); // Multiply by 1000 to convert seconds to milliseconds

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${hours}:${minutes}`
  };
}
