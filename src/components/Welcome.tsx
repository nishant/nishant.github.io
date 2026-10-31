import { Button, Card, Kbd } from '@nish/ui';
import { useEffect, useRef, useState } from 'react';
import { useConfig } from '../lib/config-context';
import { loadWelcomeDismissed, saveWelcomeDismissed } from '../lib/storage';

const SEARCH_SHORTCUT =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K';

interface WelcomeProps {
  onEditLinks: () => void;
  onImport: () => void;
}

/** The first-visit card above the links. Every button dismisses it; the flag is stored. */
export function Welcome({ onEditLinks, onImport }: WelcomeProps) {
  const { firstVisit, config } = useConfig();
  const [dismissed, setDismissed] = useState(loadWelcomeDismissed);
  const initialConfig = useRef(config);
  // An import (or any save) replaces the config: the starter links are gone, so the card is moot.
  const changed = config !== initialConfig.current;
  useEffect(() => {
    if (changed) saveWelcomeDismissed();
  }, [changed]);
  if (!firstVisit || dismissed || changed) return null;

  const dismiss = (then?: () => void) => () => {
    saveWelcomeDismissed();
    setDismissed(true);
    then?.();
  };

  return (
    <Card as="section" aria-labelledby="welcome-title" className="flex flex-col gap-3">
      <h2 id="welcome-title" className="text-base font-semibold text-th-hi">
        Welcome to Start
      </h2>
      <p className="text-sm text-th-hi2">
        A fast homepage for your browser. Your links, notes and settings stay in this browser, with no account.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-th-hi2">
        <li className="hidden pointer-fine:list-item">
          Press <Kbd>{SEARCH_SHORTCUT}</Kbd> to search your links, open apps or use bangs like !gh, !yt and !w.
        </li>
        <li>Set this page as your browser&apos;s homepage or new tab page to see it every time.</li>
      </ul>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap [&>button]:min-h-11 [&>button]:w-full sm:[&>button]:w-auto">
        <Button variant="primary" onClick={dismiss(onEditLinks)}>
          Edit links
        </Button>
        <Button variant="secondary" onClick={dismiss(onImport)}>
          Import settings
        </Button>
        <Button variant="ghost" onClick={dismiss()}>
          Keep these links
        </Button>
      </div>
    </Card>
  );
}
