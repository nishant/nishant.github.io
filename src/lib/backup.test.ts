import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyBundle,
  buildBundle,
  decodeShare,
  encodeShare,
  parseBundle,
  shareParam,
  summarize,
  type SettingsBundle,
} from './backup';
import { saveNotes, type Config } from './storage';

const config: Config = {
  sections: [
    {
      header: 'Dev',
      links: [
        { text: 'GitHub', url: 'https://github.com' },
        { text: 'MDN', url: 'https://developer.mozilla.org' },
      ],
    },
    { header: 'News', links: [{ text: 'HN', url: 'https://news.ycombinator.com' }] },
  ],
};

function bundle(extra: Partial<SettingsBundle> = {}): SettingsBundle {
  return { app: 'start', v: 1, exportedAt: '2026-10-31T00:00:00.000Z', config, ...extra };
}

function b64url(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('share codes', () => {
  it('round-trips (compressed when CompressionStream works)', async () => {
    const code = await encodeShare(bundle({ font: 'Roboto', theme: 'dark' }));
    expect(code).toMatch(/^[01]\.[A-Za-z0-9_-]+$/);
    const r = await decodeShare(code);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.bundle.config).toEqual(config);
      expect(r.bundle.font).toBe('Roboto');
      expect(r.bundle.theme).toBe('dark');
    }
  });

  it('round-trips with the plain 0. path when CompressionStream is missing', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    const code = await encodeShare(bundle({ font: 'Roboto' }));
    expect(code.startsWith('0.')).toBe(true);
    const r = await decodeShare(code);
    expect(r.ok && r.bundle.config).toEqual(config);
  });

  it('drops notes from share codes', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    const code = await encodeShare(bundle({ notes: '<p>secret</p>' }));
    const json = atob(code.slice(2).replace(/-/g, '+').replace(/_/g, '/'));
    expect(json).not.toContain('secret');
    const r = await decodeShare(code);
    expect(r.ok && r.bundle.notes).toBeUndefined();
  });

  it('ignores notes even if a hand-made code carries them', async () => {
    const code = `0.${b64url(JSON.stringify(bundle({ notes: '<p>x</p>' })))}`;
    const r = await decodeShare(code);
    expect(r.ok).toBe(true);
    expect(r.ok && r.bundle.notes).toBeUndefined();
  });

  it('rejects a broken code', async () => {
    expect((await decodeShare('1.AAAA')).ok).toBe(false);
    expect((await decodeShare('nope')).ok).toBe(false);
  });
});

describe('parseBundle', () => {
  it('accepts a config-only file', () => {
    const r = parseBundle(JSON.stringify(config));
    expect(r.ok && r.bundle.config.sections).toHaveLength(2);
    expect(r.ok && r.bundle.font).toBeUndefined();
  });

  it('drops a bad font or theme but keeps the rest', () => {
    const r = parseBundle(JSON.stringify(bundle({ font: 'Comic Sans', theme: 'nope-theme' })));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.bundle.font).toBeUndefined();
      expect(r.bundle.theme).toBeUndefined();
      expect(r.bundle.config).toEqual(config);
    }
  });

  it('keeps a known font, system and named themes, and notes when allowed', () => {
    const r = parseBundle(JSON.stringify(bundle({ font: 'Arial', theme: 'system', notes: '<p>hi</p>' })));
    expect(r.ok && [r.bundle.font, r.bundle.theme, r.bundle.notes]).toEqual(['Arial', 'system', '<p>hi</p>']);
    const no = parseBundle(JSON.stringify(bundle({ notes: '<p>hi</p>' })), { allowNotes: false });
    expect(no.ok && no.bundle.notes).toBeUndefined();
  });

  it('explains invalid JSON and foreign files', () => {
    expect(parseBundle('{oops')).toEqual({ ok: false, error: "That file isn't a Start backup (it isn't valid JSON)." });
    expect(parseBundle('{"app":"other","v":1}')).toEqual({ ok: false, error: "That file isn't a Start backup." });
    expect(parseBundle('{"app":"start","v":2}').ok).toBe(false);
    expect(parseBundle('[1]').ok).toBe(false);
  });

  it('passes a config error through', () => {
    const r = parseBundle(JSON.stringify({ app: 'start', v: 1, config: { sections: 5 } }));
    expect(r).toEqual({ ok: false, error: '"sections" must be a list.' });
  });
});

describe('shareParam', () => {
  it('reads a valid code and rejects junk', () => {
    expect(shareParam('#/home?settings=1.abc_-9')).toBe('1.abc_-9');
    expect(shareParam('#/home?settings=0.AbC')).toBe('0.AbC');
    expect(shareParam('#/home')).toBeNull();
    expect(shareParam('#/home?settings=2.abc')).toBeNull();
    expect(shareParam('#/home?settings=1.a b')).toBeNull();
    expect(shareParam('#/home?settings=1.')).toBeNull();
    expect(shareParam('#/home?settings=<script>')).toBeNull();
  });
});

describe('summarize', () => {
  it('uses singular and plural forms and omits absent parts', () => {
    const one = bundle({ config: { sections: [{ header: 'A', links: [{ text: 'a', url: 'https://a.com' }] }] } });
    expect(summarize(one)).toBe('1 section, 1 link');
    expect(summarize(bundle({ font: 'Fira Code', theme: 'dark', notes: 'x' }))).toBe(
      '2 sections, 3 links · Font: Fira Code · Theme: Dark · Notes included',
    );
  });
});

describe('buildBundle and applyBundle', () => {
  it('includes notes only when asked and non-empty', () => {
    expect(buildBundle({ config, includeNotes: true }).notes).toBeUndefined();
    saveNotes('<p>n</p>');
    expect(buildBundle({ config, includeNotes: true }).notes).toBe('<p>n</p>');
    expect(buildBundle({ config, includeNotes: false }).notes).toBeUndefined();
  });

  it('applies config, font and notes', () => {
    const setConfig = vi.fn();
    applyBundle(bundle({ font: 'Roboto', notes: '<p>z</p>' }), setConfig);
    expect(setConfig).toHaveBeenCalledWith(config);
    expect(localStorage.getItem('nishant.github.io-font')).toBe('Roboto');
    expect(localStorage.getItem('nishant.github.io-notes')).toBe('<p>z</p>');
  });
});
