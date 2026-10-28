import { Favicon, Kbd, ListRow, SearchInput, StickyBar, cn } from '@nish/ui';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Config } from '../lib/storage';
import { hostOf, isSafeUrl } from './LinkGrid';

export interface LinkMatch {
  text: string;
  url: string;
  host: string;
  section: string;
}

export const MAX_MATCHES = 6;

/** The Google results address for a query, encoded so `&`, `#` and `+` survive. */
export function googleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/**
 * Config links whose text or host contains the query (case-insensitive), at most 6.
 * Links whose text or host starts with the query come first; ties keep config order.
 * Links with an unsupported scheme are left out.
 */
export function matchLinks(config: Config, query: string): LinkMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const prefix: LinkMatch[] = [];
  const rest: LinkMatch[] = [];
  for (const section of config.sections) {
    for (const link of section.links) {
      if (!isSafeUrl(link.url)) continue;
      const host = hostOf(link.url);
      const text = link.text.toLowerCase();
      const h = host.toLowerCase();
      if (!text.includes(q) && !h.includes(q)) continue;
      const match = { text: link.text, url: link.url, host, section: section.header };
      (text.startsWith(q) || h.startsWith(q) ? prefix : rest).push(match);
    }
  }
  return [...prefix, ...rest].slice(0, MAX_MATCHES);
}

/** What Enter does: open the highlighted link, else search Google; nothing for an empty query. */
export function resolveEnter(matches: LinkMatch[], highlight: number, query: string): string | null {
  const picked = highlight >= 0 ? matches[highlight] : undefined;
  if (picked) return picked.url;
  const q = query.trim();
  return q ? googleSearchUrl(q) : null;
}

function isTyping(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

interface SearchBarProps {
  config: Config;
  /** Navigates to an address. Default: the same tab. */
  onNavigate?: (url: string) => void;
}

/** The sticky search field: link suggestions while typing, Enter searches Google. */
export function SearchBar({ config, onNavigate }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(-1);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const listId = useId();
  const optionId = (i: number) => `${listId}-${i}`;

  const matches = useMemo(() => matchLinks(config, query), [config, query]);
  const open = focused && matches.length > 0;
  const fine = typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;

  const go = (url: string) => (onNavigate ? onNavigate(url) : window.location.assign(url));

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (isTyping(document.activeElement)) return;
      if (document.querySelector('[data-nish-layer]')) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // The bar stays transparent (so the hero gradient shows through) until it sticks.
  useEffect(() => {
    const onScroll = () => setStuck((sentinelRef.current?.getBoundingClientRect().top ?? 0) < 0);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (matches.length === 0) return;
      e.preventDefault();
      const n = matches.length;
      setHighlight((h) => (e.key === 'ArrowDown' ? (h + 1) % n : h <= 0 ? n - 1 : h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const url = resolveEnter(matches, highlight, query);
      if (url) go(url);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
      setHighlight(-1);
      inputRef.current?.blur();
    }
  };

  return (
    <>
      <div ref={sentinelRef} aria-hidden className="-mb-4 h-0" />
      <StickyBar top="0px" className={cn('z-20 py-2', !stuck && 'bg-transparent')}>
        <div className="relative">
          <SearchInput
            ref={inputRef}
            value={query}
            onChange={(v) => {
              setQuery(v);
              setHighlight(-1);
            }}
            onKeyDown={onKeyDown}
            onFocus={() => {
              clearTimeout(closeTimer.current);
              setFocused(true);
            }}
            onBlur={() => {
              clearTimeout(closeTimer.current);
              closeTimer.current = setTimeout(() => setFocused(false), 120);
            }}
            autoFocus={fine}
            placeholder="Search Google"
            aria-label="Search Google or your links"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={open && highlight >= 0 ? optionId(highlight) : undefined}
            inputClassName="min-h-12 text-base"
          />
          {query === '' ? (
            <Kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 md:pointer-fine:inline-flex">
              /
            </Kbd>
          ) : null}
          {open ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Matching links"
              onMouseDown={(e) => e.preventDefault()}
              className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-th-line bg-th-elevated py-1 shadow-pop"
            >
              {matches.map((m, i) => (
                <li key={`${i}-${m.url}`} id={optionId(i)} role="option" aria-selected={i === highlight}>
                  <ListRow
                    as="div"
                    dense
                    chevron={false}
                    active={i === highlight}
                    onClick={() => go(m.url)}
                    icon={<Favicon url={m.url} label={m.text} size={20} />}
                    title={
                      <>
                        {m.text}
                        {m.host ? <span className="ml-2 text-th-hi3">{m.host}</span> : null}
                      </>
                    }
                    meta={<span className="text-xs text-th-hi3">{m.section}</span>}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </StickyBar>
    </>
  );
}
