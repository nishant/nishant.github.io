import { Button, Card, ConfirmDialog, Field, IconButton, Input, dismissToast, toast } from '@nish/ui';
import { SiteIcon } from '../../components/SiteIcon';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Config, LinkItem } from '../../lib/storage';
import {
  addLink,
  addSection,
  moveLink,
  moveSection,
  normalizeUrl,
  removeLink,
  removeSection,
  renameSection,
  restoreLink,
  updateLink,
  urlError,
} from './settings-state';

export interface LinksEditorProps {
  draft: Config;
  /** Applies a change to the latest draft (a function, so an Undo never reverts newer edits). */
  update: (fn: (c: Config) => Config) => void;
  /** A link to scroll to and focus, e.g. the one with a bad address that blocked closing. */
  focusLink?: { section: number; link: number; nonce: number } | null;
}

const fieldId = (s: number, l: number, part: 'name' | 'url') => `settings-link-${s}-${l}-${part}`;

/** The Links tab: sections with reorderable, editable link rows. */
export function LinksEditor({ draft, update, focusLink }: LinksEditorProps) {
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  // Focus a freshly added row (or a link named by the parent) once it has rendered.
  useEffect(() => {
    if (pendingFocus.current) {
      const el = root.current?.querySelector<HTMLElement>(`#${pendingFocus.current}`);
      pendingFocus.current = null;
      el?.focus();
    }
  });

  useEffect(() => {
    if (!focusLink) return;
    const el = root.current?.querySelector<HTMLElement>(`#${fieldId(focusLink.section, focusLink.link, 'url')}`);
    el?.focus();
    el?.scrollIntoView({ block: 'center' });
  }, [focusLink]);

  // An Undo toast must not outlive the editor: dismiss it when the Links tab or the sheet goes away.
  const undoToast = useRef<number | null>(null);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  useEffect(
    () => () => {
      if (undoToast.current !== null) dismissToast(undoToast.current);
    },
    [],
  );

  const removeLinkWithUndo = (s: number, l: number) => {
    const link = draft.sections[s]?.links[l];
    if (!link) return;
    // Remember the section as it is after the removal, so Undo finds it even if sections moved since.
    const next = removeLink(draft, s, l);
    const afterRemoval = next.sections[s];
    update(() => next);
    undoToast.current = toast('Link removed', {
      id: 'settings-undo',
      action: {
        label: 'Undo',
        onClick: () => {
          const c = latestDraft.current;
          let idx = afterRemoval ? c.sections.indexOf(afterRemoval) : -1;
          // The section was edited since: fall back to its position if it still looks like the same one.
          if (idx < 0 && afterRemoval && c.sections[s]?.links.length === afterRemoval.links.length) idx = s;
          if (idx < 0) {
            toast.error('Could not undo: the section changed');
            return;
          }
          update((cur) => restoreLink(cur, Math.min(idx, cur.sections.length - 1), l, link));
        },
      },
    });
  };

  const sectionToDelete = pendingDelete === null ? undefined : draft.sections[pendingDelete];

  return (
    <div ref={root} className="flex flex-col gap-4">
      {draft.sections.length === 0 && (
        <p className="text-sm text-th-hi3">No sections yet. Add one to start building your start page.</p>
      )}
      {draft.sections.map((section, s) => (
        <Card key={s} padding="sm" as="section" aria-label={section.header || 'Section'}>
          <div className="flex items-center gap-1">
            <Input
              aria-label="Section name"
              value={section.header}
              placeholder="Section name"
              className="font-semibold"
              wrapperClassName="min-w-0 flex-1"
              onChange={(e) => update((c) => renameSection(c, s, e.target.value))}
            />
            <IconButton
              label="Move section up"
              disabled={s === 0}
              onClick={() => update((c) => moveSection(c, s, s - 1))}
            >
              <ArrowUp size={16} aria-hidden />
            </IconButton>
            <IconButton
              label="Move section down"
              disabled={s === draft.sections.length - 1}
              onClick={() => update((c) => moveSection(c, s, s + 1))}
            >
              <ArrowDown size={16} aria-hidden />
            </IconButton>
            <IconButton label="Delete section" tone="danger" onClick={() => setPendingDelete(s)}>
              <Trash2 size={16} aria-hidden />
            </IconButton>
          </div>

          <ul className="mt-3 flex flex-col gap-3">
            {section.links.map((link, l) => (
              <LinkRow
                key={l}
                link={link}
                s={s}
                l={l}
                count={section.links.length}
                focused={focused}
                setFocused={setFocused}
                onChange={(patch) => update((c) => updateLink(c, s, l, patch))}
                onMove={(to) => update((c) => moveLink(c, s, l, to))}
                onRemove={() => removeLinkWithUndo(s, l)}
              />
            ))}
          </ul>

          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus size={14} aria-hidden />}
              onClick={() => {
                pendingFocus.current = fieldId(s, section.links.length, 'name');
                update((c) => addLink(c, s));
              }}
            >
              Add link
            </Button>
          </div>
        </Card>
      ))}

      <div>
        <Button
          variant="secondary"
          icon={<Plus size={16} aria-hidden />}
          onClick={() => {
            update((c) => addSection(c));
          }}
        >
          Add section
        </Button>
      </div>

      {sectionToDelete && pendingDelete !== null && (
        <ConfirmDialog
          title={`Delete ${sectionToDelete.header.trim() || 'this section'}?`}
          body={`Its ${sectionToDelete.links.length} ${sectionToDelete.links.length === 1 ? 'link goes' : 'links go'} too.`}
          confirmLabel="Delete"
          tone="danger"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            const s = pendingDelete;
            setPendingDelete(null);
            update((c) => removeSection(c, s));
          }}
        />
      )}
    </div>
  );
}

interface LinkRowProps {
  link: LinkItem;
  s: number;
  l: number;
  count: number;
  focused: string | null;
  setFocused: (id: string | null) => void;
  onChange: (patch: Partial<LinkItem>) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}

function LinkRow({ link, s, l, count, focused, setFocused, onChange, onMove, onRemove }: LinkRowProps) {
  const urlId = fieldId(s, l, 'url');
  const error = focused === urlId ? null : urlError(link.url);
  return (
    <li className="flex items-start gap-2">
      <span className="mt-3 hidden shrink-0 pointer-coarse:mt-3.5 sm:block">
        <SiteIcon url={error ? '' : link.url} label={link.text} size={20} />
      </span>
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr]">
        <Input
          id={fieldId(s, l, 'name')}
          aria-label="Link name"
          placeholder="Name"
          value={link.text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
        <Field label={<span className="sr-only">Link address</span>} error={error} htmlFor={urlId} className="gap-0">
          <Input
            id={urlId}
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://example.com"
            value={link.url}
            invalid={Boolean(error)}
            onFocus={() => setFocused(urlId)}
            onBlur={(e) => {
              setFocused(null);
              const next = normalizeUrl(e.target.value);
              if (next !== link.url) onChange({ url: next });
            }}
            onChange={(e) => onChange({ url: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex shrink-0 flex-col sm:flex-row">
        <IconButton label="Move link up" disabled={l === 0} onClick={() => onMove(l - 1)}>
          <ArrowUp size={16} aria-hidden />
        </IconButton>
        <IconButton label="Move link down" disabled={l === count - 1} onClick={() => onMove(l + 1)}>
          <ArrowDown size={16} aria-hidden />
        </IconButton>
        <IconButton label="Delete link" tone="danger" onClick={onRemove}>
          <Trash2 size={16} aria-hidden />
        </IconButton>
      </div>
    </li>
  );
}
