import { loadFont } from './storage';

export const FONTS: { family: string; source: 'google' | 'system' }[] = [
  { family: 'Fira Code', source: 'google' },
  { family: 'Roboto', source: 'google' },
  { family: 'Helvetica', source: 'system' },
  { family: 'Verdana', source: 'system' },
  { family: 'Times', source: 'system' },
  { family: 'Times New Roman', source: 'system' },
  { family: 'Courier', source: 'system' },
  { family: 'Courier New', source: 'system' },
  { family: 'Arial', source: 'system' },
  { family: 'Arial Narrow', source: 'system' },
];

const GOOGLE_CSS: Record<string, string> = {
  'Fira Code': 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap',
  Roboto: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
};

function fallbackFor(family: string): string {
  return family === 'Fira Code' || family.startsWith('Courier') ? 'ui-monospace, monospace' : 'system-ui, sans-serif';
}

function loadGoogleFont(family: string): void {
  const href = GOOGLE_CSS[family];
  if (!href) return;
  const existing = Array.from(document.head.querySelectorAll('link[rel="stylesheet"]')).some(
    (l) => l.getAttribute('href') === href,
  );
  if (existing) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute('data-app-font', family);
  document.head.appendChild(link);
}

export function applyFont(family: string): void {
  document.documentElement.style.setProperty('--app-font', `'${family}', ${fallbackFor(family)}`);
  loadGoogleFont(family);
}

/** Applies the saved font (the inline script in index.html already did, before first paint). */
export function applyStoredFont(): void {
  applyFont(loadFont());
}

export function fontAvailable(family: string): boolean {
  try {
    return document.fonts.check(`16px "${family}"`);
  } catch {
    return false;
  }
}
