import { beforeEach, describe, expect, it } from 'vitest';
import {
  CONFIG_WARNING,
  DEFAULT_CONFIG,
  KEYS,
  loadConfig,
  loadFont,
  isLegacyPlaceholder,
  loadNotes,
  normalizeUrl,
  parseConfig,
  saveConfig,
  saveFont,
  saveNotes,
  serializeConfig,
} from './storage';

beforeEach(() => localStorage.clear());

describe('serializeConfig', () => {
  it('indents with tabs, like the old app', () => {
    const text = serializeConfig({ sections: [{ header: 'A', links: [{ text: 'x', url: 'https://x.com' }] }] });
    expect(text).toBe(
      JSON.stringify({ sections: [{ header: 'A', links: [{ text: 'x', url: 'https://x.com' }] }] }, null, '\t'),
    );
    expect(text.split('\n')[1]).toBe('\t"sections": [');
  });
});

describe('parseConfig', () => {
  it('round-trips a config byte for byte', () => {
    const text = serializeConfig(DEFAULT_CONFIG);
    const r = parseConfig(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(serializeConfig(r.config)).toBe(text);
  });

  it('trims header, text and url', () => {
    const r = parseConfig('{"sections":[{"header":" H ","links":[{"text":" t ","url":" https://a.b "}]}]}');
    expect(r.ok && r.config.sections[0]).toEqual({ header: 'H', links: [{ text: 't', url: 'https://a.b' }] });
  });

  it('preserves extra keys at every level', () => {
    const r = parseConfig(
      '{"theme":"x","sections":[{"header":"H","note":1,"links":[{"text":"t","url":"u","icon":"i"}]}]}',
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config['theme']).toBe('x');
      expect(r.config.sections[0]).toMatchObject({ note: 1 });
      expect(r.config.sections[0]?.links[0]).toMatchObject({ icon: 'i' });
    }
  });

  it('reports line and column for syntax errors', () => {
    const r = parseConfig('{\n  "sections": [\n    }\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.line).toBe(3);
      expect(r.column).toBe(5);
      expect(r.error.startsWith('Line 3, column 5: ')).toBe(true);
    }
  });

  it.each([
    ['[]', 'object'],
    ['{"sections":{}}', 'sections'],
    ['{"sections":[1]}', 'Section 1'],
    ['{"sections":[{"links":[]}]}', 'header'],
    ['{"sections":[{"header":"a"}]}', 'links'],
    ['{"sections":[{"header":"a","links":[{"text":"t"}]}]}', 'Link 1'],
  ])('rejects the wrong shape %s', (text, hint) => {
    const r = parseConfig(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(hint);
  });
});

describe('loadConfig / saveConfig', () => {
  it('missing → defaults, and saves them', () => {
    const { config, warning } = loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(warning).toBeUndefined();
    expect(localStorage.getItem(KEYS.config)).toBe(serializeConfig(DEFAULT_CONFIG));
  });

  it('round-trips a saved config', () => {
    const c = { sections: [{ header: 'Z', links: [{ text: 'a', url: 'https://a.io' }] }], extra: 5 };
    saveConfig(c);
    expect(loadConfig()).toEqual({ config: c, firstVisit: false });
  });

  it('is a first visit when the key is absent, not after saving', () => {
    expect(loadConfig().firstVisit).toBe(true);
    expect(loadConfig().firstVisit).toBe(false);
  });

  it('treats the legacy placeholder as a first visit and replaces it', () => {
    saveConfig(legacy());
    const r = loadConfig();
    expect(r.firstVisit).toBe(true);
    expect(r.config).toEqual(DEFAULT_CONFIG);
    expect(localStorage.getItem(KEYS.config)).toBe(serializeConfig(DEFAULT_CONFIG));
  });

  it('invalid → defaults + warning, and does not overwrite the bad value', () => {
    localStorage.setItem(KEYS.config, '{ not json');
    const { config, warning } = loadConfig();
    expect(config).toEqual(DEFAULT_CONFIG);
    expect(warning).toBe(CONFIG_WARNING);
    expect(localStorage.getItem(KEYS.config)).toBe('{ not json');
  });

  it('a failed write throws the plain message', () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    try {
      expect(() => saveConfig(DEFAULT_CONFIG)).toThrow('Could not save: storage is full or blocked');
      expect(() => saveNotes('<p>x</p>')).toThrow('Could not save: storage is full or blocked');
      expect(() => saveFont('Roboto')).toThrow('Could not save: storage is full or blocked');
    } finally {
      Storage.prototype.setItem = orig;
    }
  });
});

describe('notes and font', () => {
  it('notes default to empty and round-trip HTML untouched', () => {
    expect(loadNotes()).toBe('');
    const html = '<h1>t</h1><p>hello <strong>x</strong></p>';
    saveNotes(html);
    expect(localStorage.getItem(KEYS.notes)).toBe(html);
    expect(loadNotes()).toBe(html);
  });

  it('font defaults to Fira Code and is stored raw', () => {
    expect(loadFont()).toBe('Fira Code');
    saveFont('Times New Roman');
    expect(localStorage.getItem(KEYS.font)).toBe('Times New Roman');
    expect(loadFont()).toBe('Times New Roman');
  });
});

function legacy() {
  return {
    sections: [1, 2, 3, 4, 5, 6].map((i) => ({
      header: `header ${i}`,
      links: [1, 2, 3, 4, 5].map((j) => ({ text: `link ${j}`, url: 'https://google.com' })),
    })),
  };
}

describe('isLegacyPlaceholder', () => {
  it('matches only the exact placeholder', () => {
    expect(isLegacyPlaceholder(legacy())).toBe(true);
    expect(isLegacyPlaceholder(DEFAULT_CONFIG)).toBe(false);
    const edited = legacy();
    edited.sections[2]!.links[0]!.url = 'https://example.com';
    expect(isLegacyPlaceholder(edited)).toBe(false);
    expect(isLegacyPlaceholder({ sections: legacy().sections.slice(0, 5) })).toBe(false);
  });
});

describe('normalizeUrl / parseConfig normalization', () => {
  it('handles host:port as a host, not a scheme', () => {
    expect(normalizeUrl('localhost:3000')).toBe('https://localhost:3000');
    expect(normalizeUrl('example.com:8080/x')).toBe('https://example.com:8080/x');
    expect(normalizeUrl('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(normalizeUrl('tel:5551234')).toBe('tel:5551234');
    expect(normalizeUrl('sms:12345')).toBe('sms:12345');
  });

  it('parseConfig normalizes urls and keeps empty ones empty', () => {
    const r = parseConfig(
      '{"sections":[{"header":"H","links":[{"text":"a","url":"example.com"},{"text":"b","url":""},{"text":"c","url":"localhost:3000"}]}]}',
    );
    expect(r.ok && r.config.sections[0]?.links.map((l) => l.url)).toEqual([
      'https://example.com',
      '',
      'https://localhost:3000',
    ]);
  });
});
