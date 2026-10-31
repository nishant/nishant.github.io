import { Button, Callout, Checkbox, Input, toast } from '@nish/ui';
import { useRef, useState, type ReactNode } from 'react';
import {
  buildBundle,
  copyShareLink,
  downloadBundle,
  FILE_MAX_BYTES,
  parseBundle,
  type SettingsBundle,
} from '../../lib/backup';
import { useConfig } from '../../lib/config-context';
import type { Config } from '../../lib/storage';
import { ImportDialog } from '../backup/ImportDialog';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 text-sm font-semibold text-th-hi">{title}</h3>
      {children}
    </section>
  );
}

/** Backup tab: download a settings file, copy a share link, import a file. Uses the saved config, not the draft. */
export function BackupTab({ dirty, onImported }: { dirty: boolean; onImported: (c: Config) => void }) {
  const { config } = useConfig();
  const [includeNotes, setIncludeNotes] = useState(true);
  const [manualLink, setManualLink] = useState<string | null>(null);
  const [pending, setPending] = useState<SettingsBundle | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    try {
      downloadBundle(buildBundle({ config, includeNotes }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the backup file');
    }
  };

  const copy = async () => {
    setManualLink(null);
    try {
      const { link, copied } = await copyShareLink(config);
      if (!copied) setManualLink(link);
    } catch {
      // copyShareLink already showed the reason.
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > FILE_MAX_BYTES) {
      toast.error('That file is too big to be a Start backup.');
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      toast.error('Could not read that file.');
      return;
    }
    const result = parseBundle(text);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPending(result.bundle);
  };

  return (
    <div className="flex flex-col gap-6">
      {dirty && <Callout tone="warn">You have unsaved link changes. Backups use your saved settings.</Callout>}

      <Section title="Download a backup">
        <p className="m-0 text-sm text-th-hi2">
          Saves your links, font and theme to a file you can import in any browser.
        </p>
        <Checkbox label="Include notes" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} />
        <div>
          <Button variant="secondary" className="w-full sm:w-auto" onClick={download}>
            Download file
          </Button>
        </div>
      </Section>

      <Section title="Share link">
        <p className="m-0 text-sm text-th-hi2">
          A link that sets up this page with your links, font and theme in another browser. Notes are not included. The
          settings travel in the part of the link after #, which is never sent to a server.
        </p>
        <div>
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => void copy()}>
            Copy share link
          </Button>
        </div>
        {manualLink !== null && (
          <div className="flex flex-col gap-1">
            <Input readOnly value={manualLink} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
            <p className="m-0 text-xs text-th-hi3">Copy this link</p>
          </div>
        )}
      </Section>

      <Section title="Import">
        <p className="m-0 text-sm text-th-hi2">Replace your settings with a backup file.</p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label="Backup file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            void onFile(file);
          }}
        />
        <div>
          <Button variant="secondary" className="w-full sm:w-auto" onClick={() => fileRef.current?.click()}>
            Choose file…
          </Button>
        </div>
      </Section>

      {pending && (
        <ImportDialog
          bundle={pending}
          onCancel={() => setPending(null)}
          onDone={() => {
            const c = pending.config;
            setPending(null);
            onImported(c);
          }}
        />
      )}
    </div>
  );
}
