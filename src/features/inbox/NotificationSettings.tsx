import {
  Button,
  Checkbox,
  Field,
  INBOX_DEFAULT_SETTINGS,
  Input,
  Modal,
  Select,
  SkeletonRows,
  Switch,
  toast,
  type InboxSeverity,
} from '@nish/ui';
import { dateTime } from '@nish/ui/format';
import { useCallback, useEffect, useRef, useState } from 'react';
import { inboxApi, type InboxSettingsV2, type PushDevice, type SourceRule } from './api';
import { SOURCE_LABELS } from './labels';
import { currentSubscription, pushSupport, registerSubscription, turnOff, turnOn, type PushSupport } from './push';

export interface NotificationSettingsProps {
  open: boolean;
  onClose: () => void;
  sources: Array<{ id: string; open: number }>;
}

/** Time fields fire on every keystroke; wait for a pause so a half-typed time is never saved. */
const TYPING_DELAY_MS = 800;

const NO_RULE: SourceRule = { severity: null, autoHandleHours: null, noReopenHours: null };

type HoursField = 'autoHandleHours' | 'noReopenHours';

/** Whole hours from 1 to 720 as typed; null for empty or anything else. */
function parseHours(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const n = Number(text);
  return n >= 1 && n <= 720 ? n : null;
}

const SEVERITY_NAMES: Record<InboxSeverity, string> = { info: 'Info', normal: 'Normal', urgent: 'Urgent' };

/** "Urgent · auto-handle 24 h · no reopen 6 h", or null when the rule changes nothing. */
function ruleSummary(rule: SourceRule | undefined): string | null {
  if (!rule) return null;
  const parts: string[] = [];
  if (rule.severity) parts.push(SEVERITY_NAMES[rule.severity]);
  if (rule.autoHandleHours !== null) parts.push(`auto-handle ${rule.autoHandleHours} h`);
  if (rule.noReopenHours !== null) parts.push(`no reopen ${rule.noReopenHours} h`);
  return parts.length ? parts.join(' · ') : null;
}

const ZONES = ['America/Chicago', 'America/New_York', 'America/Denver', 'America/Los_Angeles', 'UTC'];

async function call<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/inbox${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!res.ok) {
      const error = (body as { error?: unknown } | null)?.error;
      return { ok: false, error: typeof error === 'string' && error ? error : 'Something went wrong. Try again.' };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: 'Inbox service is not answering.' };
  }
}

/** The "Notifications" modal: push on this device, devices, quiet hours, digest, timezone and per-source rules.
 *  Every change saves on its own; there is no Save button to forget. */
export function NotificationSettings({ open, onClose, sources }: NotificationSettingsProps) {
  if (!open) return null;
  return <SettingsModal onClose={onClose} sources={sources} />;
}

function SettingsModal({ onClose, sources }: Omit<NotificationSettingsProps, 'open'>) {
  const [settings, setSettings] = useState<InboxSettingsV2 | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [support, setSupport] = useState<PushSupport>(() => pushSupport());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<PushDevice[] | null>(null);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [ownHint, setOwnHint] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState<string | null>(null);
  // What is typed in an hours field, so "999" stays visible next to its error.
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // The last settings the server accepted, to fall back to when a save fails.
  const saved = useRef<InboxSettingsV2 | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<InboxSettingsV2 | null>(null);
  const seq = useRef(0);

  const persist = useCallback(async (next: InboxSettingsV2) => {
    const mine = ++seq.current;
    const res = await call<InboxSettingsV2>('/settings', { method: 'PUT', body: JSON.stringify(next) });
    // A newer change is already on its way; its answer is the one that counts.
    if (mine !== seq.current) return;
    if (res.ok) {
      saved.current = next;
      // Drop typed text that now matches the stored rule, so the field shows what is saved.
      setDrafts((d) => {
        const kept: Record<string, string> = {};
        for (const [key, text] of Object.entries(d)) {
          const cut = key.lastIndexOf(':');
          const stored = next.rules[key.slice(0, cut)]?.[key.slice(cut + 1) as HoursField] ?? null;
          const parsed = parseHours(text);
          if (text.trim() === '' ? stored === null : parsed !== null && parsed === stored) continue;
          kept[key] = text;
        }
        return kept;
      });
      toast.success('Saved', { id: 'inbox-settings' });
    } else {
      toast.error(res.error, { id: 'inbox-settings' });
      if (saved.current) setSettings(saved.current);
      setDrafts({});
    }
  }, []);

  // Closing the modal mid-typing still saves what was typed.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (pending.current) void persist(pending.current);
    },
    [persist],
  );

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await call<InboxSettingsV2>('/settings');
    if (res.ok) {
      const loaded: InboxSettingsV2 = { ...INBOX_DEFAULT_SETTINGS, ...res.data, rules: res.data?.rules ?? {} };
      saved.current = loaded;
      setSettings(loaded);
    } else setLoadError(res.error);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDevices = useCallback(async () => {
    const res = await inboxApi.devices();
    if (res.ok && Array.isArray(res.data)) {
      setDevices(res.data);
      setDevicesError(null);
    } else setDevicesError(res.ok ? 'Could not load devices.' : res.error);
  }, []);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    let alive = true;
    void currentSubscription().then((sub) => {
      if (!alive) return;
      setSubscribed(sub !== null);
      setOwnHint(sub ? sub.endpoint.slice(-12) : null);
      // The server may have dropped this subscription (reset database, 404/410, repeated failures).
      // Quietly upsert it so the modal's "on" state is true.
      if (sub) void registerSubscription(sub).then(() => loadDevices(), () => undefined);
    });
    return () => {
      alive = false;
    };
  }, [loadDevices]);

  const enable = async () => {
    setBusy(true);
    const res = await turnOn();
    setBusy(false);
    setSupport(pushSupport());
    if (res.ok) {
      setSubscribed(true);
      const sub = await currentSubscription();
      setOwnHint(sub ? sub.endpoint.slice(-12) : null);
      void loadDevices();
      toast.success('Notifications are on');
    } else {
      setSubscribed((await currentSubscription()) !== null);
      toast.error(res.error);
    }
  };

  const disable = async () => {
    setBusy(true);
    const res = await turnOff();
    setBusy(false);
    if (res.ok) {
      setSubscribed(false);
      setOwnHint(null);
      void loadDevices();
    } else toast.error(res.error);
  };

  const removeDevice = async (device: PushDevice) => {
    const mine = ownHint !== null && device.endpointHint === ownHint;
    const res = await inboxApi.removeDevice(device.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (mine) {
      try {
        await (await currentSubscription())?.unsubscribe();
      } catch {
        // The service no longer lists it; the browser side is best effort.
      }
      setSubscribed(false);
      setOwnHint(null);
    }
    await loadDevices();
  };

  const sendTest = async () => {
    setBusy(true);
    const res = await call<{ sent: number }>('/push/test', { method: 'POST', body: '{}' });
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else if (res.data.sent === 0) toast.error('No device is subscribed.');
    else toast.success('Test sent');
  };

  const patch = (change: Partial<InboxSettingsV2>, delay = 0) => {
    if (!settings) return;
    const next = { ...settings, ...change };
    setSettings(next);
    if (timer.current) clearTimeout(timer.current);
    pending.current = next;
    timer.current = setTimeout(() => {
      timer.current = null;
      pending.current = null;
      void persist(next);
    }, delay);
  };

  const setRule = (id: string, change: Partial<SourceRule>, delay = 0) => {
    if (!settings) return;
    const rule = { ...NO_RULE, ...settings.rules[id], ...change };
    const rules = { ...settings.rules };
    if (rule.severity === null && rule.autoHandleHours === null && rule.noReopenHours === null) delete rules[id];
    else rules[id] = rule;
    patch({ rules }, delay);
  };

  const onHours = (id: string, field: HoursField, text: string) => {
    setDrafts((d) => ({ ...d, [`${id}:${field}`]: text }));
    setRule(id, { [field]: parseHours(text) }, TYPING_DELAY_MS);
  };

  const hoursText = (id: string, field: HoursField) => {
    const draft = drafts[`${id}:${field}`];
    if (draft !== undefined) return draft;
    const value = settings?.rules[id]?.[field];
    return value === null || value === undefined ? '' : String(value);
  };

  const hoursError = (id: string, field: HoursField) => {
    const draft = drafts[`${id}:${field}`];
    return draft !== undefined && draft.trim() !== '' && parseHours(draft) === null ? 'Use 1 to 720 hours.' : undefined;
  };

  // Muted sources that have no items right now still get a checkbox, so they can be turned back on.
  const sourceIds = [...sources.map((s) => s.id)];
  for (const id of settings?.mutedSources ?? []) if (!sourceIds.includes(id)) sourceIds.push(id);

  const zones = settings && !ZONES.includes(settings.timezone) ? [...ZONES, settings.timezone] : ZONES;

  return (
    <Modal
      title="Notifications"
      size="md"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-th-hi3">Changes save as you make them.</p>
          <Button onClick={onClose}>Done</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <section aria-labelledby="inbox-device">
          <h3 id="inbox-device" className="mb-2 text-sm font-semibold text-th-hi">
            This device
          </h3>
          {support === 'unsupported' && <p className="text-sm text-th-hi2">This browser can&apos;t get push notifications.</p>}
          {support === 'wrong-host' && <p className="text-sm text-th-hi2">Push works on start.nish.software.</p>}
          {support === 'denied' && (
            <p className="text-sm text-th-hi2">
              Notifications are blocked for this site. Allow them in the browser&apos;s site settings.
            </p>
          )}
          {support === 'ok' && !subscribed && (
            <Button onClick={enable} loading={busy}>
              Turn on notifications
            </Button>
          )}
          {support === 'ok' && subscribed && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-th-hi2">Notifications are on for this device.</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={sendTest} disabled={busy}>
                  Send a test
                </Button>
                <Button variant="ghost" onClick={disable} disabled={busy}>
                  Turn off
                </Button>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="inbox-devices">
          <h3 id="inbox-devices" className="mb-2 text-sm font-semibold text-th-hi">
            Devices
          </h3>
          {devicesError && (
            <div role="alert" className="flex flex-col items-start gap-2 text-sm text-th-hi2">
              <p>{devicesError}</p>
              <Button size="sm" variant="secondary" className="min-h-11" onClick={() => void loadDevices()}>
                Try again
              </Button>
            </div>
          )}
          {devices === null && !devicesError && <SkeletonRows rows={2} />}
          {devices !== null && !devicesError && devices.length === 0 && (
            <p className="text-sm text-th-hi2">No devices get notifications yet.</p>
          )}
          {devices !== null && !devicesError && devices.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {devices.map((device) => (
                <li key={device.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-th-hi">
                      {device.label}
                      {ownHint !== null && device.endpointHint === ownHint ? ' (this device)' : ''}
                    </p>
                    <p className="text-xs text-th-hi3">
                      {device.lastOkAt
                        ? `Last delivered ${dateTime(new Date(device.lastOkAt))}`
                        : 'No notification delivered yet'}
                    </p>
                    {device.stale && (
                      <p className="text-xs text-th-warn">
                        {`No delivery since ${dateTime(new Date(device.lastOkAt ?? device.createdAt))}; the last ${device.failCount} tries failed.`}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    aria-label={`Remove ${device.label}`}
                    onClick={() => void removeDevice(device)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {loadError && (
          <div role="alert" className="flex flex-col items-start gap-2 text-sm text-th-hi2">
            <p>{loadError}</p>
            <Button size="sm" variant="ghost" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        )}
        {!settings && !loadError && <SkeletonRows rows={4} />}

        {settings && (
          <>
            <section className="flex flex-col gap-3" aria-label="Quiet hours">
              <Switch
                label="Quiet hours"
                description="Urgent items still notify."
                checked={settings.quietHours.enabled}
                onChange={(enabled) => patch({ quietHours: { ...settings.quietHours, enabled } })}
              />
              {settings.quietHours.enabled && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From" htmlFor="inbox-quiet-start">
                    <Input
                      id="inbox-quiet-start"
                      type="time"
                      value={settings.quietHours.start}
                      onChange={(e) => patch({ quietHours: { ...settings.quietHours, start: e.target.value } }, TYPING_DELAY_MS)}
                    />
                  </Field>
                  <Field label="To" htmlFor="inbox-quiet-end">
                    <Input
                      id="inbox-quiet-end"
                      type="time"
                      value={settings.quietHours.end}
                      onChange={(e) => patch({ quietHours: { ...settings.quietHours, end: e.target.value } }, TYPING_DELAY_MS)}
                    />
                  </Field>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3" aria-label="Daily digest">
              <Switch
                label="Daily digest"
                description="One notification with what came in since the last one."
                checked={settings.digest.enabled}
                onChange={(enabled) => patch({ digest: { ...settings.digest, enabled } })}
              />
              {settings.digest.enabled && (
                <Field label="At" htmlFor="inbox-digest-time">
                  <Input
                    id="inbox-digest-time"
                    type="time"
                    value={settings.digest.time}
                    onChange={(e) => patch({ digest: { ...settings.digest, time: e.target.value } }, TYPING_DELAY_MS)}
                  />
                </Field>
              )}
            </section>

            <Field label="Timezone" htmlFor="inbox-timezone">
              <Select id="inbox-timezone" value={settings.timezone} onChange={(e) => patch({ timezone: e.target.value })}>
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </Select>
            </Field>

            {sourceIds.length > 0 && (
              <fieldset className="m-0 min-w-0 border-0 p-0">
                <legend className="mb-2 text-sm font-semibold text-th-hi">Sources</legend>
                <div className="flex flex-col gap-3">
                  {sourceIds.map((id) => {
                    const name = SOURCE_LABELS[id] ?? id;
                    const summary = ruleSummary(settings.rules[id]);
                    const rule = settings.rules[id];
                    const expanded = rulesOpen === id;
                    const panelId = `inbox-rules-${id}`;
                    return (
                      <div key={id} className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <div className="min-w-0">
                            <p className="text-sm text-th-hi">{name}</p>
                            {summary && <p className="text-xs text-th-hi3">{summary}</p>}
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            <Checkbox
                              label="Notify"
                              aria-label={`Notify for ${name}`}
                              checked={!settings.mutedSources.includes(id)}
                              onChange={(e) =>
                                patch({
                                  mutedSources: e.target.checked
                                    ? settings.mutedSources.filter((m) => m !== id)
                                    : [...settings.mutedSources, id],
                                })
                              }
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-11"
                              aria-expanded={expanded}
                              aria-controls={panelId}
                              aria-label={`Rules for ${name}`}
                              onClick={() => setRulesOpen(expanded ? null : id)}
                            >
                              Rules
                            </Button>
                          </div>
                        </div>
                        {expanded && (
                          <div id={panelId} className="flex w-full flex-col gap-3 rounded-md border border-th-line p-3">
                            <Field label="Severity" htmlFor={`${panelId}-severity`}>
                              <Select
                                id={`${panelId}-severity`}
                                value={rule?.severity ?? ''}
                                onChange={(e) =>
                                  setRule(id, { severity: e.target.value === '' ? null : (e.target.value as InboxSeverity) })
                                }
                              >
                                <option value="">As sent</option>
                                <option value="info">Info: list only</option>
                                <option value="normal">Normal</option>
                                <option value="urgent">Urgent</option>
                              </Select>
                            </Field>
                            <Field
                              label="Auto-handle after (hours)"
                              htmlFor={`${panelId}-auto`}
                              hint="Leave empty to keep items until you handle them."
                              error={hoursError(id, 'autoHandleHours')}
                            >
                              <Input
                                id={`${panelId}-auto`}
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={720}
                                value={hoursText(id, 'autoHandleHours')}
                                onChange={(e) => onHours(id, 'autoHandleHours', e.target.value)}
                              />
                            </Field>
                            <Field
                              label="Don't reopen for (hours)"
                              htmlFor={`${panelId}-noreopen`}
                              hint="Repeats of an item you handled stay handled this long."
                              error={hoursError(id, 'noReopenHours')}
                            >
                              <Input
                                id={`${panelId}-noreopen`}
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={720}
                                value={hoursText(id, 'noReopenHours')}
                                onChange={(e) => onHours(id, 'noReopenHours', e.target.value)}
                              />
                            </Field>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-th-hi3">Muted sources still show up here.</p>
              </fieldset>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
