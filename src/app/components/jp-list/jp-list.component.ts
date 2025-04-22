import { Component } from '@angular/core';
import { links } from './links';
import { Link, LinkType } from './typings';
import { SectionComponent } from './section/section.component';
import { NavigatorComponent } from '../navigator/navigator.component';

@Component({
    selector: 'app-jp-list',
    templateUrl: './jp-list.component.html',
    styleUrls: ['./jp-list.component.scss'],
    standalone: true,
    imports: [NavigatorComponent, SectionComponent]
})
export class JpListComponent {
  links = links;
  getLinksByType = (linkType: LinkType): Array<Link> => {
    return links.filter(link => link.linkType === linkType);
  };
}
