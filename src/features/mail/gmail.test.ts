// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  TOKEN_TTL_MS,
  clearCachedToken,
  decodeEntities,
  getValidToken,
  isTokenValid,
  mapMessage,
  parseFrom,
  readCachedToken,
  writeCachedToken,
} from './gmail';
import { KEYS } from '../../lib/storage';

describe('parseFrom', () => {
  it('uses the quoted display name', () => expect(parseFrom('"Ada Lovelace" <ada@example.com>')).toBe('Ada Lovelace'));
  it('uses an unquoted display name', () => expect(parseFrom('Ada Lovelace <ada@example.com>')).toBe('Ada Lovelace'));
  it('falls back to the address', () => {
    expect(parseFrom('ada@example.com')).toBe('ada@example.com');
    expect(parseFrom('<ada@example.com>')).toBe('ada@example.com');
    expect(parseFrom('"" <ada@example.com>')).toBe('ada@example.com');
  });
  it('handles empty input', () => expect(parseFrom(undefined)).toBe(''));
});

describe('decodeEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('Tom &amp; Jerry&#39;s &quot;show&quot; &lt;3 &#x2019;')).toBe('Tom & Jerry\'s "show" <3 ’');
  });
  it('leaves unknown entities alone', () => expect(decodeEntities('&bogus; ok')).toBe('&bogus; ok'));
});

describe('mapMessage', () => {
  const base = {
    id: 'abc',
    snippet: 'Don&#39;t forget &amp; reply',
    internalDate: '1761600000000',
    labelIds: ['INBOX', 'UNREAD'],
    payload: {
      headers: [
        { name: 'From', value: '"Ada" <ada@example.com>' },
        { name: 'Subject', value: 'Lunch &amp; plans' },
        { name: 'Date', value: 'Tue, 28 Oct 2026 10:00:00 -0500' },
      ],
    },
  };
  it('maps fields and decodes entities', () => {
    expect(mapMessage(base)).toEqual({
      id: 'abc',
      from: 'Ada',
      subject: 'Lunch & plans',
      snippet: "Don't forget & reply",
      date: 1761600000000,
      unread: true,
    });
  });
  it('is read without UNREAD and uses the placeholder subject', () => {
    const m = mapMessage({
      ...base,
      labelIds: ['INBOX'],
      payload: {
        headers: [
          { name: 'from', value: 'x@y.z' },
          { name: 'Subject', value: '  ' },
        ],
      },
    });
    expect(m.unread).toBe(false);
    expect(m.subject).toBe('(no subject)');
    expect(m.from).toBe('x@y.z');
  });
});

describe('token cache', () => {
  beforeEach(() => localStorage.clear());

  it('is valid for 55 minutes', () => {
    const t = { accessToken: 'tok', timestamp: 1_000_000 };
    expect(isTokenValid(t, 1_000_000 + TOKEN_TTL_MS - 1)).toBe(true);
    expect(isTokenValid(t, 1_000_000 + TOKEN_TTL_MS)).toBe(false);
    expect(TOKEN_TTL_MS).toBe(55 * 60_000);
  });
  it('rejects empty or malformed tokens', () => {
    expect(isTokenValid(null)).toBe(false);
    expect(isTokenValid({ accessToken: '', timestamp: Date.now() })).toBe(false);
  });
  it('round-trips through the old storage key and format', () => {
    writeCachedToken('tok', 5000);
    expect(JSON.parse(localStorage.getItem(KEYS.googleToken)!)).toEqual({ accessToken: 'tok', timestamp: 5000 });
    expect(readCachedToken()).toEqual({ accessToken: 'tok', timestamp: 5000 });
    expect(getValidToken(5000 + 1000)).toBe('tok');
    expect(getValidToken(5000 + TOKEN_TTL_MS + 1)).toBeNull();
    clearCachedToken();
    expect(readCachedToken()).toBeNull();
  });
  it('ignores garbage in storage', () => {
    localStorage.setItem(KEYS.googleToken, 'not json');
    expect(readCachedToken()).toBeNull();
  });
});
