// Copies @nish/ui's theme-init.js into src/index.html, between the
// "nish theme-init" markers, so the saved theme applies before first paint.
// It must stay an inline, render-blocking script: angular.json "scripts" load
// after the body and would flash the wrong theme. Runs before build and deploy.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const initPath = require.resolve('@nish/ui/theme-init.js');
const indexPath = new URL('../src/index.html', import.meta.url);

const init = readFileSync(initPath, 'utf8').trim();
const html = readFileSync(indexPath, 'utf8');
const re = /(<!-- nish theme-init: start[^>]*-->)[\s\S]*?(<!-- nish theme-init: end -->)/;
if (!re.test(html)) {
  console.error('sync-theme-init: markers not found in src/index.html');
  process.exit(1);
}
const next = html.replace(re, (_, start, end) => `${start}\n  <script>\n${init}\n  </script>\n  ${end}`);
if (next !== html) {
  writeFileSync(indexPath, next);
  console.log('sync-theme-init: updated src/index.html');
}
