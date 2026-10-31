import { loadFont } from './storage';

export const FONTS: { family: string; source: 'bundled' | 'system' }[] = [
  { family: 'Fira Code', source: 'bundled' },
  { family: 'Roboto', source: 'bundled' },
  { family: 'Helvetica', source: 'system' },
  { family: 'Verdana', source: 'system' },
  { family: 'Times', source: 'system' },
  { family: 'Times New Roman', source: 'system' },
  { family: 'Courier', source: 'system' },
  { family: 'Courier New', source: 'system' },
  { family: 'Arial', source: 'system' },
  { family: 'Arial Narrow', source: 'system' },
];

function fallbackFor(family: string): string {
  return family === 'Fira Code' || family.startsWith('Courier') ? 'ui-monospace, monospace' : 'system-ui, sans-serif';
}

let robotoRequested = false;

/** Loads a self-hosted font's CSS. Fira Code ships in the main CSS; Roboto loads on first use. */
export function loadBundledFont(family: string): void {
  if (family !== 'Roboto' || robotoRequested) return;
  robotoRequested = true;
  import('@fontsource-variable/roboto').catch(() => {
    // Offline: stay on the fallback and allow a retry on the next pick.
    robotoRequested = false;
  });
}

/** The CSS font-family stack for a font. Keep the inline script in index.html in step with this. */
export function fontStack(family: string): string {
  if (family === 'Fira Code') return `'Fira Code Variable', 'Fira Code', ${fallbackFor(family)}`;
  if (family === 'Roboto') return `'Roboto Variable', 'Roboto', ${fallbackFor(family)}`;
  return `'${family}', ${fallbackFor(family)}`;
}

export function applyFont(family: string): void {
  document.documentElement.style.setProperty('--app-font', fontStack(family));
  loadBundledFont(family);
}

/** Applies the saved font (the inline script in index.html already did, before first paint). */
export function applyStoredFont(): void {
  applyFont(loadFont());
}

let probe: CanvasRenderingContext2D | null | undefined;
const SAMPLE = 'mmmmmmmmmmlliWWQ@#0123 The quick brown fox';

/** True when the family is installed (or loaded): its text measures differently from the bare fallbacks. */
export function fontAvailable(family: string): boolean {
  try {
    if (probe === undefined) probe = document.createElement('canvas').getContext('2d');
    const ctx = probe;
    if (!ctx) return true;
    const width = (stack: string): number => {
      ctx.font = `72px ${stack}`;
      return ctx.measureText(SAMPLE).width;
    };
    return ['monospace', 'serif'].some((base) => width(`"${family}", ${base}`) !== width(base));
  } catch {
    return false;
  }
}
