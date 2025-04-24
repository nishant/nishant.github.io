import { Component, OnInit } from '@angular/core';
import { GoogleService } from '../../services/google.service';
import { forkJoin, map, Observable } from 'rxjs';
import { AsyncPipe, JsonPipe, NgForOf, NgIf } from '@angular/common';
import { GmailMessageData } from './typings';
import { GmailMessageResponse } from '../../services/typings';

@Component({
  selector: 'app-email',
  templateUrl: './email.component.html',
  standalone: true,
  styleUrls: ['./email.component.scss'],
  imports: [AsyncPipe, JsonPipe, NgIf, NgForOf],
})
export class EmailComponent implements OnInit {
  numEmails = 25;
  requests: Array<Observable<GmailMessageResponse>> = [];
  responses$?: Observable<Array<GmailMessageData>>;

  private readonly GMAIL_INBOX_URI = 'https://mail.google.com/mail/u/0/#inbox';

  constructor(private googleService: GoogleService) {}

  getEmails = (): void => {
    this.googleService.getGmailMessageIds()?.subscribe((response) => {
      console.log(response);
      const messages = response.messages.slice(0, this.numEmails);

      messages.forEach((message) => {
        this.requests.push(this.googleService.getGmailMessage(message.id));
      });

      this.responses$ = forkJoin(this.requests).pipe(
        map((responses) =>
          responses.map((data) => {
            const filtered: GmailMessageData = {
              id: data.id,
              received: '',
              sender: data.payload.headers.find((h) => h.name === 'From')?.value.split(' <')[0],
              subject: data.payload.headers.find((h) => h.name === 'Subject')?.value,
              snippet: data.snippet,
            };
            return filtered;
          }),
        ),
      );
      this.responses$.subscribe((x) => console.log(x));
    });
  };

  openInGmail = (id: string): void => {
    window.open(`${this.GMAIL_INBOX_URI}/${id}`, '_blank')?.focus();
  };

  ngOnInit(): void {
    this.getEmails();
  }
}
