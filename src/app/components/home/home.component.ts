import { Component, inject, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Config } from '../../config/config';
import defaultConfigJson from '../../config/config.json';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { config } from 'rxjs';
import { SettingsService } from '../settings/settings.service';
import { NotesComponent } from '../notes/notes.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  isNotesOpen = false;
  isWeatherOpen = false;
  isStocksOpen = false;
  isSettingsOpen = false;

  config?: Config;

  alertMessage = inject(MatSnackBar);
  dialog = inject(MatDialog);

  @ViewChild('notes', { static: true }) notes?: TemplateRef<unknown>;
  @ViewChild(NotesComponent) _notes?: NotesComponent;
  @ViewChild('settings', { static: true }) settings?: TemplateRef<unknown>;
  @ViewChild('weather', { static: true }) weather?: TemplateRef<unknown>;

  GOOGLE_FAVICON_CACHE_URL = 'https://www.google.com/s2/favicons?domain=';

  constructor(public router: Router, private settingsService: SettingsService) {}

  ngOnInit() {
    this.setConfig();
    document.querySelectorAll('*:not(.material-symbols-outlined)').forEach(x => {
      (x as HTMLElement).style.fontFamily = localStorage.getItem('nishant.github.io-font') ?? this.settingsService.font.value + ', monospace'
    });
  }

  toggleNotes = () => {
    this.isNotesOpen = !this.isNotesOpen;
    if (this.isNotesOpen) {
      this.dialog.open(this.notes!).beforeClosed().subscribe(() => {
        if (confirm("Do you want to save before closing?")) {
          console.log("User saved");
          this._notes?.saveContent();
        } else {
          console.log("User didnt save");
        }
        this.isNotesOpen = !this.isNotesOpen
      });
    }
  }

  toggleWeather = () => {
    this.isWeatherOpen = !this.isWeatherOpen;
    if (this.isWeatherOpen) {
      this.dialog.open(this.weather!).afterClosed().subscribe(() => this.isWeatherOpen = !this.isWeatherOpen);
    }
    // this.alert('Weather is coming soon.')
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
        this.saveFont();
        document.querySelectorAll('*:not(.material-symbols-outlined)').forEach(x => {
          (x as HTMLElement).style.fontFamily = localStorage.getItem('nishant.github.io-font') ?? this.settingsService.font.value + ', monospace'
        });
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

  saveFont = (): void => {
    localStorage.setItem('nishant.github.io-font', this.settingsService.font.value);
  }

  prettify = (obj: unknown) => JSON.stringify(obj, null, '\t');

  onSearch = () => {
    window.location.replace('https://google.com/search?q=' + (<HTMLInputElement> document.getElementById('search')).value)
  }
}
