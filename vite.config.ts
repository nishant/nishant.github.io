/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const require = createRequire(import.meta.url);

/** Inlines @nish/ui's theme-init.js right after <meta charset>, so the saved theme is on <html>
 *  before the first paint (and the charset still comes within the first 1024 bytes). */
function nishThemeInit(): Plugin {
  const code = readFileSync(require.resolve('@nish/ui/theme-init.js'), 'utf8');
  return {
    name: 'nish-theme-init',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const charset = /<meta charset="utf-8"\s*\/?>/i;
        if (!charset.test(html)) throw new Error('nish-theme-init: <meta charset="utf-8"> not found in index.html');
        return html.replace(charset, (m) => `${m}\n    <script>${code}</script>`);
      },
    },
  };
}

/** Stamps dist/sw.js with a build id and the precache list, so every deploy changes sw.js and the
 *  browser installs the new worker. An unstamped sw.js (npm run dev) does nothing on fetch. */
function swStamp(): Plugin {
  let outDir = 'dist';
  return {
    name: 'sw-stamp',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    writeBundle(_options, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => !f.endsWith('.map'))
        .filter((f) => f.endsWith('.js') || f.endsWith('.css') || (f.endsWith('.woff2') && f.includes('latin')))
        .concat(['./', 'index.html', 'manifest.webmanifest', 'favicon.svg', 'icon-192.png'])
        .sort();
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
      const swPath = path.join(outDir, 'sw.js');
      let sw = readFileSync(swPath, 'utf8');
      const versionLine = "const SW_VERSION = '__SW_VERSION__';";
      const listLine = 'const SW_PRECACHE = [];';
      if (!sw.includes(versionLine) || !sw.includes(listLine)) {
        throw new Error('sw-stamp: placeholders missing in sw.js');
      }
      sw = sw.replace(versionLine, () => `const SW_VERSION = '${version}';`);
      sw = sw.replace(listLine, () => `const SW_PRECACHE = ${JSON.stringify(files)};`);
      writeFileSync(swPath, sw);
    },
  };
}

// The build goes to dist/, which the deploy builds on the PC and the server serves.
export default defineConfig({
  base: './',
  plugins: [nishThemeInit(), swStamp(), react(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom'] },
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: 4200, proxy: { '/api': 'http://localhost:8800' } },
  test: { environment: 'jsdom', exclude: ['**/node_modules/**', 'server/**'] },
});
