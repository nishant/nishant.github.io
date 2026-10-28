import { linkClass } from '@nish/ui';

/** The credit line at the end of the home page. */
export function Footer() {
  return (
    <footer className="pt-6 text-center text-xs text-th-hi3">
      Created by Nishant Arora ·{' '}
      <a
        href="https://github.com/nishant/nishant.github.io"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass()}
      >
        View source
      </a>
    </footer>
  );
}
