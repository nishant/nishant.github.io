import { Injectable } from '@angular/core';
import { GoogleLoginProvider, SocialAuthService, SocialUser } from '@abacritt/angularx-social-login';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GoogleService {
  private accessToken = '';


  constructor(
    private http: HttpClient,
    private authService: SocialAuthService
  ) { }

  signOut(): Promise<void> {
    return this.authService.signOut();
  }

  async getAccessToken(): Promise<void> {
    this.accessToken = await this.authService.getAccessToken(GoogleLoginProvider.PROVIDER_ID);
    console.log(this.accessToken);
  }

  getGmailMessages = (): Observable<unknown> | void => {
    if (!this.accessToken) return;

    return this.http.get('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
      headers: {
        Authorization: `Bearer ${this.accessToken}`
      }
    });
  };

  getGoogleCalendarData(): void {
    if (!this.accessToken) return;

    this.http
      .get('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      })
      .subscribe((events) => {
        console.log('events', events);
      });
  }

  get authState(): Observable<SocialUser> {
    return this.authService.authState;
  }
}
