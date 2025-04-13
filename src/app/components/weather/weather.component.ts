import { Component, OnInit } from '@angular/core';
import { IconCodes, RawWeatherData, WeatherData } from './weather';
import Icon from 'ngx-editor/lib/icons';
import { WeatherService } from './weather.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-weather',
  templateUrl: './weather.component.html',
  styleUrls: ['./weather.component.scss']
})
export class WeatherComponent implements OnInit {
  OPEN_WEATHER_API_BASEURL = 'https://api.openweathermap.org/data/3.0/onecall?';
  OPEN_WEATHER_API_KEY = '';

  weatherData: WeatherData | null = null;
  constructor(private service: WeatherService) {
  }

  ngOnInit(): void {
    this.getGeolocation();
  }

  getWeatherData = async (lat: number, lon: number): Promise<RawWeatherData> => {
    const requestUrl = `${this.OPEN_WEATHER_API_BASEURL}lat=${lat}&lon=${lon}&appid=${this.OPEN_WEATHER_API_KEY}`;
    const response = await fetch(requestUrl);
    const data = await response.json() as RawWeatherData;
    console.log(data);
    return data;
  }

  setWeatherData = (data: RawWeatherData): void => {
    this.weatherData = {
      description: data.weather[0].description.split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' '),
      humidity: data.main.humidity,
      icon: IconCodes.get(data.weather[0].icon) ?? '',
      location: data.name,
      sunrise: new Date(data.sys.sunrise * 1000).toLocaleTimeString(),
      sunset: new Date(data.sys.sunset * 1000).toLocaleTimeString(),
      tempFahrenheit: Math.round((data.main.temp - 273.15) * 1.8 + 32),
      tempFeelsLike: Math.round((data.main.feels_like - 273.15) * 1.8 + 32),
      tempMax: Math.round((data.main.temp_max - 273.15) * 1.8 + 32),
      tempMin: Math.round((data.main.temp_min - 273.15) * 1.8 + 32),
    };
    console.log(this.weatherData)
  }

  getGeolocation = (): void => {
    if (!navigator.geolocation) { alert('Geolocation not supported.'); }

    navigator.geolocation.getCurrentPosition(async position => {
      if (!position.coords) { return; }
      this.setWeatherData(await this.getWeatherData(position.coords.latitude, position.coords.longitude))
    });
  }
}
