import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPushHost, pushSupport, urlBase64ToUint8Array } from './push';

function setHost(hostname: string) {
  vi.stubGlobal('location', { hostname });
}

function setBrowser({ sw = true, pm = true, notification = 'default' as NotificationPermission | null } = {}) {
  vi.stubGlobal('navigator', sw ? { serviceWorker: {} } : {});
  const win: Record<string, unknown> = {};
  if (pm) win.PushManager = class {};
  if (notification) {
    win.Notification = { permission: notification };
    vi.stubGlobal('Notification', win.Notification);
  }
  vi.stubGlobal('window', win);
}

afterEach(() => vi.unstubAllGlobals());

describe('urlBase64ToUint8Array', () => {
  it('decodes base64url with padding restored', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array('AQI'))).toEqual([1, 2]);
  });

  it('maps - and _ to + and /', () => {
    // 0xfb 0xff 0xfe is "+//+" in base64, "-__-" in base64url.
    expect(Array.from(urlBase64ToUint8Array('-__-'))).toEqual([0xfb, 0xff, 0xfe]);
  });

  it('returns an empty array for an empty key', () => {
    expect(urlBase64ToUint8Array('')).toHaveLength(0);
  });
});

describe('isPushHost', () => {
  it('allows the start page and local hosts only', () => {
    expect(isPushHost('start.nish.software')).toBe(true);
    expect(isPushHost('localhost')).toBe(true);
    expect(isPushHost('127.0.0.1')).toBe(true);
    expect(isPushHost('nishant.github.io')).toBe(false);
  });
});

describe('pushSupport', () => {
  it('is unsupported without a service worker, PushManager or Notification', () => {
    setHost('start.nish.software');
    setBrowser({ sw: false });
    expect(pushSupport()).toBe('unsupported');
    setBrowser({ pm: false });
    expect(pushSupport()).toBe('unsupported');
    setBrowser({ notification: null });
    expect(pushSupport()).toBe('unsupported');
  });

  it('is wrong-host away from start.nish.software and localhost', () => {
    setHost('nishant.github.io');
    setBrowser();
    expect(pushSupport()).toBe('wrong-host');
  });

  it('is denied when permission is blocked', () => {
    setHost('start.nish.software');
    setBrowser({ notification: 'denied' });
    expect(pushSupport()).toBe('denied');
  });

  it('is ok on the start page with permission default or granted', () => {
    setHost('start.nish.software');
    setBrowser({ notification: 'default' });
    expect(pushSupport()).toBe('ok');
    setBrowser({ notification: 'granted' });
    expect(pushSupport()).toBe('ok');
    setHost('localhost');
    expect(pushSupport()).toBe('ok');
  });

  it('checks support before the host', () => {
    setHost('nishant.github.io');
    setBrowser({ sw: false });
    expect(pushSupport()).toBe('unsupported');
  });
});
