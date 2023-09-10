export interface Link {
  link: string;
  text: string;
  linkType: LinkType;
}

export type LinkType =
  'Streaming'
  | 'Schedules'
  | 'Manga'
  | 'Information'
  | 'Tools'
  | 'Guides'
  | 'Novels'
  | 'Downloads';

export interface Category {
  text: LinkType | string;
  icon: string;
}
