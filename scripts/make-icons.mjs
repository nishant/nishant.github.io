// Renders public/favicon.svg to public/icon-192.png and public/icon-512.png with Playwright.
// Run with `node scripts/make-icons.mjs` (needs playwright installed); the PNGs are committed.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await page.screenshot({
      path: fileURLToPath(new URL(`../public/icon-${size}.png`, import.meta.url)),
      omitBackground: true,
    });
    await page.close();
    console.log(`wrote public/icon-${size}.png`);
  }
} finally {
  await browser.close();
}
