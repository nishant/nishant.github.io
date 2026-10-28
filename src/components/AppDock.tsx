import { BottomNav, Button } from '@nish/ui';
import { ChartCandlestick, CloudSun, Mail, NotebookPen, Settings, type LucideIcon } from 'lucide-react';
import type { AppId } from '../lib/api';

export const APPS: { id: AppId; label: string; icon: LucideIcon }[] = [
  { id: 'notes', label: 'Notes', icon: NotebookPen },
  { id: 'weather', label: 'Weather', icon: CloudSun },
  { id: 'watchlist', label: 'Watchlist', icon: ChartCandlestick },
  { id: 'mail', label: 'Mail', icon: Mail },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface AppDockProps {
  onOpen: (id: AppId) => void;
  /** The sheet that is open now, highlighted in the phone dock. */
  openSheet: AppId | null;
}

/** The five app buttons: an inline labelled row from 768px, a fixed bottom dock below it. */
export function AppDock({ onOpen, openSheet }: AppDockProps) {
  return (
    <>
      <div className="hidden flex-wrap justify-center gap-2 md:flex" role="group" aria-label="Apps">
        {APPS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant="secondary"
            icon={<Icon size={16} aria-hidden />}
            aria-haspopup="dialog"
            onClick={() => onOpen(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      <BottomNav
        hideFrom="md"
        label="Apps"
        items={APPS.map(({ id, label, icon: Icon }) => ({
          key: id,
          label,
          icon: <Icon size={22} aria-hidden />,
          active: openSheet === id,
          onSelect: () => onOpen(id),
        }))}
      />
    </>
  );
}
