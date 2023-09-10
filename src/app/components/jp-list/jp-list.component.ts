import { Component } from '@angular/core';
import { links } from './links';
import { LinkType } from './typings';

@Component({
  selector: 'app-jp-list',
  templateUrl: './jp-list.component.html',
  styleUrls: ['./jp-list.component.scss']
})
export class JpListComponent {
  links = links;
  getLinksByType = (linkType: LinkType) => {
    return links.filter(link => link.linkType === linkType)
  }
}
