import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosaver, type SaveStatus } from './autosave';

describe('createAutosaver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('writes once, 600ms after the last change', () => {
    const write = vi.fn();
    const saver = createAutosaver({ write });
    saver.schedule('a');
    vi.advanceTimersByTime(400);
    saver.schedule('ab');
    vi.advanceTimersByTime(599);
    expect(write).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith('ab');
    expect(saver.hasPending()).toBe(false);
  });

  it('flush writes the pending value immediately and cancels the timer', () => {
    const write = vi.fn();
    const saver = createAutosaver({ write });
    saver.schedule('x');
    expect(saver.flush()).toBe(true);
    expect(write).toHaveBeenCalledWith('x');
    vi.advanceTimersByTime(2000);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('flush with nothing pending writes nothing', () => {
    const write = vi.fn();
    const saver = createAutosaver({ write });
    expect(saver.flush()).toBe(true);
    expect(write).not.toHaveBeenCalled();
  });

  it('reports saving then saved', () => {
    const seen: SaveStatus[] = [];
    const saver = createAutosaver({ write: () => {}, onStatus: (s) => seen.push(s) });
    saver.schedule('x');
    vi.advanceTimersByTime(600);
    expect(seen).toEqual(['saving', 'saved']);
  });

  it('keeps the value after a failed write and retries on flush', () => {
    const seen: SaveStatus[] = [];
    let fail = true;
    const write = vi.fn(() => {
      if (fail) throw new Error('full');
    });
    const saver = createAutosaver({ write, onStatus: (s) => seen.push(s) });
    saver.schedule('x');
    vi.advanceTimersByTime(600);
    expect(seen).toEqual(['saving', 'error']);
    expect(saver.hasPending()).toBe(true);
    fail = false;
    expect(saver.flush()).toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
    expect(seen.at(-1)).toBe('saved');
  });

  it('cancel drops the pending value', () => {
    const write = vi.fn();
    const saver = createAutosaver({ write });
    saver.schedule('x');
    saver.cancel();
    vi.advanceTimersByTime(1000);
    expect(write).not.toHaveBeenCalled();
    expect(saver.hasPending()).toBe(false);
  });
});
