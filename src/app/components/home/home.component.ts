import { Component, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Config } from '../../config/config';
import defaultConfigJson from '../../config/config.json';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { SettingsService } from '../settings/settings.service';
import { NotesComponent } from '../notes/notes.component';
import { GoogleService } from '../../services/google.service';
import { WeatherComponent } from '../weather/weather.component';
import { SettingsComponent } from '../settings/settings.component';
import { GoogleSigninButtonModule } from '@abacritt/angularx-social-login';
import { NgFor, NgOptimizedImage } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss'],
    standalone: true,
    imports: [
        ReactiveFormsModule,
        FormsModule,
        NgFor,
        NgOptimizedImage,
        GoogleSigninButtonModule,
        NotesComponent,
        SettingsComponent,
        WeatherComponent,
    ],
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


  constructor(
    public router: Router,
    private settingsService: SettingsService,
    private googleService: GoogleService,
  ) {}

  ngOnInit(): void {
    this.setConfig();
    document.querySelectorAll('*:not(.material-symbols-outlined)').forEach(x => {
      (x as HTMLElement).style.fontFamily = localStorage.getItem('nishant.github.io-font') ?? this.settingsService.font.value + ', monospace';
    });

    this.googleService.authState.subscribe(async (user) => {
      console.log('sign in successful', user);
      await this.googleService.getAccessToken();
      this.googleService.getGmailMessages()?.subscribe(x => {
        console.log(x);
      });
      this.googleService.getGoogleCalendarData();
    });
  }

  toggleNotes = (): void => {
    this.isNotesOpen = !this.isNotesOpen;
    if (this.isNotesOpen) {
      this.dialog.open(this.notes!).beforeClosed().subscribe(() => {
        if (confirm("Do you want to save before closing?")) {
          console.log("User saved");
          this._notes?.saveContent();
        } else {
          console.log("User didnt save");
        }
        this.isNotesOpen = !this.isNotesOpen;
      });
    }
  };

  toggleWeather = (): void => {
    this.isWeatherOpen = !this.isWeatherOpen;
    if (this.isWeatherOpen) {
      this.dialog.open(this.weather!).afterClosed().subscribe(() => this.isWeatherOpen = !this.isWeatherOpen);
    }
    // this.alert('Weather is coming soon.')
  };

  toggleStocks = (): void => {
    this.isStocksOpen = !this.isStocksOpen;
    this.alert('Stocks is coming soon.');
  };

  toggleSettings = (): void => {
    this.isSettingsOpen = !this.isSettingsOpen;
    if (this.isSettingsOpen) {
      this.dialog.open(this.settings!).afterClosed().subscribe(() => {
        this.settingsService.onClose.next('closed');
        this.config = JSON.parse(this.settingsService.config.value);
        this.saveConfig();
        this.setConfig();
        this.saveFont();
        document.querySelectorAll('*:not(.material-symbols-outlined)').forEach(x => {
          (x as HTMLElement).style.fontFamily = localStorage.getItem('nishant.github.io-font') ?? this.settingsService.font.value + ', monospace';
        });
        this.isSettingsOpen = !this.isSettingsOpen;
      });
    }
  };

  alert = (message: string): MatSnackBarRef<TextOnlySnackBar> => this.alertMessage.open(message, 'Dismiss');

  getFavicon = (url: string): string => this.GOOGLE_FAVICON_CACHE_URL + url;

  saveConfig = (): void => localStorage.setItem('nishant.github.io-config', this.prettify(this.config));

  setConfig = (): void => {
    const savedConfig = localStorage.getItem('nishant.github.io-config') ?? this.prettify(defaultConfigJson);
    this.config = JSON.parse(savedConfig);
    this.saveConfig();
  };

  saveFont = (): void => {
    localStorage.setItem('nishant.github.io-font', this.settingsService.font.value);
  };

  prettify = (obj: unknown): string => JSON.stringify(obj, null, '\t');

  onSearch = (): void => {
    window.location.href = 'https://google.com/search?q=' + (document.getElementById('search') as HTMLInputElement).value;
  };

   signOut = async (): Promise<void> => {
    await this.googleService.signOut().catch((e) => {
      console.error('Error signing out:', e);
    });
    console.log('Signed out successfully');
  };
}
