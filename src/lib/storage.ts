import defaultConfig from './default-config.json';

export const KEYS = {
  config: 'nishant.github.io-config',
  notes: 'nishant.github.io-notes',
  font: 'nishant.github.io-font',
  googleToken: 'nishant.github.io-google-access-token',
} as const;

export interface LinkItem {
  text: string;
  url: string;
}
export interface Section {
  header: string;
  links: LinkItem[];
}
/** Unknown top-level keys are preserved. */
export interface Config {
  sections: Section[];
  [extra: string]: unknown;
}

export const DEFAULT_CONFIG: Config = defaultConfig as Config;

const WRITE_ERROR = 'Could not save: storage is full or blocked';
export const CONFIG_WARNING =
  'Your saved links could not be read, so the defaults are showing. Open Settings → Raw JSON to fix them.';

export function serializeConfig(c: Config): string {
  return JSON.stringify(c, null, '\t');
}

export type ParseResult = { ok: true; config: Config } | { ok: false; error: string; line?: number; column?: number };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Finds where `text` stops being valid JSON (V8 does not always report a position). */
function findSyntaxError(text: string): { pos: number; message: string } | null {
  let i = 0;
  const stop = (): { pos: number; message: string } => ({
    pos: Math.min(i, text.length),
    message: i >= text.length ? 'Unexpected end of JSON' : `Unexpected token ${text[i]}`,
  });
  const ws = (): void => {
    while (i < text.length && /[ \t\n\r]/.test(text[i]!)) i++;
  };
  const literal = (word: string): boolean => {
    for (const ch of word) {
      if (text[i] !== ch) return false;
      i++;
    }
    return true;
  };
  const string = (): boolean => {
    i++;
    while (i < text.length && text[i] !== '"') {
      const c = text[i]!;
      if (c < ' ') return false;
      if (c === '\\') {
        i++;
        const e = text[i];
        if (e === 'u') {
          for (let k = 1; k <= 4; k++) {
            if (!/[0-9a-fA-F]/.test(text[i + k] ?? '')) {
              i += k;
              return false;
            }
          }
          i += 4;
        } else if (e === undefined || !'"\\/bfnrt'.includes(e)) {
          return false;
        }
      }
      i++;
    }
    if (text[i] !== '"') return false;
    i++;
    return true;
  };
  const number = (): boolean => {
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
    if (!m) {
      if (text[i] === '-') i++;
      return false;
    }
    i += m[0].length;
    return true;
  };
  const value = (): boolean => {
    ws();
    const c = text[i];
    if (c === '{') {
      i++;
      ws();
      if (text[i] === '}') {
        i++;
        return true;
      }
      for (;;) {
        ws();
        if (text[i] !== '"' || !string()) return false;
        ws();
        if (text[i] !== ':') return false;
        i++;
        if (!value()) return false;
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] !== '}') return false;
        i++;
        return true;
      }
    }
    if (c === '[') {
      i++;
      ws();
      if (text[i] === ']') {
        i++;
        return true;
      }
      for (;;) {
        if (!value()) return false;
        ws();
        if (text[i] === ',') {
          i++;
          continue;
        }
        if (text[i] !== ']') return false;
        i++;
        return true;
      }
    }
    if (c === '"') return string();
    if (c === 't') return literal('true');
    if (c === 'f') return literal('false');
    if (c === 'n') return literal('null');
    if (c === '-' || (c !== undefined && c >= '0' && c <= '9')) return number();
    return false;
  };
  if (!value()) return stop();
  ws();
  if (i < text.length) return stop();
  return null;
}

/** Turns a JSON.parse failure into "Line 4, column 12: Unexpected token }". */
function describeSyntaxError(text: string, e: unknown): ParseResult {
  const found = findSyntaxError(text);
  if (!found) return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
  const before = text.slice(0, found.pos);
  const line = before.split('\n').length;
  const column = found.pos - (before.lastIndexOf('\n') + 1) + 1;
  return { ok: false, error: `Line ${line}, column ${column}: ${found.message}`, line, column };
}

function fail(error: string): ParseResult {
  return { ok: false, error };
}

export function parseConfig(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return describeSyntaxError(text, e);
  }
  if (!isRecord(data)) return fail('The config must be an object like { "sections": [] }.');
  if (!Array.isArray(data['sections'])) return fail('"sections" must be a list.');
  const sections: Section[] = [];
  for (const [i, s] of data['sections'].entries()) {
    if (!isRecord(s)) return fail(`Section ${i + 1} must be an object with a header and links.`);
    if (typeof s['header'] !== 'string') return fail(`Section ${i + 1} needs a "header" text.`);
    if (!Array.isArray(s['links'])) return fail(`Section ${i + 1} needs a "links" list.`);
    const links: LinkItem[] = [];
    for (const [j, l] of s['links'].entries()) {
      if (!isRecord(l) || typeof l['text'] !== 'string' || typeof l['url'] !== 'string') {
        return fail(`Link ${j + 1} in section ${i + 1} needs "text" and "url" text values.`);
      }
      links.push({ ...l, text: l['text'].trim(), url: l['url'].trim() } as LinkItem);
    }
    sections.push({ ...s, header: s['header'].trim(), links } as Section);
  }
  return { ok: true, config: { ...data, sections } };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    throw new Error(WRITE_ERROR);
  }
}

export function loadConfig(): { config: Config; warning?: string } {
  const raw = read(KEYS.config);
  if (raw === null) {
    try {
      saveConfig(DEFAULT_CONFIG);
    } catch {
      // Storage blocked: the defaults still show for this visit.
    }
    return { config: DEFAULT_CONFIG };
  }
  const parsed = parseConfig(raw);
  if (parsed.ok) return { config: parsed.config };
  return { config: DEFAULT_CONFIG, warning: CONFIG_WARNING };
}

export function saveConfig(c: Config): void {
  write(KEYS.config, serializeConfig(c));
}

export function loadNotes(): string {
  return read(KEYS.notes) ?? '';
}
export function saveNotes(html: string): void {
  write(KEYS.notes, html);
}

export function loadFont(): string {
  return read(KEYS.font) || 'Fira Code';
}
export function saveFont(f: string): void {
  write(KEYS.font, f);
}
