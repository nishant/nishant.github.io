import { Injectable } from '@angular/core';
import { GoogleLoginProvider, SocialAuthService, SocialUser } from '@abacritt/angularx-social-login';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class GoogleService {
  private readonly GMAIL_MESSAGES_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
  private readonly GOOGLE_CALENDAR_EVENTS_ENDPOINT = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  private accessToken = '';

  constructor(
    private http: HttpClient,
    private authService: SocialAuthService,
  ) {}

  signOut(): Promise<void> {
    return this.authService.signOut();
  }

  async getAccessToken(): Promise<void> {
    this.accessToken = await this.authService.getAccessToken(GoogleLoginProvider.PROVIDER_ID);
    console.log(this.accessToken);
  }

  getGmailMessages = (): Observable<unknown> | void => {
    if (!this.accessToken) return;

    return this.http.get(this.GMAIL_MESSAGES_ENDPOINT, {
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
}
