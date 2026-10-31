import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteIcon } from './SiteIcon';

describe('SiteIcon', () => {
  it('loads the icon from the same-origin proxy', () => {
    const { container } = render(<SiteIcon url="https://github.com/x" label="GitHub" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(`${import.meta.env.BASE_URL}api/favicon?host=github.com`);
  });

  it('strips www. from the host', () => {
    const { container } = render(<SiteIcon url="https://www.example.com" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(`${import.meta.env.BASE_URL}api/favicon?host=example.com`);
  });

  it('renders no img when the url has no host', () => {
    const { container } = render(<SiteIcon url="mailto:a@b.c" label="Mail" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('M');
  });

  it('shows the letter avatar when the icon fails to load', () => {
    const { container } = render(<SiteIcon url="https://github.com" label="GitHub" />);
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('G');
  });
});
