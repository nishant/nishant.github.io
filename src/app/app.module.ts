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

@NgModule({
  declarations: [
    AppComponent,
    JpListComponent,
    SectionComponent,
    FooterComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatDividerModule,
    MatListModule,
    MatIconModule,
    MatLineModule,
    NgOptimizedImage,
    MatCardModule,
    MatTableModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
