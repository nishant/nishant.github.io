import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import defaultConfigJson from '../../config/config.json';
import { LOCAL_STORAGE_CONFIG_KEY, LOCAL_STORAGE_FONT_KEY } from '../../constants';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  config = new BehaviorSubject(localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY) ?? JSON.stringify(defaultConfigJson));
  onClose = new BehaviorSubject('');
  font = new BehaviorSubject(localStorage.getItem(LOCAL_STORAGE_FONT_KEY) ?? 'Fira Code');
}
