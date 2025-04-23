import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NotesService {
  content = '';
  action = new BehaviorSubject('');
}
