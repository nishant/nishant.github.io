import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inboxParams, useHashRoute } from './route';

beforeEach(() => {
  window.scrollTo = vi.fn() as typeof window.scrollTo;
});
afterEach(() => {
  window.location.hash = '';
});

describe('useHashRoute', () => {
  it('#/jp is jp', () => {
    window.location.hash = '#/jp';
    const { result } = renderHook(() => useHashRoute());
    expect(result.current).toBe('jp');
  });

  it('#/inbox is inbox and keeps its query', () => {
    window.location.hash = '#/inbox?item=12';
    const { result } = renderHook(() => useHashRoute());
    expect(result.current).toBe('inbox');
    expect(window.location.hash).toBe('#/inbox?item=12');
  });

  it.each(['', '#/', '#/nope', '#/home', '#/inboxes', '#/nope?item=1'])('%j is home and is rewritten to #/home', (hash) => {
    window.location.hash = hash;
    const { result } = renderHook(() => useHashRoute());
    expect(result.current).toBe('home');
    expect(window.location.hash).toBe('#/home');
  });

  it('follows hashchange and scrolls to top', () => {
    window.location.hash = '#/home';
    const { result } = renderHook(() => useHashRoute());
    vi.mocked(window.scrollTo).mockClear();
    act(() => {
      window.location.hash = '#/jp';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current).toBe('jp');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});

describe('inboxParams', () => {
  it('reads item and source', () => {
    expect(inboxParams('#/inbox?item=12')).toEqual({ item: 12, source: null });
    expect(inboxParams('#/inbox?source=trading')).toEqual({ item: null, source: 'trading' });
    expect(inboxParams('#/inbox?item=3&source=job-apps')).toEqual({ item: 3, source: 'job-apps' });
  });

  it('ignores a missing query and bad values', () => {
    expect(inboxParams('#/inbox')).toEqual({ item: null, source: null });
    expect(inboxParams('')).toEqual({ item: null, source: null });
    expect(inboxParams('#/inbox?item=abc')).toEqual({ item: null, source: null });
    expect(inboxParams('#/inbox?item=0')).toEqual({ item: null, source: null });
    expect(inboxParams('#/inbox?item=-4')).toEqual({ item: null, source: null });
    expect(inboxParams('#/inbox?item=1.5')).toEqual({ item: null, source: null });
    expect(inboxParams('#/inbox?source=Bad%20Source')).toEqual({ item: null, source: null });
  });
});
