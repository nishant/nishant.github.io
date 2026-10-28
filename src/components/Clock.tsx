import { useNow } from '@nish/ui';
import { time } from '@nish/ui/format';
import type { ReactNode } from 'react';

const LONG = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const SHORT = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** "Wednesday, October 28" */
export function longDate(t: number | Date): string {
  return LONG.format(t);
}

/** "Wed, Oct 28" */
export function shortDate(t: number | Date): string {
  return SHORT.format(t);
}

/** The date and time line at the top of the home page, with a slot at the right (the weather chip). */
export function Clock({ trailing }: { trailing?: ReactNode }) {
  const now = useNow(15_000);
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 text-sm text-th-hi3">
      <p className="min-w-0 truncate">
        <span className="min-[400px]:hidden">{shortDate(now)}</span>
        <span className="hidden min-[400px]:inline">{longDate(now)}</span>
        <span aria-hidden> · </span>
        <span className="tabular-nums text-th-hi2">{time(now)}</span>
      </p>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
