import { describe, expect, it } from 'vitest';
import type { Config } from '../../lib/storage';
import {
  addLink,
  addSection,
  decideClose,
  decideSave,
  finalizeConfig,
  isDirty,
  moveItem,
  moveLink,
  moveSection,
  normalizeUrl,
  removeLink,
  removeSection,
  restoreLink,
  updateLink,
  urlError,
} from './settings-state';

const base = (): Config => ({
  sections: [
    {
      header: 'A',
      links: [
        { text: 'a1', url: 'https://a1.test' },
        { text: 'a2', url: 'https://a2.test' },
      ],
    },
    { header: 'B', links: [{ text: 'b1', url: 'https://b1.test' }] },
  ],
  extra: 1,
});

describe('reorder and delete helpers', () => {
  it('moveItem swaps and ignores out-of-range moves', () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 1, 3)).toEqual([1, 2, 3]);
  });

  it('moves sections and links without mutating', () => {
    const c = base();
    const moved = moveSection(c, 0, 1);
    expect(moved.sections.map((s) => s.header)).toEqual(['B', 'A']);
    expect(c.sections[0]?.header).toBe('A');
    expect(moveLink(c, 0, 1, 0).sections[0]?.links.map((l) => l.text)).toEqual(['a2', 'a1']);
    expect(moved.extra).toBe(1);
  });

  it('deletes and restores a link at its place', () => {
    const c = base();
    const gone = removeLink(c, 0, 0);
    expect(gone.sections[0]?.links.map((l) => l.text)).toEqual(['a2']);
    const back = restoreLink(gone, 0, 0, { text: 'a1', url: 'https://a1.test' });
    expect(back.sections[0]?.links.map((l) => l.text)).toEqual(['a1', 'a2']);
    expect(removeSection(c, 1).sections).toHaveLength(1);
  });

  it('adds rows and sections and edits a link keeping extra keys', () => {
    const c = base();
    expect(addLink(c, 1).sections[1]?.links).toHaveLength(2);
    expect(addSection(c).sections.at(-1)).toEqual({ header: 'New section', links: [] });
    const withExtra = { sections: [{ header: 'X', links: [{ text: 't', url: 'u', icon: 'i' }] }] } as unknown as Config;
    expect(updateLink(withExtra, 0, 0, { text: 'z' }).sections[0]?.links[0]).toEqual({
      text: 'z',
      url: 'u',
      icon: 'i',
    });
  });
});

describe('urls', () => {
  it('adds https when there is no scheme', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl('  http://x.test ')).toBe('http://x.test');
    expect(normalizeUrl('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(normalizeUrl('')).toBe('');
  });
  it('flags unparseable urls only', () => {
    expect(urlError('')).toBeNull();
    expect(urlError('https://example.com')).toBeNull();
    expect(urlError('not a url')).toMatch(/full address/);
  });
});

describe('dirty and close logic', () => {
  it('a blank new row is not dirty and is dropped on save', () => {
    const saved = base();
    const draft = addLink(saved, 0);
    expect(isDirty(draft, saved)).toBe(false);
    expect(finalizeConfig(draft)).toEqual(saved);
  });

  it('closes without saving when clean', () => {
    const saved = base();
    expect(decideClose({ draft: saved, saved, rawError: null })).toEqual({ action: 'close', save: null });
  });

  it('saves a dirty valid draft on close', () => {
    const saved = base();
    const draft = updateLink(saved, 0, 0, { text: ' renamed ' });
    const d = decideClose({ draft, saved, rawError: null });
    expect(d.action).toBe('close');
    if (d.action === 'close') expect(d.save?.sections[0]?.links[0]?.text).toBe('renamed');
  });

  it('blocks on invalid raw json, even when the draft is clean', () => {
    const saved = base();
    const d = decideClose({ draft: saved, saved, rawError: 'Line 1, column 2: Unexpected token }' });
    expect(d).toEqual({ action: 'block', reason: 'raw-json', error: 'Line 1, column 2: Unexpected token }' });
  });

  it('blocks on an unparseable url and names it', () => {
    const saved = base();
    const draft = updateLink(saved, 1, 0, { url: 'nope nope' });
    expect(decideClose({ draft, saved, rawError: null })).toEqual({
      action: 'block',
      reason: 'url',
      section: 1,
      link: 0,
    });
    expect(decideSave({ draft, rawError: null }).ok).toBe(false);
  });

  it('decideSave returns the finalized config', () => {
    const r = decideSave({ draft: addLink(base(), 0), rawError: null });
    expect(r.ok && r.config.sections[0]?.links).toHaveLength(2);
  });
});
