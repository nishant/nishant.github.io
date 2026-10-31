export type SettingsTabRequest = 'links' | 'appearance' | 'json' | 'backup';

let pending: string | null = null;

/** Asks the next Settings sheet to open on this tab (e.g. the welcome card's "Import settings"). */
export function requestSettingsTab(tab: SettingsTabRequest): void {
  pending = tab;
}

/** The requested tab, once: returns it and clears it. */
export function takeSettingsTab(): string | null {
  const tab = pending;
  pending = null;
  return tab;
}
