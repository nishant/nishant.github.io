import { normalizeUrl, serializeConfig, type Config, type LinkItem, type Section } from '../../lib/storage';

/** Moves the item at `from` to `to`. Out-of-range moves return a copy unchanged. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = list.slice();
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export function removeItem<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

export function insertItem<T>(list: readonly T[], index: number, item: T): T[] {
  const next = list.slice();
  next.splice(Math.max(0, Math.min(index, next.length)), 0, item);
  return next;
}

function mapSection(config: Config, s: number, fn: (section: Section) => Section): Config {
  if (s < 0 || s >= config.sections.length) return config;
  return { ...config, sections: config.sections.map((sec, i) => (i === s ? fn(sec) : sec)) };
}

export function moveSection(config: Config, from: number, to: number): Config {
  return { ...config, sections: moveItem(config.sections, from, to) };
}

export function removeSection(config: Config, s: number): Config {
  return { ...config, sections: removeItem(config.sections, s) };
}

export function addSection(config: Config, header = 'New section'): Config {
  return { ...config, sections: [...config.sections, { header, links: [] }] };
}

export function renameSection(config: Config, s: number, header: string): Config {
  return mapSection(config, s, (sec) => ({ ...sec, header }));
}

export function moveLink(config: Config, s: number, from: number, to: number): Config {
  return mapSection(config, s, (sec) => ({ ...sec, links: moveItem(sec.links, from, to) }));
}

export function removeLink(config: Config, s: number, l: number): Config {
  return mapSection(config, s, (sec) => ({ ...sec, links: removeItem(sec.links, l) }));
}

/** Puts a link back where it was (the toast's Undo). */
export function restoreLink(config: Config, s: number, l: number, link: LinkItem): Config {
  return mapSection(config, s, (sec) => ({ ...sec, links: insertItem(sec.links, l, link) }));
}

export function addLink(config: Config, s: number): Config {
  return mapSection(config, s, (sec) => ({ ...sec, links: [...sec.links, { text: '', url: '' }] }));
}

export function updateLink(config: Config, s: number, l: number, patch: Partial<LinkItem>): Config {
  return mapSection(config, s, (sec) => ({
    ...sec,
    links: sec.links.map((link, i) => (i === l ? { ...link, ...patch } : link)),
  }));
}

export { normalizeUrl } from '../../lib/storage';

/** The field error for a URL, or null when it is empty (dropped on save) or parseable. */
export function urlError(url: string): string | null {
  const t = url.trim();
  if (!t) return null;
  try {
    new URL(t);
    return null;
  } catch {
    return 'Enter a full address, like https://example.com';
  }
}

/** The config as it will be saved: text trimmed, links with an empty name or URL dropped. */
export function finalizeConfig(config: Config): Config {
  return {
    ...config,
    sections: config.sections.map((sec) => ({
      ...sec,
      header: sec.header.trim(),
      links: sec.links
        .map((l) => ({ ...l, text: l.text.trim(), url: normalizeUrl(l.url) }))
        .filter((l) => l.text !== '' && l.url !== ''),
    })),
  };
}

export function isDirty(draft: Config, saved: Config): boolean {
  return serializeConfig(finalizeConfig(draft)) !== serializeConfig(saved);
}

/** First link in the draft whose URL does not parse. */
export function firstInvalidUrl(draft: Config): { section: number; link: number } | null {
  for (const [s, sec] of draft.sections.entries()) {
    for (const [l, link] of sec.links.entries()) {
      if (link.text.trim() !== '' && urlError(normalizeUrl(link.url))) return { section: s, link: l };
    }
  }
  return null;
}

export type CloseDecision =
  | { action: 'close'; save: Config | null }
  | { action: 'block'; reason: 'raw-json'; error: string }
  | { action: 'block'; reason: 'url'; section: number; link: number };

/**
 * What closing the sheet does. Invalid Raw JSON blocks (the edits would be lost); a clean
 * draft closes without saving; a dirty one is saved first (the old apply-on-close).
 */
export function decideClose(input: { draft: Config; saved: Config; rawError: string | null }): CloseDecision {
  if (input.rawError) return { action: 'block', reason: 'raw-json', error: input.rawError };
  if (!isDirty(input.draft, input.saved)) return { action: 'close', save: null };
  const bad = firstInvalidUrl(input.draft);
  if (bad) return { action: 'block', reason: 'url', section: bad.section, link: bad.link };
  return { action: 'close', save: finalizeConfig(input.draft) };
}

/** What the Save button does: the config to save, or why not. */
export function decideSave(input: {
  draft: Config;
  rawError: string | null;
}): { ok: true; config: Config } | { ok: false; error: string } {
  if (input.rawError) return { ok: false, error: input.rawError };
  if (firstInvalidUrl(input.draft)) return { ok: false, error: 'Enter a full address, like https://example.com' };
  return { ok: true, config: finalizeConfig(input.draft) };
}
