export type SaveStatus = 'saved' | 'saving' | 'error';

export interface Autosaver {
  /** Queues `value` and (re)starts the debounce timer. Status becomes "saving". */
  schedule: (value: string) => void;
  /** Writes the queued value now (and retries a failed write). Returns false when the write failed. */
  flush: () => boolean;
  /** Drops the queued value and the timer without writing. */
  cancel: () => void;
  /** True while a value is waiting to be written. */
  hasPending: () => boolean;
}

export interface AutosaverOptions {
  /** Persists the value; throws when it cannot. */
  write: (value: string) => void;
  /** Called whenever the status changes. */
  onStatus?: (status: SaveStatus) => void;
  /** Debounce in milliseconds. Default 600. */
  delay?: number;
}

/** Debounced writer for the notes editor. A failed write keeps the value queued, so the
 *  next flush (Save, Done, close) tries again. */
export function createAutosaver({ write, onStatus, delay = 600 }: AutosaverOptions): Autosaver {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: string | undefined;

  const clear = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const flush = (): boolean => {
    clear();
    if (pending === undefined) return true;
    try {
      write(pending);
      pending = undefined;
      onStatus?.('saved');
      return true;
    } catch {
      onStatus?.('error');
      return false;
    }
  };

  return {
    schedule(value) {
      pending = value;
      clear();
      onStatus?.('saving');
      timer = setTimeout(flush, delay);
    },
    flush,
    cancel() {
      clear();
      pending = undefined;
    },
    hasPending: () => pending !== undefined,
  };
}
