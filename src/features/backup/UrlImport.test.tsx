import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encodeShare } from '../../lib/backup';
import { ConfigProvider } from '../../lib/config-context';
import { KEYS, type Config } from '../../lib/storage';
import { UrlImport } from './UrlImport';

const imported: Config = {
  sections: [{ header: 'Imported', links: [{ text: 'Example', url: 'https://example.com' }] }],
};

async function openLink(): Promise<void> {
  const code = await encodeShare({ app: 'start', v: 1, exportedAt: '2026-10-31T00:00:00.000Z', config: imported });
  window.location.hash = `#/home?settings=${code}`;
}

function mount() {
  return render(
    <ConfigProvider>
      <UrlImport />
    </ConfigProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  window.location.hash = '#/home';
});
afterEach(cleanup);

describe('UrlImport', () => {
  it('shows the preview for a valid share link', async () => {
    await openLink();
    mount();
    expect(await screen.findByText('Import settings?')).toBeTruthy();
    expect(screen.getByText(/1 section, 1 link/)).toBeTruthy();
    expect(localStorage.getItem(KEYS.config)).not.toContain('Imported');
  });

  it('strips the hash on Cancel and changes nothing', async () => {
    await openLink();
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByText('Import settings?')).toBeNull());
    expect(window.location.hash).toBe('#/home');
    expect(localStorage.getItem(KEYS.config)).not.toContain('Imported');
  });

  it('saves to localStorage on confirm and strips the hash', async () => {
    await openLink();
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Replace my settings' }));
    await waitFor(() => expect(screen.queryByText('Import settings?')).toBeNull());
    expect(localStorage.getItem(KEYS.config)).toContain('Imported');
    expect(window.location.hash).toBe('#/home');
  });

  it('shows nothing without a share param', () => {
    mount();
    expect(screen.queryByText('Import settings?')).toBeNull();
  });
});
