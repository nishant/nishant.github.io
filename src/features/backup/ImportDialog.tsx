import { Callout, ConfirmDialog, toast } from '@nish/ui';
import { hostOf } from '../../components/LinkGrid';
import { applyBundle, summarize, type SettingsBundle } from '../../lib/backup';
import { useConfig } from '../../lib/config-context';

const MAX_SECTIONS = 6;

/** Previews a backup and replaces the current settings only on "Replace my settings". */
export function ImportDialog({
  bundle,
  onCancel,
  onDone,
}: {
  bundle: SettingsBundle;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { setConfig } = useConfig();
  const sections = bundle.config.sections;
  const more = sections.length - MAX_SECTIONS;

  const confirm = () => {
    try {
      applyBundle(bundle, setConfig);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save: storage is full or blocked');
      return;
    }
    toast.success('Settings imported');
    onDone();
  };

  return (
    <ConfirmDialog
      title="Import settings?"
      tone="danger"
      confirmLabel="Replace my settings"
      cancelLabel="Cancel"
      onConfirm={confirm}
      onCancel={onCancel}
      body={
        <div className="flex flex-col gap-3 text-left">
          <p className="m-0">{summarize(bundle)}</p>
          {sections.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-th-hi2">
              {sections.slice(0, MAX_SECTIONS).map((s, i) => {
                const hosts = Array.from(new Set(s.links.map((l) => hostOf(l.url)).filter(Boolean))).slice(0, 3);
                const count = `${s.links.length} ${s.links.length === 1 ? 'link' : 'links'}`;
                return (
                  <li key={i} className="min-w-0 break-words">
                    {s.header || 'Untitled'} — {count}
                    {hosts.length > 0 ? ` (${hosts.join(', ')})` : ''}
                  </li>
                );
              })}
              {more > 0 && <li className="text-th-hi3">and {more} more {more === 1 ? 'section' : 'sections'}</li>}
            </ul>
          )}
          <Callout tone="warn">This replaces your current links and settings.</Callout>
        </div>
      }
    />
  );
}
