import { Component, Input } from '@angular/core';
import { Link, LinkType } from '../typings';
import { NgFor, NgOptimizedImage } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-section',
  templateUrl: './section.component.html',
  styleUrls: ['./section.component.scss'],
  standalone: true,
  imports: [MatCardModule, MatDividerModule, MatListModule, NgFor, NgOptimizedImage],
})
export class SectionComponent {
  GOOGLE_FAVICON_CACHE_URL = 'https://www.google.com/s2/favicons?domain=';
  @Input() links: Array<Link> = [];
  @Input() icon = '';
  @Input() heading: LinkType | string = '';
  getFavicon = (url: string): string => this.GOOGLE_FAVICON_CACHE_URL + url;
}
