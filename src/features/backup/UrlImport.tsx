import { toast } from '@nish/ui';
import { lazy, Suspense, useEffect, useState, type ComponentProps, type ComponentType } from 'react';
import type { ImportDialog as ImportDialogType } from './ImportDialog';
import { decodeShare, shareParam, type SettingsBundle } from '../../lib/backup';

const BROKEN = 'That share link is broken or incomplete.';

function strip(): void {
  window.history.replaceState(null, '', '#/home');
}

// A chunk that fails to load (offline, or an old tab after a deploy) must not blank the page.
const ImportDialog = lazy<ComponentType<ComponentProps<typeof ImportDialogType>>>(() =>
  import('./ImportDialog')
    .then((m) => ({ default: m.ImportDialog }))
    .catch(() => {
      toast.error('Could not open the import. Reload the page and try the link again.');
      strip();
      return { default: () => null };
    }),
);

/** Opens the import preview for a share link (`#/home?settings=<code>`) and removes the code from the URL after. */
export function UrlImport() {
  const [bundle, setBundle] = useState<SettingsBundle | null>(null);

  useEffect(() => {
    let alive = true;
    const check = (): void => {
      const hash = window.location.hash;
      const code = shareParam(hash);
      if (code === null) {
        if (/[?&]settings=/.test(hash)) {
          toast.error(BROKEN);
          strip();
        }
        return;
      }
      void decodeShare(code).then((result) => {
        if (!alive) return;
        if (result.ok) {
          setBundle(result.bundle);
        } else {
          toast.error(BROKEN);
          strip();
        }
      });
    };
    check();
    window.addEventListener('hashchange', check);
    return () => {
      alive = false;
      window.removeEventListener('hashchange', check);
    };
  }, []);

  if (!bundle) return null;
  const close = (): void => {
    setBundle(null);
    strip();
  };
  return (
    <Suspense fallback={null}>
      <ImportDialog bundle={bundle} onCancel={close} onDone={close} />
    </Suspense>
  );
}
