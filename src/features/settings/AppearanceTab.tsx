import { Badge, cn, ThemeToggle, toast } from '@nish/ui';
import { useEffect, useState } from 'react';
import { applyFont, FONTS, fontAvailable } from '../../lib/font';
import { loadFont, saveFont } from '../../lib/storage';

const SAMPLE = 'The quick brown fox';

function stackFor(family: string): string {
  const mono = family === 'Fira Code' || family.startsWith('Courier');
  return `'${family}', ${mono ? 'ui-monospace, monospace' : 'system-ui, sans-serif'}`;
}

/** Font picker (applies live) and the theme toggle. */
export function AppearanceTab() {
  const [font, setFont] = useState(loadFont);
  // Re-check availability once fonts finish loading, so Google fonts do not flash "Not on this device".
  const [, setReady] = useState(0);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && setReady((n) => n + 1)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const pick = (family: string) => {
    setFont(family);
    applyFont(family);
    try {
      saveFont(family);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save: storage is full or blocked');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="mb-2 text-sm font-semibold text-th-hi">Font</legend>
        <div className="flex flex-col gap-1">
          {FONTS.map(({ family, source }) => {
            const selected = family === font;
            const missing = source === 'system' && !fontAvailable(family);
            return (
              <label
                key={family}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2',
                  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-th-focus',
                  selected ? 'border-th-accent bg-th-accent-soft' : 'border-th-line hover:bg-th-ghost',
                )}
              >
                <input
                  type="radio"
                  name="settings-font"
                  value={family}
                  checked={selected}
                  onChange={() => pick(family)}
                  className="size-4 shrink-0 accent-[var(--nish-accent)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base text-th-hi" style={{ fontFamily: stackFor(family) }}>
                    {family}
                  </span>
                  <span className="block truncate text-xs text-th-hi3" style={{ fontFamily: stackFor(family) }}>
                    {SAMPLE}
                  </span>
                </span>
                {missing && <Badge tone="warn">Not on this device</Badge>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-th-hi">Theme</h3>
        <ThemeToggle phone="segmented" block />
      </div>
    </div>
  );
}
