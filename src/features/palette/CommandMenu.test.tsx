import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConfigProvider } from '../../lib/config-context';
import { CommandMenu } from './CommandMenu';

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

const options = () => screen.queryAllByRole('option').map((o) => o.textContent ?? '');

const KEY = 'nishant.github.io-config';

function setup() {
  localStorage.setItem(
    KEY,
    JSON.stringify({ sections: [{ header: 'Dev', links: [{ text: 'GitHub', url: 'https://github.com' }] }] }),
  );
  render(
    <ConfigProvider>
      <CommandMenu onOpenSheet={() => {}} />
    </ConfigProvider>,
  );
  fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
  return screen.getByRole('combobox');
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('CommandMenu', () => {
  it('opens with Ctrl+K and lists links and apps', () => {
    setup();
    expect(screen.getByText('GitHub')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Export settings')).toBeTruthy();
  });

  it('finds a link by name', () => {
    const input = setup();
    fireEvent.change(input, { target: { value: 'gith' } });
    expect(options().some((t) => t.startsWith('GitHub'))).toBe(true);
    expect(options().some((t) => t.startsWith('Settings'))).toBe(false);
  });

  it('turns a bang query into one search row', () => {
    const input = setup();
    fireEvent.change(input, { target: { value: '!w cats' } });
    expect(screen.getByText('Search Wikipedia for “cats”')).toBeTruthy();
  });

  it('offers a Google search for a plain query', () => {
    const input = setup();
    fireEvent.change(input, { target: { value: 'zzqx' } });
    expect(options().some((t) => t.includes('Search Google for “zzqx”'))).toBe(true);
  });

  it('opens the site home for a bang with no terms', () => {
    const assign = vi.fn();
    const orig = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...orig, assign, href: orig.href } });
    try {
      const input = setup();
      fireEvent.change(input, { target: { value: '!gh' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(assign).toHaveBeenCalledWith('https://github.com');
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: orig });
    }
  });
});
