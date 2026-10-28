import { Button, Modal, TabPanel, Tabs, dismissToast, toast } from '@nish/ui';
import { useEffect, useRef, useState } from 'react';
import { useConfig } from '../../lib/config-context';
import { parseConfig, type Config } from '../../lib/storage';
import { AppearanceTab } from './AppearanceTab';
import { JsonTab, type RawState } from './JsonTab';
import { LinksEditor } from './LinksEditor';
import { decideClose, decideSave, isDirty } from './settings-state';

type TabId = 'links' | 'appearance' | 'json';

const TABS = [
  { value: 'links', label: 'Links' },
  { value: 'appearance', label: 'Appearance' },
  { value: 'json', label: 'Raw JSON' },
];

/** Settings: links, font and theme, and the raw config. Edits apply when the sheet closes. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  // The body mounts on open, so the draft always starts from the saved config.
  return open ? <SettingsBody onClose={onClose} /> : null;
}

function SettingsBody({ onClose }: { onClose: () => void }) {
  const { config, setConfig, rawInvalid } = useConfig();
  const [draft, setDraft] = useState<Config>(config);
  const [tab, setTab] = useState<TabId>(rawInvalid !== undefined ? 'json' : 'links');
  // A saved config that failed to parse is shown as-is so the user can repair it.
  const [raw, setRaw] = useState<RawState | null>(() => {
    if (rawInvalid === undefined) return null;
    const parsed = parseConfig(rawInvalid);
    return { text: rawInvalid, error: parsed.ok ? null : parsed.error };
  });
  const [focusLink, setFocusLink] = useState<{ section: number; link: number; nonce: number } | null>(null);

  const rawError = raw?.error ?? null;
  // A refused close must not start the DS exit animation or swipe, so those gestures are off meanwhile.
  const canClose = decideClose({ draft, saved: config, rawError }).action === 'close';
  const dirty = rawError !== null || isDirty(draft, config);

  /** Edits from the Links tab; the Raw JSON text is then re-derived from the draft. */
  const updateDraft = (fn: (c: Config) => Config) => {
    // Broken saved text is still the only copy of the user's config; a structured edit must not replace it.
    if (rawError !== null) {
      setTab('json');
      closeToast.current = toast.error('Fix the Raw JSON first, or discard it', {
        id: 'settings-close',
        action: { label: 'Discard', onClick: onClose },
      });
      return;
    }
    setDraft((d) => fn(d));
    setRaw(null);
  };

  const showUrlProblem = (section: number, link: number) => {
    setTab('links');
    setFocusLink({ section, link, nonce: Date.now() });
  };

  const save = () => {
    const result = decideSave({ draft, rawError });
    if (!result.ok) {
      if (rawError) setTab('json');
      toast.error(result.error);
      return;
    }
    setConfig(result.config);
    setDraft(result.config);
    setRaw(null);
    toast.success('Saved');
  };

  // Back handling lives here, not in Modal: Modal gives up its history entry before onClose runs, so a
  // refused close would leave nothing to catch the next Back. This entry is re-pushed after a refusal.
  const ownsEntry = useRef(false);
  const closeToast = useRef<number | null>(null);
  const requestCloseRef = useRef<(fromBack: boolean) => void>(() => {});

  useEffect(() => {
    const push = () => {
      const prev = (history.state as object | null) ?? {};
      history.pushState({ ...prev, nishLayer: 'settings' }, '');
      ownsEntry.current = true;
    };
    const timer = window.setTimeout(push, 0);
    const onPop = () => {
      // Popping a nested dialog's entry lands back on ours; that is not a Back out of Settings.
      if ((history.state as { nishLayer?: string } | null)?.nishLayer === 'settings') return;
      if (!ownsEntry.current) return;
      ownsEntry.current = false;
      requestCloseRef.current(true);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('popstate', onPop);
      if (closeToast.current !== null) dismissToast(closeToast.current);
      if (ownsEntry.current && (history.state as { nishLayer?: string } | null)?.nishLayer === 'settings') {
        ownsEntry.current = false;
        history.back();
      }
    };
  }, []);

  const requestClose = (fromBack = false) => {
    const decision = decideClose({ draft, saved: config, rawError });
    if (decision.action === 'close') {
      if (decision.save) setConfig(decision.save);
      onClose();
      return;
    }
    if (fromBack) {
      const prev = (history.state as object | null) ?? {};
      history.pushState({ ...prev, nishLayer: 'settings' }, '');
      ownsEntry.current = true;
    }
    if (decision.reason === 'raw-json') {
      setTab('json');
      closeToast.current = toast.error('Fix the JSON before closing, or discard your edits', {
        id: 'settings-close',
        duration: 'sticky',
        action: { label: 'Discard', onClick: onClose },
      });
    } else {
      showUrlProblem(decision.section, decision.link);
      closeToast.current = toast.error('Enter a full address, like https://example.com', {
        id: 'settings-close',
        action: { label: 'Discard', onClick: onClose },
      });
    }
  };

  requestCloseRef.current = requestClose;

  return (
    <Modal
      title="Settings"
      size="xl"
      sheetHeight="full"
      closeOnBack={false}
      dismissible={canClose}
      onClose={() => requestClose()}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className={dirty ? 'text-sm text-th-warn' : 'text-sm text-th-hi3'} role="status">
            {dirty ? 'Unsaved changes' : 'Changes apply when you close'}
          </p>
          <Button variant="primary" disabled={!dirty} onClick={save}>
            Save
          </Button>
        </div>
      }
    >
      <Tabs value={tab} onChange={(v) => setTab(v as TabId)} items={TABS} label="Settings sections" block>
        <TabPanel value="links" className="pt-4">
          <LinksEditor draft={draft} update={updateDraft} focusLink={focusLink} />
        </TabPanel>
        <TabPanel value="appearance" className="pt-4">
          <AppearanceTab />
        </TabPanel>
        <TabPanel value="json" className="pt-4">
          <JsonTab
            draft={draft}
            raw={raw}
            onRaw={setRaw}
            onDraft={(c) => {
              setDraft(c);
            }}
          />
        </TabPanel>
      </Tabs>
    </Modal>
  );
}
