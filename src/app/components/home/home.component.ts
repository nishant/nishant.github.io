import { Component, inject, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Config } from '../../config/config';
import defaultConfigJson from '../../config/config.json';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { config } from 'rxjs';
import { SettingsService } from '../settings/settings.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  isNotesOpen = false;
  isWeatherOpen = false
  isStocksOpen = false;
  isSettingsOpen = false;

  config?: Config;

  alertMessage = inject(MatSnackBar);
  dialog = inject(MatDialog);

  @ViewChild('notes', { static: true }) notes?: TemplateRef<unknown>;
  @ViewChild('settings', { static: true }) settings?: TemplateRef<unknown>;

  GOOGLE_FAVICON_CACHE_URL = 'https://www.google.com/s2/favicons?domain=';

  constructor(public router: Router, private settingsService: SettingsService) {}

  ngOnInit() {
    this.setConfig();
  }

  toggleNotes = () => {
    this.isNotesOpen = !this.isNotesOpen;
    if (this.isNotesOpen) {
      this.dialog.open(this.notes!).afterClosed().subscribe(() => this.isNotesOpen = !this.isNotesOpen);
    }
  }

  toggleWeather = () => {
    this.isWeatherOpen = !this.isWeatherOpen;
    this.alert('Weather is coming soon.')
  };

  toggleStocks = () => {
    this.isStocksOpen = !this.isStocksOpen;
    this.alert('Stocks is coming soon.')
  };

  toggleSettings = () => {
    this.isSettingsOpen = !this.isSettingsOpen;
    if (this.isSettingsOpen) {
      this.dialog.open(this.settings!).afterClosed().subscribe(() => {
        this.settingsService.onClose.next('closed');
        this.config = JSON.parse(this.settingsService.config.value);
        this.saveConfig();
        this.setConfig();
        this.isSettingsOpen = !this.isSettingsOpen
      });
    }
  };

  alert = (message: string) => this.alertMessage.open(message, 'Dismiss');

  getFavicon = (url: string): string => this.GOOGLE_FAVICON_CACHE_URL + url;

  saveConfig = (): void => localStorage.setItem('nishant.github.io-config', this.prettify(this.config))

  setConfig = (): void => {
    const savedConfig = localStorage.getItem('nishant.github.io-config') ?? this.prettify(defaultConfigJson);
    this.config = JSON.parse(savedConfig);
    this.saveConfig();
  }

  prettify = (obj: unknown) => JSON.stringify(obj, null, '\t');
}
