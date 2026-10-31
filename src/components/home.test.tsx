import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../lib/storage';
import { LinkGrid, hostOf, isSafeUrl } from './LinkGrid';
import { SearchBar, googleSearchUrl, matchLinks, resolveEnter } from './SearchBar';

afterEach(cleanup);

const config: Config = {
  sections: [
    {
      header: 'Dev',
      links: [
        { text: 'Docs for GitHub', url: 'https://docs.example.com/' },
        { text: 'GitHub', url: 'https://github.com/' },
        { text: 'Gitea', url: 'https://www.gitea.io/' },
        { text: 'Bad', url: 'javascript:alert(1)' },
      ],
    },
    { header: 'News', links: [{ text: 'Hacker News', url: 'https://news.ycombinator.com/' }] },
  ],
};

describe('matchLinks', () => {
  it('returns nothing for an empty query', () => {
    expect(matchLinks(config, '  ')).toEqual([]);
  });

  it('matches text or host case-insensitively and ranks prefixes first', () => {
    const m = matchLinks(config, 'GIT');
    expect(m.map((x) => x.text)).toEqual(['GitHub', 'Gitea', 'Docs for GitHub']);
    expect(m[0]).toMatchObject({ host: 'github.com', section: 'Dev' });
  });

  it('matches on the host', () => {
    expect(matchLinks(config, 'ycombinator').map((x) => x.text)).toEqual(['Hacker News']);
  });

  it('skips unsupported schemes and caps at 6', () => {
    expect(matchLinks(config, 'alert')).toEqual([]);
    const many: Config = {
      sections: [{ header: 'A', links: Array.from({ length: 10 }, (_, i) => ({ text: `site ${i}`, url: `https://a${i}.com` })) }],
    };
    expect(matchLinks(many, 'site')).toHaveLength(6);
  });
});

describe('Enter behaviour', () => {
  it('encodes the Google query', () => {
    expect(googleSearchUrl('a&b c#d')).toBe('https://www.google.com/search?q=a%26b%20c%23d');
  });

  it('opens the highlighted link, else searches, else does nothing', () => {
    const m = matchLinks(config, 'git');
    expect(resolveEnter(m, 1, 'git')).toBe('https://www.gitea.io/');
    expect(resolveEnter(m, -1, 'git')).toBe('https://www.google.com/search?q=git');
    expect(resolveEnter([], -1, '   ')).toBeNull();
  });

  it('honors bangs on Enter, but a highlighted link still wins', () => {
    expect(resolveEnter([], -1, '!gh react')).toBe('https://github.com/search?q=react');
    expect(resolveEnter([], -1, 'cats !w')).toBe('https://en.wikipedia.org/w/index.php?search=cats');
    expect(resolveEnter([], -1, '!nope x')).toBe('https://www.google.com/search?q=!nope%20x');
    const m = matchLinks(config, 'git');
    expect(resolveEnter(m, 0, '!gh git')).toBe(m[0]?.url);
  });

  it('wires the keyboard through the field', () => {
    const onNavigate = vi.fn();
    render(<SearchBar config={config} onNavigate={onNavigate} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'a&b' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).toHaveBeenLastCalledWith('https://www.google.com/search?q=a%26b');

    fireEvent.change(input, { target: { value: 'git' } });
    expect(screen.getAllByRole('option')).toHaveLength(3);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).toHaveBeenLastCalledWith('https://www.gitea.io/');

    fireEvent.change(input, { target: { value: '' } });
    onNavigate.mockClear();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

describe('LinkGrid', () => {
  it('renders safe links as anchors with favicons and unsafe schemes as text', () => {
    const { container } = render(<LinkGrid config={config} onOpenSettings={() => {}} />);
    const gh = screen.getByRole('link', { name: /^GitHub$/ });
    expect(gh.getAttribute('href')).toBe('https://github.com/');
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
    expect(screen.getByText('Bad')).toBeTruthy();
    expect(screen.getByLabelText('Unsupported link')).toBeTruthy();
    // every link row has a 20px favicon box (image or letter avatar) next to its text
    expect(container.querySelectorAll('a[href^="https://"]')).toHaveLength(4);
  });

  it('shows an empty state with a settings button when there are no sections', () => {
    const onOpenSettings = vi.fn();
    render(<LinkGrid config={{ sections: [] }} onOpenSettings={onOpenSettings} />);
    expect(screen.getByText('No links yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('shows "No links" for an empty section', () => {
    render(<LinkGrid config={{ sections: [{ header: 'Empty', links: [] }] }} onOpenSettings={() => {}} />);
    expect(screen.getByText('No links')).toBeTruthy();
  });
});

describe('url helpers', () => {
  it('classifies schemes', () => {
    expect(isSafeUrl('https://a.com')).toBe(true);
    expect(isSafeUrl('mailto:a@b.c')).toBe(true);
    expect(isSafeUrl('JavaScript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,x')).toBe(false);
    expect(hostOf('https://www.gitea.io/x')).toBe('gitea.io');
    expect(hostOf('')).toBe('');
  });
});
