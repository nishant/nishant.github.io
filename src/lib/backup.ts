import { getThemeChoice, isThemeName, setThemeChoice, toast } from '@nish/ui';
import { applyFont, FONTS } from './font';
import { loadFont, loadNotes, parseConfig, saveFont, saveNotes, type Config } from './storage';

export interface SettingsBundle {
  app: 'start';
  v: 1;
  exportedAt: string;
  config: Config;
  /** One of FONTS[].family. */
  font?: string;
  /** A ThemeChoice: 'system' or a theme name. */
  theme?: string;
  /** Notes HTML; file exports only. */
  notes?: string;
}

export interface CustomBang {
  bang: string;
  name: string;
  url: string;
}

export type BundleResult = { ok: true; bundle: SettingsBundle } | { ok: false; error: string };

export const SHARE_MAX = 30000;
export const NOTES_MAX = 1_000_000;
export const FILE_MAX_BYTES = 2 * 1024 * 1024;
export const SHARE_TOO_BIG = 'Too many links for a share link. Download a file instead.';

const NOT_BACKUP = "That file isn't a Start backup.";
const NOT_JSON = "That file isn't a Start backup (it isn't valid JSON).";
const BROKEN_LINK = 'That share link is broken or incomplete.';

export function buildBundle({ config, includeNotes }: { config: Config; includeNotes: boolean }): SettingsBundle {
  const bundle: SettingsBundle = {
    app: 'start',
    v: 1,
    exportedAt: new Date().toISOString(),
    config,
    font: loadFont(),
    theme: getThemeChoice(),
  };
  if (includeNotes) {
    const notes = loadNotes();
    if (notes) bundle.notes = notes;
  }
  return bundle;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseBundle(text: string, opts: { allowNotes?: boolean } = {}): BundleResult {
  const allowNotes = opts.allowNotes ?? true;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: NOT_JSON };
  }
  if (!isRecord(data)) return { ok: false, error: NOT_BACKUP };

  let configSource: unknown;
  let extras: Record<string, unknown> = {};
  let exportedAt = new Date().toISOString();
  if (data['app'] === undefined && 'sections' in data) {
    configSource = data;
  } else {
    if (data['app'] !== 'start' || data['v'] !== 1) return { ok: false, error: NOT_BACKUP };
    configSource = data['config'];
    extras = data;
    if (typeof data['exportedAt'] === 'string') exportedAt = data['exportedAt'];
  }

  const parsed = parseConfig(JSON.stringify(configSource));
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const bundle: SettingsBundle = { app: 'start', v: 1, exportedAt, config: parsed.config };
  const font = extras['font'];
  if (typeof font === 'string' && FONTS.some((f) => f.family === font)) bundle.font = font;
  const theme = extras['theme'];
  if (typeof theme === 'string' && (theme === 'system' || isThemeName(theme))) bundle.theme = theme;
  const notes = extras['notes'];
  if (allowNotes && typeof notes === 'string' && notes.length <= NOTES_MAX) bundle.notes = notes;
  return { ok: true, bundle };
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function themeLabel(theme: string): string {
  return theme.charAt(0).toUpperCase() + theme.slice(1);
}

export function summarize(b: SettingsBundle): string {
  const sections = b.config.sections;
  const links = sections.reduce((n, s) => n + s.links.length, 0);
  const parts = [`${plural(sections.length, 'section', 'sections')}, ${plural(links, 'link', 'links')}`];
  if (b.font) parts.push(`Font: ${b.font}`);
  if (b.theme) parts.push(`Theme: ${themeLabel(b.theme)}`);
  if (b.notes) parts.push('Notes included');
  return parts.join(' · ');
}

/** Replaces the current settings. Storage errors bubble. */
export function applyBundle(b: SettingsBundle, setConfig: (c: Config) => void): void {
  setConfig(b.config);
  if (b.font) {
    saveFont(b.font);
    applyFont(b.font);
  }
  if (b.theme) setThemeChoice(b.theme);
  if (b.notes !== undefined) saveNotes(b.notes);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function downloadBundle(b: SettingsBundle): void {
  const now = new Date();
  const name = `start-settings-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(
  bytes: Uint8Array,
  stream: { writable: WritableStream; readable: ReadableStream },
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(bytes as unknown as BufferSource).catch(() => undefined);
  void writer.close().catch(() => undefined);
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

/** Share code: `1.` + deflate-raw when CompressionStream exists, else `0.` + plain. Notes are never included. */
export async function encodeShare(b: SettingsBundle): Promise<string> {
  const { notes: _notes, ...rest } = b;
  const bytes = new TextEncoder().encode(JSON.stringify(rest));
  if (typeof CompressionStream !== 'undefined') {
    try {
      return `1.${toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')))}`;
    } catch {
      // Fall through to the uncompressed form.
    }
  }
  return `0.${toBase64Url(bytes)}`;
}

export async function decodeShare(code: string): Promise<BundleResult> {
  const broken: BundleResult = { ok: false, error: BROKEN_LINK };
  if (!/^[01]\.[A-Za-z0-9_-]+$/.test(code)) return broken;
  try {
    let bytes = fromBase64Url(code.slice(2));
    if (code.startsWith('1.')) {
      if (typeof DecompressionStream === 'undefined') return broken;
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    }
    return parseBundle(new TextDecoder().decode(bytes), { allowNotes: false });
  } catch {
    return broken;
  }
}

export function shareUrl(code: string): string {
  return `${location.origin}${location.pathname}#/home?settings=${code}`;
}

/** The `settings` value of a hash like `#/home?settings=1.abc`, only if it looks like a share code. */
export function shareParam(hash: string): string | null {
  const q = hash.indexOf('?');
  if (q === -1) return null;
  const value = new URLSearchParams(hash.slice(q + 1)).get('settings');
  return value !== null && /^[01]\.[A-Za-z0-9_-]+$/.test(value) ? value : null;
}

/** Builds the share link and copies it. `copied` is false when the clipboard refused, so the caller can show the
 *  link to copy by hand. Throws (after a toast) when the link is too long. */
export async function copyShareLink(config: Config): Promise<{ link: string; copied: boolean }> {
  const code = await encodeShare(buildBundle({ config, includeNotes: false }));
  if (code.length > SHARE_MAX) {
    toast.error(SHARE_TOO_BIG);
    throw new Error(SHARE_TOO_BIG);
  }
  const link = shareUrl(code);
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    return { link, copied: false };
  }
  toast.success('Share link copied');
  return { link, copied: true };
}
