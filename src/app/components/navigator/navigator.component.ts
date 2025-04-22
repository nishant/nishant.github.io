import { Component } from '@angular/core';
import { Category } from '../jp-list/typings';

@Component({
  selector: 'app-navigator',
  templateUrl: './navigator.component.html',
  styleUrls: ['./navigator.component.scss']
})
export class NavigatorComponent {
  categories: Array<Category> = [
    {text: 'Streaming', icon: 'play_arrow'},
    {text: 'Manga', icon: 'dashboard'},
    {text: 'Novels', icon: 'library_books'},
    {text: 'Schedules', icon: 'calendar_month'},
    {text: 'Information', icon: 'info'},
    {text: 'Guides', icon: 'developer_guide'},
    {text: 'Downloads', icon: 'download'},
    {text: 'Tools', icon: 'construction'},
  ];

  scrollToSection = (text: string): void => {
    const allSections = document.getElementsByClassName('section-container');
    const section = document.getElementById(text);
    Array.from(allSections).forEach(e => e.classList.remove('highlighted'));
    section?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    section?.classList.add('highlighted');
  };
}
