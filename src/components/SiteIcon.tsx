import { Favicon, cn } from '@nish/ui';
import { useEffect, useState } from 'react';
import { hostOf } from './LinkGrid';

interface SiteIconProps {
  url: string;
  label?: string;
  size?: number;
  className?: string;
}

/**
 * A link's icon, loaded from this site's own /api/favicon proxy so the browser never tells a third
 * party which sites are in the list. Shows the letter avatar when there is no host or no icon.
 */
export function SiteIcon({ url, label, size = 20, className }: SiteIconProps) {
  const host = hostOf(url);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [host]);

  if (!host || failed) return <Favicon url="" label={label ?? url} size={size} className={className} />;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm dark:bg-white/90 dark:p-px',
        loaded ? '' : 'bg-th-surface2',
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={`${import.meta.env.BASE_URL}api/favicon?host=${encodeURIComponent(host)}`}
        width={size}
        height={size}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          'shrink-0 rounded-sm transition-opacity duration-150 motion-reduce:transition-none',
          loaded ? 'opacity-100' : 'opacity-0',
          className,
        )}
      />
    </span>
  );
}
