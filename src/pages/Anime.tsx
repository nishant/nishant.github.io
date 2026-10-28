import { Card, Favicon, ListRow, PageContainer, SectionNav } from '@nish/ui';
import { hostOf } from '../components/LinkGrid';
import { CATEGORIES, links } from './anime-links';

const NAV_ITEMS = CATEGORIES.map((c) => {
  const Icon = c.icon;
  return {
    id: c.slug,
    label: c.type,
    icon: <Icon size={16} aria-hidden />,
    count: links.filter((l) => l.linkType === c.type).length,
  };
});

/** The Anime + Manga page (#/jp): a scroll-spy chip nav over a responsive grid of link sections. */
export function Anime() {
  return (
    <PageContainer size="wide">
      <h1 className="mb-3 text-2xl font-semibold text-th-hi">Anime + Manga</h1>
      <SectionNav items={NAV_ITEMS} updateHash={false} label="Anime categories" className="mb-4" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const items = links.filter((l) => l.linkType === c.type);
          return (
            <Card key={c.slug} as="section" id={c.slug} padding="none" className="nish-scroll-target">
              <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                <Icon size={18} className="shrink-0 text-th-accent" aria-hidden />
                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-th-hi">{c.type}</h2>
                <span className="shrink-0 text-xs tabular-nums text-th-hi3">{items.length}</span>
              </div>
              <ul className="pb-1">
                {items.map((l) => (
                  <ListRow
                    key={l.link}
                    dense
                    external
                    href={l.link}
                    icon={<Favicon url={l.link} label={l.text} size={20} />}
                    title={<span title={l.text}>{l.text}</span>}
                    meta={<span className="hidden text-xs text-th-hi3 md:inline">{hostOf(l.link)}</span>}
                    className="min-h-11"
                  />
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}
