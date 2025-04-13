import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { JpListComponent } from './components/jp-list/jp-list.component';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatLineModule } from '@angular/material/core';
import { SectionComponent } from './components/jp-list/section/section.component';
import { NgOptimizedImage } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { FooterComponent } from './components/footer/footer.component';
import { MatTableModule } from '@angular/material/table';
import { NavigatorComponent } from './components/navigator/navigator.component';
import { HomeComponent } from './components/home/home.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgxEditorModule } from 'ngx-editor';
import { NotesComponent } from './components/notes/notes.component';
import { CustomMenuComponent } from './components/notes/custom-menu/custom-menu.component';
import { WeatherComponent } from './components/weather/weather.component';
import { HttpClientModule } from '@angular/common/http';
import { StocksComponent } from './components/stocks/stocks.component';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MonacoEditorModule, NGX_MONACO_EDITOR_CONFIG, NgxMonacoEditorConfig } from 'ngx-monaco-editor-v2';
import { SettingsComponent } from './components/settings/settings.component';

const monacoConfig: NgxMonacoEditorConfig = {
  defaultOptions: { scrollBeyondLastLine: false },
  baseUrl: './assets',
  onMonacoLoad: () => {
    const monaco = (window as any).monaco;
    console.log(monaco);
  }
};

@NgModule({
  declarations: [
    AppComponent,
    JpListComponent,
    SectionComponent,
    FooterComponent,
    NavigatorComponent,
    HomeComponent,
    NotesComponent,
    CustomMenuComponent,
    WeatherComponent,
    StocksComponent,
    SettingsComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatDividerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatListModule,
    MatIconModule,
    MatLineModule,
    NgOptimizedImage,
    MatCardModule,
    MatTableModule,
    ReactiveFormsModule,
    NgxEditorModule,
    HttpClientModule,
    // MonacoEditorModule.forRoot(),
    MonacoEditorModule,
    FormsModule,
    // use forRoot() in main app module only.
  ],
  providers: [
    { provide: NGX_MONACO_EDITOR_CONFIG, useValue: monacoConfig }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
