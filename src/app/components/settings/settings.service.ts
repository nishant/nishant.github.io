import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import defaultConfigJson from '../../config/config.json';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  config = new BehaviorSubject(localStorage.getItem('nishant.github.io-config') ?? JSON.stringify(defaultConfigJson));
  onClose = new BehaviorSubject('');
  font = new BehaviorSubject(localStorage.getItem('nishant.github.io-font') ?? 'Fira Code');
}
