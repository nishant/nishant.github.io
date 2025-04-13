import { Injectable, OnInit } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import defaultConfigJson from '../../config/config.json';


@Injectable({
  providedIn: 'root'
})
export class SettingsService implements OnInit {
  config = new BehaviorSubject(localStorage.getItem('nishant.github.io-config') ?? JSON.stringify(defaultConfigJson));
  onClose = new BehaviorSubject('');
  constructor() { }

  ngOnInit(): void {

  }
}
