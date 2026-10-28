import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHashRoute } from './route';

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

  it.each(['', '#/', '#/nope', '#/home'])('%j is home and is rewritten to #/home', (hash) => {
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
