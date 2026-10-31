import { Button, Card, Kbd } from '@nish/ui';
import { useState } from 'react';
import { useConfig } from '../lib/config-context';
import { loadWelcomeDismissed, saveWelcomeDismissed } from '../lib/storage';

interface WelcomeProps {
  onEditLinks: () => void;
  onImport: () => void;
}

/** The first-visit card above the links. Every button dismisses it; the flag is stored. */
export function Welcome({ onEditLinks, onImport }: WelcomeProps) {
  const { firstVisit } = useConfig();
  const [dismissed, setDismissed] = useState(loadWelcomeDismissed);
  if (!firstVisit || dismissed) return null;

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
        <li>
          Press <Kbd>Ctrl K</Kbd> or <Kbd>/</Kbd> to search your links, open apps or use bangs like !gh, !yt and !w.
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
