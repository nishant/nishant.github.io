import { Button, Callout, ConfirmDialog, Skeleton } from '@nish/ui';
import { lazy, Suspense, useState } from 'react';
import { DEFAULT_CONFIG, parseConfig, serializeConfig, type Config } from '../../lib/storage';

const JsonEditor = lazy(() => import('./JsonEditor'));

/** What the Raw JSON tab holds when it differs from the draft: the text being typed and its error. */
export interface RawState {
  text: string;
  error: string | null;
}

export interface JsonTabProps {
  draft: Config;
  /** null: the text is just the draft, serialized. */
  raw: RawState | null;
  onRaw: (raw: RawState | null) => void;
  onDraft: (c: Config) => void;
}

/** The Raw JSON tab: a CodeMirror editor over the whole config, with Format and Reset. */
export function JsonTab({ draft, raw, onRaw, onDraft }: JsonTabProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const text = raw?.text ?? serializeConfig(draft);
  const error = raw?.error ?? null;

  const change = (next: string) => {
    const parsed = parseConfig(next);
    if (parsed.ok) {
      onDraft(parsed.config);
      onRaw({ text: next, error: null });
    } else {
      onRaw({ text: next, error: parsed.error });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Suspense fallback={<Skeleton className="h-[min(60dvh,32rem)] w-full rounded-lg" />}>
        <JsonEditor value={text} onChange={change} />
      </Suspense>
      {error && (
        <Callout tone="loss" live>
          {error}
        </Callout>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={Boolean(error)} onClick={() => onRaw(null)}>
          Format
        </Button>
        <Button variant="ghost" onClick={() => setConfirmReset(true)}>
          Reset to defaults
        </Button>
      </div>
      {confirmReset && (
        <ConfirmDialog
          title="Reset to defaults?"
          body="Your links and sections are replaced by the default set. Nothing is saved until you press Save or close Settings."
          confirmLabel="Reset"
          tone="danger"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            setConfirmReset(false);
            onDraft(DEFAULT_CONFIG);
            onRaw(null);
          }}
        />
      )}
    </div>
  );
}
