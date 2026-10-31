import { describe, expect, it } from 'vitest';
import type { Config } from '../../lib/storage';
import { BUILTIN_BANGS, allBangs, bangUrl, parseBang } from './bangs';

const run = (q: string, config: Config = { sections: [] }) => {
  const r = parseBang(q, allBangs(config));
  return r ? bangUrl(r.bang, r.terms) : null;
};

describe('bangs', () => {
  it('searches with a leading bang', () => {
    expect(run('!gh react')).toBe('https://github.com/search?q=react');
  });
  it('searches with a trailing bang, case-insensitive', () => {
    expect(run('react hooks !YT')).toBe('https://www.youtube.com/results?search_query=react%20hooks');
  });
  it('opens the home page with no terms', () => {
    expect(run('!gh')).toBe('https://github.com');
  });
  it('returns null for an unknown bang or a non-bang', () => {
    expect(run('!nope x')).toBeNull();
    expect(run('a!b')).toBeNull();
    expect(run('plain words')).toBeNull();
  });
  it('lets a custom bang override a built-in', () => {
    const config: Config = { sections: [], bangs: [{ bang: 'gh', name: 'Mine', url: 'https://x.test/?q=%s' }] };
    expect(run('!gh a', config)).toBe('https://x.test/?q=a');
    expect(allBangs(config)).toHaveLength(BUILTIN_BANGS.length);
    expect(run('!gh', config)).toBe('https://x.test');
  });
  it('ignores invalid custom bangs', () => {
    const config: Config = {
      sections: [],
      bangs: [
        { bang: 'bad bang', name: 'A', url: 'https://x.test/?q=%s' },
        { bang: 'nourl', name: 'A', url: 'https://x.test/' },
        { bang: 'js', name: 'A', url: 'javascript:%s' },
        { bang: '', name: 'A', url: 'https://x.test/?q=%s' },
        { bang: 'ok', name: '', url: 'https://x.test/?q=%s' },
        'junk',
      ],
    };
    expect(allBangs(config)).toHaveLength(BUILTIN_BANGS.length);
  });
  it('encodes & and #', () => {
    expect(run('!g a&b#c')).toBe('https://www.google.com/search?q=a%26b%23c');
  });
});
