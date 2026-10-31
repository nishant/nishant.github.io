// Renders public/favicon.svg to public/icon-192.png and public/icon-512.png, plus the maskable
// variants public/icon-maskable-{192,512}.png, with Playwright.
// Run with `node scripts/make-icons.mjs` (needs playwright installed); the PNGs are committed.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
// Maskable icons are full-bleed (the OS applies its own mask), so no rounded corners; the glyph
// is 60% of the size and centered, inside the 80% safe zone.
const maskableSvg = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
  `<rect width="${size}" height="${size}" fill="#6366f1"/>` +
  `<text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central" ` +
  `font-family="Arial, Helvetica, sans-serif" font-size="${size * 0.6}" font-weight="700" fill="#fff">S</text></svg>`;

const browser = await chromium.launch();
try {
  for (const size of [192, 512]) {
    for (const [name, markup] of [
      [`icon-${size}.png`, svg],
      [`icon-maskable-${size}.png`, maskableSvg(size)],
    ]) {
      const page = await browser.newPage({ viewport: { width: size, height: size } });
      await page.setContent(
        `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`,
      );
      await page.screenshot({
        path: fileURLToPath(new URL(`../public/${name}`, import.meta.url)),
        omitBackground: true,
      });
      await page.close();
      console.log(`wrote public/${name}`);
    }
  }
} finally {
  await browser.close();
}
