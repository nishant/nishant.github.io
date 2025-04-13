export interface Config {
  sections: Array<Section>;
}

interface Section {
  header: string;
  links: Array<Link>;
}

interface Link {
  url: string;
  text: string;
}
