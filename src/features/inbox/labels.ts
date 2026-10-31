import { INBOX_SOURCE_LABELS } from '@nish/ui';

/** Display names for inbox sources; unknown ids show as they are. */
export const SOURCE_LABELS: Record<string, string> = { ...INBOX_SOURCE_LABELS, workflows: 'Workflows' };
