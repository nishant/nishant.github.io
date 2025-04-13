import { Component, inject, OnDestroy, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Config } from '../../config/config';
import configJson from '../../config/config.json';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  isNotesOpen = false;
  isWeatherOpen = false
  isStocksOpen = false;

  config?: Config;

  alertMessage = inject(MatSnackBar);
  dialog = inject(MatDialog);

  @ViewChild('notes', { static: true }) notes?: TemplateRef<any>;

  GOOGLE_FAVICON_CACHE_URL = 'https://www.google.com/s2/favicons?domain=';

  constructor(public router: Router) {}

  ngOnInit() {
    this.config = configJson
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

  alert = (message: string) => this.alertMessage.open(message, 'Dismiss');

  getFavicon = (url: string): string => this.GOOGLE_FAVICON_CACHE_URL + url;
}
