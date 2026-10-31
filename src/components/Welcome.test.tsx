import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigProvider } from '../lib/config-context';
import { KEYS } from '../lib/storage';
import { Welcome } from './Welcome';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function setup() {
  const onEditLinks = vi.fn();
  const onImport = vi.fn();
  render(
    <ConfigProvider>
      <Welcome onEditLinks={onEditLinks} onImport={onImport} />
    </ConfigProvider>,
  );
  return { onEditLinks, onImport };
}

describe('Welcome', () => {
  it('shows on a first visit', () => {
    setup();
    expect(screen.getByText('Welcome to Start')).toBeTruthy();
  });

  it('"Keep these links" hides it and persists the flag', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Keep these links' }));
    expect(screen.queryByText('Welcome to Start')).toBeNull();
    expect(localStorage.getItem(KEYS.welcome)).toBe('1');
  });

  it('"Edit links" and "Import settings" call back and dismiss', () => {
    const { onEditLinks, onImport } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Import settings' }));
    expect(onImport).toHaveBeenCalledOnce();
    expect(onEditLinks).not.toHaveBeenCalled();
    expect(screen.queryByText('Welcome to Start')).toBeNull();
  });

  it('stays hidden once dismissed', () => {
    localStorage.setItem(KEYS.welcome, '1');
    setup();
    expect(screen.queryByText('Welcome to Start')).toBeNull();
  });

  it('never shows for a returning user with their own links', () => {
    localStorage.setItem(KEYS.config, JSON.stringify({ sections: [{ header: 'Mine', links: [] }] }));
    setup();
    expect(screen.queryByText('Welcome to Start')).toBeNull();
  });
});
