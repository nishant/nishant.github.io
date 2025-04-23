import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { LocationResponse, WeatherResponse, LocationData } from './weather';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WeatherService {
  OPEN_WEATHER_API_BASEURL = 'https://nishant-github-io-api.onrender.com/api/weather';
  // OPEN_WEATHER_API_BASEURL = 'http://localhost:10000/api/weather';

  lastGeoRequestTimestamp = new BehaviorSubject(0);
  cachedWeatherResponse = new BehaviorSubject<WeatherResponse | null>(null);
  cachedLocation = new BehaviorSubject<LocationData | null>(null);

  constructor(private http: HttpClient) {}

  getWeatherData = (lat: number, lon: number): Observable<WeatherResponse> => {
    return this.http.get<WeatherResponse>(`${this.OPEN_WEATHER_API_BASEURL}/data?lat=${lat}&lon=${lon}`);
  };

  getLocation = (lat: number, lon: number): Observable<LocationResponse> => {
    return this.http.get<LocationResponse>(`${this.OPEN_WEATHER_API_BASEURL}/location?lat=${lat}&lon=${lon}`);
  };
}
