import { toast } from '@nish/ui';
import { useEffect, useState } from 'react';
import { decodeShare, shareParam, type SettingsBundle } from '../../lib/backup';
import { ImportDialog } from './ImportDialog';

const BROKEN = 'That share link is broken or incomplete.';

function strip(): void {
  window.history.replaceState(null, '', '#/home');
}

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
  return <ImportDialog bundle={bundle} onCancel={close} onDone={close} />;
}
