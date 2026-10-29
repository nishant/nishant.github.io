// Builds the start page to .fold-dist and serves it with `vite preview` on FOLD_PORT
// (default 4174), in the foreground. Used by the Fold check (fold.visual.json); needs no
// secrets or server. Run: npm run fold:serve
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const port = String(process.env.FOLD_PORT || 4174);
const outDir = '.fold-dist';

// vite.config.ts empties docs/ before every build whatever the outDir; put the committed
// bundle back so a local run leaves the checkout clean.
function restoreDocs() {
  if (existsSync('.git')) spawnSync('git', ['checkout', '--', 'docs'], { stdio: 'ignore' });
}

const build = spawnSync('npx', ['vite', 'build', '--outDir', outDir], { stdio: 'inherit', shell: true });
restoreDocs();
if (build.status !== 0) process.exit(build.status ?? 1);

const child = spawn(
  'npx',
  ['vite', 'preview', '--outDir', outDir, '--host', '127.0.0.1', '--strictPort', '--port', port],
  { stdio: 'inherit', shell: true },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
