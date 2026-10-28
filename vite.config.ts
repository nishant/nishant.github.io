/// <reference types="vitest/config" />
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const require = createRequire(import.meta.url);

/** Inlines @nish/ui's theme-init.js at the top of <head>, so the saved theme is on <html>
 *  before the first paint. */
function nishThemeInit(): Plugin {
  const code = readFileSync(require.resolve('@nish/ui/theme-init.js'), 'utf8');
  return {
    name: 'nish-theme-init',
    transformIndexHtml: () => [{ tag: 'script', children: code, injectTo: 'head-prepend' }],
  };
}

/** Empties docs/ before a build but keeps docs/specs, which holds hand-written specs. */
function cleanDocsKeepSpecs(): Plugin {
  return {
    name: 'clean-docs-keep-specs',
    apply: 'build',
    buildStart() {
      if (!existsSync('docs')) return;
      for (const name of readdirSync('docs')) {
        if (name !== 'specs') rmSync(`docs/${name}`, { recursive: true, force: true });
      }
    },
  };
}

// The build is committed in docs/: the deploy and GitHub Pages both serve it.
export default defineConfig({
  base: './',
  plugins: [cleanDocsKeepSpecs(), nishThemeInit(), react(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom'] },
  build: { outDir: 'docs', emptyOutDir: false },
  server: { port: 4200, proxy: { '/api': 'http://localhost:8800' } },
  test: { environment: 'jsdom' },
});
