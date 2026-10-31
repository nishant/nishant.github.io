import { Button, Kbd, Modal, Spinner, toast, useMediaQuery } from '@nish/ui';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { AlertTriangle, Check } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import { loadNotes, saveNotes } from '../../lib/storage';
import { createAutosaver, type SaveStatus } from './autosave';

const Editor = lazy(() => import('./Editor'));

function StatusText({ status }: { status: SaveStatus }): ReactElement {
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 text-th-warn" role="status">
        <AlertTriangle size={14} aria-hidden /> Not saved
      </span>
    );
  }
  if (status === 'saving') {
    return (
      <span className="text-th-hi3" role="status">
        Saving…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-th-hi3" role="status">
      <Check size={14} aria-hidden /> Saved
    </span>
  );
}

/** The Notes sheet: a rich text editor that saves itself 600ms after you stop typing, plus a
 *  Save button and Ctrl/Cmd+S. Closing never asks; it writes any pending change first. */
export function NotesSheet({ open, onClose }: { open: boolean; onClose: () => void }): ReactElement | null {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const editorRef = useRef<TiptapEditor | null>(null);
  const fine = useMediaQuery('(pointer: fine)');

  const saver = useMemo(() => createAutosaver({ write: saveNotes, onStatus: setStatus }), []);
  // The notes as they were when the sheet opened; the editor ignores later changes.
  const initialHtml = useMemo(() => (open ? loadNotes() : ''), [open]);

  // Reopening starts from Saved (adjusted during render).
  const [shownOpen, setShownOpen] = useState(open);
  if (open !== shownOpen) {
    setShownOpen(open);
    if (open) setStatus('saved');
  }
  // Write anything still queued when the sheet goes away (closed, or the app unmounts).
  useEffect(() => {
    if (!open) return undefined;
    return () => {
      saver.flush();
    };
  }, [open, saver]);

  const onReady = useCallback((ed: TiptapEditor | null) => {
    editorRef.current = ed;
  }, []);

  const saveNow = useCallback(() => {
    const ed = editorRef.current;
    if (ed) saver.schedule(ed.getHTML());
    if (!saver.flush()) toast.error('Could not save: storage is full or blocked');
  }, [saver]);

  const close = useCallback(() => {
    saver.flush();
    onClose();
  }, [saver, onClose]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveNow();
    }
  };

  if (!open) return null;

  return (
    <Modal
      title="Notes"
      size="xl"
      sheetHeight="full"
      onClose={close}
      subtitle={<StatusText status={status} />}
      footer={
        <>
          <Button variant="secondary" onClick={saveNow}>
            Save
            {fine && <Kbd className="ml-2">Ctrl S</Kbd>}
          </Button>
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        </>
      }
    >
      <div className="-mx-1 flex min-h-full flex-col" onKeyDown={onKeyDown}>
        <Suspense
          fallback={
            <div className="flex min-h-[40dvh] items-center justify-center">
              <Spinner label="Loading editor" />
            </div>
          }
        >
          <Editor initialHtml={initialHtml} onChange={saver.schedule} onReady={onReady} fine={fine} />
        </Suspense>
      </div>
    </Modal>
  );
}
