import { Injectable } from '@angular/core';
import { GoogleLoginProvider, SocialAuthService, SocialUser } from '@abacritt/angularx-social-login';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { CachedAccessToken, GmailMessageResponse, GmailMessagesResponse } from './typings';
import { LOCAL_STORAGE_GOOGLE_ACCESS_TOKEN } from '../constants';

@Injectable({
  providedIn: 'root',
})
export class GoogleService {
  private readonly GMAIL_MESSAGES_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
  private readonly GOOGLE_CALENDAR_EVENTS_ENDPOINT = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  private accessToken = this.getCachedAccessToken();

  constructor(
    private http: HttpClient,
    private authService: SocialAuthService,
  ) {}

  signOut(): Promise<void> {
    return this.authService.signOut();
  }

  getCachedAccessToken(): string {
    const cached = localStorage.getItem(LOCAL_STORAGE_GOOGLE_ACCESS_TOKEN);
    if (cached) {
      return (<CachedAccessToken>JSON.parse(cached)).accessToken;
    } else {
      return '';
    }
  }

  async getAccessToken(): Promise<void> {
    let cachedToken = null;
    const cached = localStorage.getItem(LOCAL_STORAGE_GOOGLE_ACCESS_TOKEN);

    if (cached) {
      cachedToken = <CachedAccessToken>JSON.parse(cached);
    }

    // 1 hour cache
    if (!!cachedToken && Date.now() <= cachedToken.timestamp + 60000 * 60) {
      this.accessToken = cachedToken.accessToken;
    } else {
      this.accessToken = await this.authService.getAccessToken(GoogleLoginProvider.PROVIDER_ID);
      this.saveAccessToken();
    }
  }

  getGmailMessageIds = (): Observable<GmailMessagesResponse> | void => {
    if (!this.accessToken) return;

    return this.http.get<GmailMessagesResponse>(this.GMAIL_MESSAGES_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  };

  getGmailMessage = (id: string): Observable<GmailMessageResponse> => {
    if (!this.accessToken) return of();

    return this.http.get<GmailMessageResponse>(`${this.GMAIL_MESSAGES_ENDPOINT}/${id}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  };

  getGoogleCalendarData(): Observable<unknown> | void {
    if (!this.accessToken) return;

    return this.http.get(this.GOOGLE_CALENDAR_EVENTS_ENDPOINT, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
  }

  get authState(): Observable<SocialUser> {
    return this.authService.authState;
  }

  saveAccessToken = (): void => {
    localStorage.setItem(
      LOCAL_STORAGE_GOOGLE_ACCESS_TOKEN,
      JSON.stringify(<CachedAccessToken>{
        accessToken: this.accessToken,
        timestamp: Date.now(),
      }),
    );
  };
}
