import { Component, inject, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Config } from '../../config/config';
import defaultConfigJson from '../../config/config.json';
import { confirmDialog, showToast } from '@nish/ui/theme';
import { MatDialog } from '@angular/material/dialog';
import { SettingsService } from '../settings/settings.service';
import { NotesComponent } from '../notes/notes.component';
import { NotesService } from '../notes/notes.service';
import { GoogleService } from '../../services/google.service';
import { WeatherComponent } from '../weather/weather.component';
import { SettingsComponent } from '../settings/settings.component';
import { GoogleSigninButtonModule } from '@abacritt/angularx-social-login';
import { NgFor, NgOptimizedImage } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { LOCAL_STORAGE_CONFIG_KEY, LOCAL_STORAGE_FONT_KEY } from '../../constants';
import { EmailComponent } from '../email/email.component';
import { filter } from 'rxjs';

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
    EmailComponent,
  ],
})
export class HomeComponent implements OnInit {
  isNotesOpen = false;
  isWeatherOpen = false;
  isStocksOpen = false;
  isEmailOpen = false;
  isSettingsOpen = false;

  config?: Config;

  dialog = inject(MatDialog);
  notesService = inject(NotesService);

  @ViewChild('notes', { static: true }) notes?: TemplateRef<unknown>;
  @ViewChild('settings', { static: true }) settings?: TemplateRef<unknown>;
  @ViewChild('weather', { static: true }) weather?: TemplateRef<unknown>;
  @ViewChild('email', { static: true }) email?: TemplateRef<unknown>;

  GOOGLE_FAVICON_CACHE_URL = 'https://www.google.com/s2/favicons?domain=';

  constructor(
    public router: Router,
    private settingsService: SettingsService,
    private googleService: GoogleService,
  ) {}

  ngOnInit(): void {
    this.setConfig();
    this.applyFont();
    this.getGoogleData();
  }

  applyFont = (): void => {
    document.querySelectorAll('*:not(.material-symbols-outlined)').forEach((x) => {
      (x as HTMLElement).style.fontFamily =
        localStorage.getItem(LOCAL_STORAGE_FONT_KEY) ?? this.settingsService.font.value + ', monospace';
    });
  };

  /** Notes ask whether to save before they close. The dialog cannot close by itself
   *  (disableClose): a backdrop click or Escape awaits the question first, saves while the
   *  editor is still mounted, then closes. Same outcomes as the old window.confirm: Save and
   *  close, or close without saving. */
  toggleNotes = (): void => {
    if (this.isNotesOpen) return;
    this.isNotesOpen = true;
    const ref = this.dialog.open(this.notes!, { disableClose: true });
    let asking = false;
    const requestClose = async (): Promise<void> => {
      if (asking) return;
      asking = true;
      const save = await confirmDialog({
        title: 'Do you want to save before closing?',
        confirmLabel: 'Save',
        cancelLabel: 'Close without saving',
      });
      if (save) this.notesService.action.next('save');
      ref.close();
    };
    ref.backdropClick().subscribe(() => void requestClose());
    ref
      .keydownEvents()
      .pipe(filter((e) => e.key === 'Escape'))
      .subscribe((e) => {
        e.preventDefault();
        void requestClose();
      });
    ref.afterClosed().subscribe(() => (this.isNotesOpen = false));
  };

  getGoogleData = (): void => {
    this.googleService.authState.subscribe(async (user) => {
      console.log('sign in successful', user);
      await this.googleService.getAccessToken();
      if (user) {
        (<HTMLDivElement>document.getElementById('login-btn')).style.display = 'none';
        (<HTMLDivElement>document.getElementById('apps-container')).style.marginBottom = '64px';
      }
      // this.googleService.getGoogleCalendarData()?.subscribe((events) => {
      //   console.log('events', events);
      // });
    });
  };

  toggleWeather = (): void => {
    this.isWeatherOpen = !this.isWeatherOpen;
    if (this.isWeatherOpen) {
      this.dialog
        .open(this.weather!)
        .afterClosed()
        .subscribe(() => (this.isWeatherOpen = !this.isWeatherOpen));
    }
  };

  toggleStocks = (): void => {
    this.isStocksOpen = !this.isStocksOpen;
    this.alert('Stocks is coming soon.');
  };

  toggleEmail = (): void => {
    this.isEmailOpen = !this.isEmailOpen;
    if (this.isEmailOpen) {
      this.dialog
        .open(this.email!)
        .afterClosed()
        .subscribe(() => (this.isEmailOpen = !this.isEmailOpen));
    }
  };

  toggleSettings = (): void => {
    this.isSettingsOpen = !this.isSettingsOpen;
    if (this.isSettingsOpen) {
      this.dialog
        .open(this.settings!)
        .afterClosed()
        .subscribe(() => {
          this.settingsService.onClose.next('closed');
          this.config = JSON.parse(this.settingsService.config.value);
          this.saveConfig();
          this.setConfig();
          this.saveFont();
          this.applyFont();
          this.isSettingsOpen = !this.isSettingsOpen;
        });
    }
  };

  alert = (message: string): (() => void) => showToast(message, { tone: 'info' });

  getFavicon = (url: string): string => this.GOOGLE_FAVICON_CACHE_URL + url;

  saveConfig = (): void => localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, this.prettify(this.config));

  setConfig = (): void => {
    const savedConfig = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY) ?? this.prettify(defaultConfigJson);
    this.config = JSON.parse(savedConfig);
    this.saveConfig();
  };

  saveFont = (): void => {
    localStorage.setItem(LOCAL_STORAGE_FONT_KEY, this.settingsService.font.value);
  };

  prettify = (obj: unknown): string => JSON.stringify(obj, null, '\t');

  onSearch = (): void => {
    window.location.href =
      'https://google.com/search?q=' + (document.getElementById('search') as HTMLInputElement).value;
  };

  signOut = async (): Promise<void> => {
    await this.googleService.signOut().catch((e) => {
      console.error('Error signing out:', e);
    });
    console.log('Signed out successfully');
  };
}
