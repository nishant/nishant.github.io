import { CommandPalette, cycleTheme, toast, type CommandItem } from '@nish/ui';
import { Globe } from 'lucide-react';
import { useMemo, useState } from 'react';
import { APPS } from '../../components/AppDock';
import { hostOf, isSafeUrl } from '../../components/LinkGrid';
import { googleSearchUrl } from '../../components/SearchBar';
import { SiteIcon } from '../../components/SiteIcon';
import type { AppId } from '../../lib/api';
import { buildBundle, copyShareLink, downloadBundle } from '../../lib/backup';
import { useConfig } from '../../lib/config-context';
import { requestSettingsTab } from '../../lib/settings-tab';
import { allBangs, bangUrl, parseBang } from './bangs';

function themeLabel(choice: string): string {
  return choice.charAt(0).toUpperCase() + choice.slice(1);
}

/** The Ctrl K palette: links, apps, actions and bangs. Owns its open state. */
export function CommandMenu({ onOpenSheet }: { onOpenSheet: (id: AppId) => void }) {
  const { config } = useConfig();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setQuery('');
  };

  const items = useMemo<CommandItem[]>(() => {
    const q = query.trim();
    const bangs = allBangs(config);
    const parsed = parseBang(q, bangs);
    if (parsed && parsed.terms) {
      return [
        {
          id: 'bang',
          label: `Search ${parsed.bang.name} for “${parsed.terms}”`,
          hint: `!${parsed.bang.bang}`,
          keywords: [query],
          href: bangUrl(parsed.bang, parsed.terms),
        },
      ];
    }

    const list: CommandItem[] = [];
    for (const [si, section] of config.sections.entries()) {
      for (const [i, link] of section.links.entries()) {
        if (!isSafeUrl(link.url)) continue;
        const host = hostOf(link.url);
        list.push({
          id: `link:${si}:${i}`,
          group: 'Links',
          label: link.text,
          hint: host,
          keywords: [host, section.header],
          icon: <SiteIcon url={link.url} label={link.text} size={18} />,
          href: link.url,
        });
      }
    }
    for (const app of APPS) {
      const Icon = app.icon;
      list.push({
        id: `app:${app.id}`,
        group: 'Apps',
        label: app.label,
        icon: <Icon size={18} aria-hidden />,
        onSelect: () => onOpenSheet(app.id),
      });
    }
    list.push(
      { id: 'page:jp', group: 'Apps', label: 'Anime + Manga', keywords: ['page'], href: '#/jp' },
      { id: 'page:inbox', group: 'Apps', label: 'Inbox', keywords: ['page'], href: '#/inbox' },
      {
        id: 'action:theme',
        group: 'Actions',
        label: 'Switch theme',
        onSelect: () => toast.info(`Theme: ${themeLabel(cycleTheme())}`),
      },
      {
        id: 'action:export',
        group: 'Actions',
        label: 'Export settings',
        onSelect: () => downloadBundle(buildBundle({ config, includeNotes: true })),
      },
      {
        id: 'action:share',
        group: 'Actions',
        label: 'Copy share link',
        onSelect: () => {
          copyShareLink(config)
            .then((r) => {
              if (!r.copied) toast.warn('Could not copy automatically. Open Settings, then Backup, to copy the link.');
            })
            .catch(() => undefined);
        },
      },
      {
        id: 'action:import',
        group: 'Actions',
        label: 'Import settings',
        onSelect: () => {
          requestSettingsTab('backup');
          onOpenSheet('settings');
        },
      },
    );

    if (q.startsWith('!')) {
      for (const b of bangs) {
        list.push({
          id: `bang:${b.bang}`,
          group: 'Bangs',
          label: `${b.name} search`,
          hint: `!${b.bang}`,
          keywords: [`!${b.bang}`],
          icon: <Globe size={18} aria-hidden />,
          href: bangUrl(b, ''),
        });
      }
    } else if (q) {
      list.push({
        id: 'web',
        group: 'Search',
        label: `Search Google for “${q}”`,
        keywords: [q],
        href: googleSearchUrl(q),
      });
    }
    return list;
  }, [config, query, onOpenSheet]);

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      items={items}
      hotkey
      placeholder="Search links, apps, or type !gh …"
      emptyText="No matches. Press Enter to search Google."
      onQuery={setQuery}
      onSubmitQuery={(q) => window.location.assign(googleSearchUrl(q.trim()))}
    />
  );
}
