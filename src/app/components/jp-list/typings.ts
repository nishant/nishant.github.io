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
