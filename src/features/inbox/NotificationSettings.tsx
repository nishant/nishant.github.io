import {
  Button,
  Checkbox,
  Field,
  INBOX_DEFAULT_SETTINGS,
  INBOX_SOURCE_LABELS,
  Input,
  Modal,
  Select,
  SkeletonRows,
  Switch,
  toast,
  type InboxSettings,
} from '@nish/ui';
import { useCallback, useEffect, useState } from 'react';
import { currentSubscription, pushSupport, registerSubscription, turnOff, turnOn, type PushSupport } from './push';

export interface NotificationSettingsProps {
  open: boolean;
  onClose: () => void;
  sources: Array<{ id: string; open: number }>;
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

/** The "Notifications" modal: push on this device, quiet hours, digest, timezone and muted sources. */
export function NotificationSettings({ open, onClose, sources }: NotificationSettingsProps) {
  if (!open) return null;
  return <SettingsModal onClose={onClose} sources={sources} />;
}

function SettingsModal({ onClose, sources }: Omit<NotificationSettingsProps, 'open'>) {
  const [settings, setSettings] = useState<InboxSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [support, setSupport] = useState<PushSupport>(() => pushSupport());
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await call<InboxSettings>('/settings');
    if (res.ok) setSettings({ ...INBOX_DEFAULT_SETTINGS, ...res.data });
    else setLoadError(res.error);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let alive = true;
    void currentSubscription().then((sub) => {
      if (!alive) return;
      setSubscribed(sub !== null);
      // The server may have dropped this subscription (reset database, 404/410, repeated failures).
      // Quietly upsert it so the modal's "on" state is true.
      if (sub) void registerSubscription(sub).catch(() => undefined);
    });
    return () => {
      alive = false;
    };
  }, []);

  const enable = async () => {
    setBusy(true);
    const res = await turnOn();
    setBusy(false);
    setSupport(pushSupport());
    if (res.ok) {
      setSubscribed(true);
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
    if (res.ok) setSubscribed(false);
    else toast.error(res.error);
  };

  const sendTest = async () => {
    setBusy(true);
    const res = await call<{ sent: number }>('/push/test', { method: 'POST', body: '{}' });
    setBusy(false);
    if (!res.ok) toast.error(res.error);
    else if (res.data.sent === 0) toast.error('No device is subscribed.');
    else toast.success('Test sent');
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const res = await call<InboxSettings>('/settings', { method: 'PUT', body: JSON.stringify(settings) });
    setSaving(false);
    if (res.ok) {
      toast.success('Saved');
      onClose();
    } else {
      toast.error(res.error);
    }
  };

  const patch = (change: Partial<InboxSettings>) => setSettings((s) => (s ? { ...s, ...change } : s));

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
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!settings}>
            Save
          </Button>
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
                      onChange={(e) => patch({ quietHours: { ...settings.quietHours, start: e.target.value } })}
                    />
                  </Field>
                  <Field label="To" htmlFor="inbox-quiet-end">
                    <Input
                      id="inbox-quiet-end"
                      type="time"
                      value={settings.quietHours.end}
                      onChange={(e) => patch({ quietHours: { ...settings.quietHours, end: e.target.value } })}
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
                    onChange={(e) => patch({ digest: { ...settings.digest, time: e.target.value } })}
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
                <legend className="mb-2 text-sm font-semibold text-th-hi">Notify for</legend>
                <div className="flex flex-col gap-1">
                  {sourceIds.map((id) => (
                    <Checkbox
                      key={id}
                      label={INBOX_SOURCE_LABELS[id] ?? id}
                      checked={!settings.mutedSources.includes(id)}
                      onChange={(e) =>
                        patch({
                          mutedSources: e.target.checked
                            ? settings.mutedSources.filter((m) => m !== id)
                            : [...settings.mutedSources, id],
                        })
                      }
                    />
                  ))}
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
