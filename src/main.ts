import { importProvidersFrom } from '@angular/core';
import { AppComponent } from './app/app.component';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { withInterceptorsFromDi, provideHttpClient } from '@angular/common/http';
import { NgxEditorModule } from 'ngx-editor';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { NgOptimizedImage } from '@angular/common';
import { MatLineModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app/app-routing.module';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import {
  GoogleLoginProvider,
  SocialAuthServiceConfig,
  SocialLoginModule,
  GoogleSigninButtonModule,
} from '@abacritt/angularx-social-login';
import { NGX_MONACO_EDITOR_CONFIG, NgxMonacoEditorConfig, MonacoEditorModule } from 'ngx-monaco-editor-v2';

const monacoConfig: NgxMonacoEditorConfig = {
  defaultOptions: { scrollBeyondLastLine: false },
  baseUrl: './assets',
};

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      BrowserModule,
      AppRoutingModule,
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
      // MonacoEditorModule.forRoot(),
      MonacoEditorModule,
      FormsModule,
      MatFormFieldModule,
      MatSelectModule,
      SocialLoginModule,
      GoogleSigninButtonModule,
    ),
    { provide: NGX_MONACO_EDITOR_CONFIG, useValue: monacoConfig },
    {
      provide: 'SocialAuthServiceConfig',
      useValue: {
        autoLogin: true,
        lang: 'en',
        providers: [
          {
            id: GoogleLoginProvider.PROVIDER_ID,
            provider: new GoogleLoginProvider(
              '397230737513-dk75t2mgh28b1i4v26dkbmv1uc3o8c2m.apps.googleusercontent.com',
              {
                scopes: [
                  'https://www.googleapis.com/auth/gmail.readonly',
                  'https://www.googleapis.com/auth/calendar.readonly',
                ],
                prompt: 'consent',
              },
            ),
          },
        ],
        onError: (err) => {
          console.error(err);
        },
      } as SocialAuthServiceConfig,
    },
    provideAnimations(),
    provideHttpClient(withInterceptorsFromDi()),
  ],
}).catch((err) => console.error(err));
