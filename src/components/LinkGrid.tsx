import { Button, Card, EmptyState, ListRow, cn } from '@nish/ui';
import { AlertTriangle, Link as LinkIcon } from 'lucide-react';
import type { Config, Section } from '../lib/storage';
import { SiteIcon } from './SiteIcon';

/** Only http, https and mailto links are rendered as anchors; anything else is plain text. */
export function isSafeUrl(url: string): boolean {
  // Mirror the WHATWG URL parser: drop tabs/newlines anywhere, and leading C0 controls and spaces.
  // eslint-disable-next-line no-control-regex
  const clean = url.replace(/[\t\n\r]/g, '').replace(/^[\u0000- ]+/, '');
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(clean, 'https://x.invalid/').protocol);
  } catch {
    return false;
  }
}

/** The host to show next to a link ("github.com"), or '' when the address has none. */
export function hostOf(url: string): string {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

interface LinkGridProps {
  config: Config;
  onOpenSettings: () => void;
  className?: string;
}

/** The sections of links on the home page: one card per section, one 44px row per link. */
export function LinkGrid({ config, onOpenSettings, className }: LinkGridProps) {
  if (config.sections.length === 0) {
    return (
      <EmptyState
        icon={<LinkIcon size={28} aria-hidden />}
        title="No links yet"
        detail="Add your favourite sites and they show up here."
        action={
          <Button variant="primary" size="sm" onClick={onOpenSettings}>
            Open Settings
          </Button>
        }
        className={className}
      />
    );
  }
  return (
    <div className={cn('grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3', className)}>
      {config.sections.map((section, i) => (
        <SectionCard key={`${i}-${section.header}`} section={section} />
      ))}
    </div>
  );
}

function SectionCard({ section }: { section: Section }) {
  return (
    <Card as="section" padding="none" className="motion-safe:animate-[nish-fade-in_.2s_ease-out]">
      <div className="flex items-baseline justify-between gap-2 px-3 pt-3 pb-1">
        <h2 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-th-sky">{section.header}</h2>
        <span className="shrink-0 text-xs tabular-nums text-th-hi3">{section.links.length}</span>
      </div>
      {section.links.length === 0 ? (
        <p className="px-3 pb-3 pt-1 text-sm text-th-hi3">No links</p>
      ) : (
        <ul className="pb-1">
          {section.links.map((link, i) => (
            <LinkRow key={`${i}-${link.url}`} text={link.text} url={link.url} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function LinkRow({ text, url }: { text: string; url: string }) {
  const rowClass = 'min-h-11 lg:pointer-fine:min-h-10';
  if (!isSafeUrl(url)) {
    return (
      <ListRow
        dense
        title={<span title="Unsupported link">{text}</span>}
        icon={<AlertTriangle size={20} className="text-th-warn" aria-label="Unsupported link" />}
        className={rowClass}
      />
    );
  }
  return (
    <ListRow
      dense
      chevron={false}
      href={url}
      icon={<SiteIcon url={url} label={text} size={20} />}
      title={<span title={text}>{text}</span>}
      className={rowClass}
    />
  );
}
