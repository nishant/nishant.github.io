# Start page rebuild (React + @nish/ui v0.7.0)

Status: in progress · Slug: ux-overhaul · Date: 2026-10-28 · Size: large
Repos: startpage (this spec). Depends on: ui v0.7.0 (spec `C:/Code/ui-ux-overhaul/docs/specs/ux-overhaul.md`), trading (the CORS + bars route, spec `C:/Code/trading-ux-overhaul/docs/specs/ux-overhaul.md`).
ROADMAP: `ROADMAP.md` → "Start page rebuild"

## Goal

start.nish.software is the page Nish opens a hundred times a day. It is an Angular 16 + Angular Material app from years ago that only uses the shared design system's CSS, has broken phone layouts (app buttons below the fold, tiny link targets, transparent Notes dialog, a Monaco editor that does not fit, weather/email dialogs that spin forever), and loads 5 MB. Rebuild it from the ground up in React + Vite + Tailwind 4 + @nish/ui (the stack of every other app), keeping every feature and every piece of saved data, and make it excellent on the Fold 7 (360px and ~840px) and on desktop.

Outcomes:
1. Same features, same URLs (`#/home`, `#/jp`, `/` → `#/home`), same saved data (the four localStorage keys, byte-compatible).
2. Home keeps its shape (search on top, a grid of link sections, a row of app buttons) and gains a clock/date line, a weather chip, live link filtering in search, proper 44px link rows with favicons, and a phone dock for the apps.
3. Notes: a full rich text editor (all the old toolbar features) that autosaves with a Saved indicator and an explicit Save button; never nags on close.
4. Settings: a structured editor for sections and links (add, rename, reorder, delete), a font picker with previews, a raw JSON tab, a Save button, and apply-on-close (the old behavior).
5. Weather: loading, denied and error states; current, hourly strip and daily list with range bars.
6. Mail: Gmail inbox via Google sign-in in the browser (read-only); clear "not set up" and "signed out" states; Google sign-in removed from the home page.
7. Watchlist (the old Stocks button, which said "coming soon"): the trading watchlist with prices and day change; tapping a symbol shows a price chart, all inside a sheet on the start page.
8. Anime + Manga page with a sticky scroll-spy chip nav and a responsive grid, reachable from the header.
9. First load under ~200 KB of JS for the home route (editors lazy), installable (manifest, icons), no layout shift.

## Out of scope

- Google Calendar and the Google sign-in button on the home page (removed).
- Multiple notes, cloud sync of config, a server-side Gmail token (Nish chose the in-browser sign-in).
- Editing the watchlist from the start page (read-only; editing stays in trading).

## Decisions

- Rebuild in React (Nish chose it): the design system's components are React; Angular could only use its CSS.
- Keep the committed build in `docs/` (Vite `outDir: 'docs'`, `emptyOutDir: true`, `base: './'`): the deploy and GitHub Pages both serve it, so `scripts/deploy.ps1` keeps working unchanged apart from the cache rule.
- Hash routing stays (`#/home`, `#/jp`) so old bookmarks work; implemented with a tiny hook, no router dependency.
- Storage contract unchanged (keys and formats below) so Nish's real links, notes and font survive the deploy.
- Notes: autosave (debounced 600ms) plus a Save button and Mod-S; no close prompt (Nish chose it).
- Settings: apply on close (as before) plus a Save button; invalid JSON blocks closing with an inline error instead of losing edits.
- Watchlist: the browser calls `https://trading.nish.software` directly with `credentials: 'include'` (Nish chose it). The trading session cookie is SameSite=Lax and start/trading are same-site, so the cookie is sent. Off the tailnet the fetch fails and the sheet says so. Base URL from `/api/config` (`TRADING_URL`, default `https://trading.nish.software`).
- Gmail: Google Identity Services token client loaded on demand, scope `https://www.googleapis.com/auth/gmail.readonly`, client id from `/api/config` (`GOOGLE_CLIENT_ID` in `server/.env`, a public value). Token cached in localStorage under the old key with its timestamp, valid 55 minutes (Nish chose it).
- Rich text: Tiptap (lazy). Raw JSON editor: CodeMirror 6 (lazy, only on the Raw JSON tab). Both themed from `--nish-*` tokens.
- Icons: lucide-react (tree-shaken), replacing Material Symbols, Font Awesome and Material Icons fonts.
- Fonts: the same ten choices; Fira Code and Roboto load from Google Fonts on demand when picked; the other eight are system fonts and show "Not on this device" when `document.fonts.check` fails.
- Search: Enter goes to Google in the same tab, with the query properly encoded (the old code did not encode `&`). Typing also shows up to 6 matching links from the config; arrow keys and Enter open one (default).
- Phone dock (default): the five app buttons become a fixed bottom dock below 768px (DS BottomNav), and an inline labelled row from 768px.
- Header nav (default): "Home" and "Anime" tabs in the AppHeader nav slot, so `#/jp` is reachable.

## Current state

- Angular app in `src/app/**`: `home` (search form posting to google.com/search, sections grid from `config`, favicons from `https://www.google.com/s2/favicons?domain=`, five app buttons opening MatDialogs, Google sign-in button), `notes` (ngx-editor, toolbar: bold, italic, underline, strike, code, blockquote, ordered/bullet list, headings h1-h6, link, image, text color, background color, align left/center/right/justify; a custom Save menu item), `settings` (Monaco JSON editor + font mat-select; config and font applied when the dialog closes), `weather` (geolocation → `/api/weather/data` + `/api/weather/location`, Kelvin → °F, Current/Hourly/Daily views, icon map OWM code → Material Symbol), `email` (Gmail list via access token from angularx-social-login; rows open `https://mail.google.com/mail/u/0/#inbox/<id>`), `stocks` (empty; button shows "Stocks is coming soon."), `anime/jp-list` (8 categories from `links.ts`, 472 lines, link types Streaming, Schedules, Manga, Information, Tools, Guides, Novels, Downloads), `anime/navigator` (scroll to section + highlight), `footer` ("Created by Nishant Arora | View Source" → https://github.com/nishant/nishant.github.io).
- Storage (`src/app/constants.ts`), must stay byte-compatible:
  - `nishant.github.io-config`: JSON `{ "sections": [{ "header": string, "links": [{ "text": string, "url": string }] }] }`, written with `JSON.stringify(config, null, '\t')`. Default from `src/app/config/config.json`.
  - `nishant.github.io-notes`: an HTML string (ngx-editor output, e.g. `<p>hello <strong>x</strong></p>`).
  - `nishant.github.io-font`: the raw family name, e.g. `Fira Code` (no quotes, no fallback list).
  - `nishant.github.io-google-access-token`: JSON `{ "accessToken": string, "timestamp": number }`.
- `server/` (Express 5, port 8800, keep): serves `../docs` with SPA fallback, `/health`, `/api/weather/data?lat&lon` → `{ current, hourly: first 5, daily: first 3 }` (raw One Call 3.0 objects; temperatures in Kelvin), `/api/weather/location?lat&lon` → `{ city, state, country, lat, lon }`; 503 when `OPENWEATHERMAP_API_KEY` is missing; CORS allow-list. Static cache rule matches Angular's 16-hex hashes only.
- `scripts/deploy.ps1` (pull, `npm ci` + build in `server/`, restart the `Startpage` task, health check; requires `docs/index.html`), `.github/workflows/deploy.yml` (check job builds Angular on Node 18 and typechecks server; deploy job on the self-hosted runner).
- `scripts/sync-theme-init.mjs` copies @nish/ui theme-init into `src/index.html` (replaced by a Vite plugin).

## Design

### Stack and files

- `package.json` (root): `"type": "module"`; scripts `dev` (`vite`), `build` (`tsc -b && vite build`), `typecheck` (`tsc -b`), `test` (`vitest run`), `check` (`npm run typecheck && npm test && npm run build`), `deploy` (alias of build, kept because docs mention it). Dependencies: react, react-dom (19), `@nish/ui` (`https://codeload.github.com/nishant/ui/tar.gz/refs/tags/v0.7.0`), lucide-react, `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-link`, `@tiptap/extension-image`, `@tiptap/extension-text-align`, `@tiptap/extension-text-style`, `@tiptap/extension-color`, `@tiptap/extension-highlight`, `@tiptap/extension-placeholder`, `codemirror`, `@codemirror/lang-json`, `@codemirror/lint`. Dev: vite, @vitejs/plugin-react, tailwindcss, @tailwindcss/vite, typescript, vitest, jsdom, @testing-library/react, @types/react, @types/react-dom. Remove every Angular, Material, ngx-*, moment, monaco, angularx-social-login, karma and jasmine package. (If @nish/ui v0.7.0 is not tagged yet when a task runs, temporarily use `"@nish/ui": "file:../ui-ux-overhaul"` after running `npm run build` there, and say so in notes; the integrator switches it back to the tag.)
- `vite.config.ts`: plugins `nishThemeInit()` (inline `@nish/ui/theme-init.js` at head-prepend, as in the ui README), react, tailwindcss; `base: './'`, `build.outDir: 'docs'`, `emptyOutDir: true`; dev server port 4200 with proxy `/api` → `http://localhost:8800`. Vitest: `environment: 'jsdom'`.
- `index.html`: `<html lang="en" data-nish-themes="dark light">`, viewport `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`, `<meta name="color-scheme" content="dark light">`, description "Nish's start page", `<link rel="icon" href="favicon.svg" type="image/svg+xml">`, `<link rel="icon" href="favicon.ico" sizes="any">`, `<link rel="manifest" href="manifest.webmanifest">`, `<link rel="apple-touch-icon" href="icon-192.png">`, `<title>Start</title>`, and an inline pre-paint font script (below). No static theme-color meta (theme-init owns it).
- `public/`: `favicon.ico` (copy from `src/favicon.ico`), `favicon.svg` (a rounded square in `#6366f1` with a white "S"), `manifest.webmanifest` (`name` "Start", `short_name` "Start", `start_url` "./#/home", `display` "standalone", `background_color` "#0a0b0f", `theme_color` "#0a0b0f", icons: favicon.svg any, `icon-192.png` and `icon-512.png` purpose any maskable, generated by `scripts/make-icons.mjs` with Playwright screenshotting the SVG, committed).
- Delete: `src/app/**`, `src/styles/**`, `src/styles.scss`, `src/main.ts`, `src/index.html`, `angular.json`, `tsconfig.app.json`, `tsconfig.spec.json`, `proxy.conf.json`, `scripts/sync-theme-init.mjs`, the old `docs/*` build (replaced by the new build).

```
src/
  main.tsx                 // initTheme(); applyStoredFont(); createRoot(...).render(<App/>)
  index.css                // @import 'tailwindcss'; @import '@nish/ui/tailwind.css'; body font var
  App.tsx                  // routes, header, sheets host, Toaster
  lib/storage.ts           // keys, Config types, tolerant load/save/parse
  lib/font.ts              // FONTS, applyFont, loadGoogleFont, fontAvailable
  lib/route.ts             // useHashRoute()
  lib/config-context.tsx   // ConfigProvider, useConfig
  lib/api.ts               // getAppConfig() -> /api/config (cached promise)
  pages/Home.tsx
  pages/Anime.tsx, pages/anime-links.ts
  components/SearchBar.tsx, LinkGrid.tsx, AppDock.tsx, Clock.tsx, Footer.tsx
  features/notes/NotesSheet.tsx, Editor.tsx, Toolbar.tsx
  features/settings/SettingsSheet.tsx, LinksEditor.tsx, AppearanceTab.tsx, JsonTab.tsx, JsonEditor.tsx
  features/weather/WeatherSheet.tsx, WeatherChip.tsx, weather.ts (types, mapping, useWeather)
  features/mail/MailSheet.tsx, gmail.ts
  features/watchlist/WatchlistSheet.tsx, SymbolDetail.tsx, trading.ts
```

### Shared contracts (exact)

```ts
// lib/storage.ts
export const KEYS = { config: 'nishant.github.io-config', notes: 'nishant.github.io-notes', font: 'nishant.github.io-font', googleToken: 'nishant.github.io-google-access-token' } as const;
export interface LinkItem { text: string; url: string }
export interface Section { header: string; links: LinkItem[] }
export interface Config { sections: Section[]; [extra: string]: unknown } // unknown top-level keys are preserved
export const DEFAULT_CONFIG: Config; // copy of src/app/config/config.json (move the file to src/lib/default-config.json)
export function serializeConfig(c: Config): string; // JSON.stringify(c, null, '\t')
export type ParseResult = { ok: true; config: Config } | { ok: false; error: string; line?: number; column?: number };
export function parseConfig(text: string): ParseResult; // JSON.parse; must be an object with a sections array of { header: string, links: { text: string, url: string }[] }; trims text/url/header; extra keys inside links/sections preserved; error message plain ("Line 4, column 12: Unexpected token }") computed from the JSON.parse position
export function loadConfig(): { config: Config; warning?: string }; // missing → DEFAULT_CONFIG (and save it, as the old app did); invalid → DEFAULT_CONFIG + warning "Your saved links could not be read, so the defaults are showing. Open Settings → Raw JSON to fix them." and DO NOT overwrite the bad value
export function saveConfig(c: Config): void;
export function loadNotes(): string; export function saveNotes(html: string): void;
export function loadFont(): string; // default 'Fira Code'
export function saveFont(f: string): void;
// every access in try/catch; a failed write throws an Error('Could not save: storage is full or blocked') that callers turn into a toast
```
```ts
// lib/font.ts
export const FONTS: { family: string; source: 'google' | 'system' }[] = [
  { family: 'Fira Code', source: 'google' }, { family: 'Roboto', source: 'google' },
  { family: 'Helvetica', source: 'system' }, { family: 'Verdana', source: 'system' }, { family: 'Times', source: 'system' },
  { family: 'Times New Roman', source: 'system' }, { family: 'Courier', source: 'system' }, { family: 'Courier New', source: 'system' },
  { family: 'Arial', source: 'system' }, { family: 'Arial Narrow', source: 'system' }];
export function applyFont(family: string): void; // sets --app-font on <html> to `'${family}', ui-monospace, monospace` (Fira Code/Courier*) or `'${family}', system-ui, sans-serif`; loads Google CSS once for google fonts (link https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap / Roboto:wght@400;500;700)
export function fontAvailable(family: string): boolean; // document.fonts.check(`16px "${family}"`)
```
index.html pre-paint script (inline, before the stylesheet): reads `localStorage['nishant.github.io-font']` in try/catch and sets `document.documentElement.style.setProperty('--app-font', ...)` with the same fallback rule, and injects the Google CSS link for Fira Code / Roboto. `index.css`: `body { font-family: var(--app-font, 'Fira Code', ui-monospace, monospace); }`. The font applies everywhere, including sheets and #/jp (the old app missed those).

```ts
// lib/route.ts
export type Route = 'home' | 'jp';
export function useHashRoute(): Route; // '#/jp' → 'jp'; '#/home', '', '#/', anything else → 'home' and replaceState to '#/home'; listens to hashchange; scrolls to top on change
// lib/config-context.tsx
export function ConfigProvider({ children }): JSX.Element; // loads once; shows the load warning as toast.warn on mount
export function useConfig(): { config: Config; setConfig: (c: Config) => void /* saves + updates state; toast.error on storage failure */ };
// lib/api.ts
export interface AppConfig { googleClientId: string | null; tradingUrl: string }
export function getAppConfig(): Promise<AppConfig>; // fetch('/api/config'); on failure resolves { googleClientId: null, tradingUrl: 'https://trading.nish.software' }
// App ids for sheets
export type AppId = 'notes' | 'weather' | 'watchlist' | 'mail' | 'settings';
// Every sheet: export function XSheet({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element
```

### App shell (App.tsx)

- `<ConfigProvider>` wraps everything; `<Toaster />` once (no offset prop: v0.7.0 lifts it above the dock automatically).
- `AppHeader` with `name="Start"`, `hideNameBelow` not set, `sticky` on #/jp only (home: not sticky, search is the sticky element), `nav` = two `tabClass` links "Home" (`#/home`) and "Anime" (`#/jp`) with `aria-current="page"` on the active one. Hub pill and ThemeToggle as the DS default.
- Sheet state: `const [sheet, setSheet] = useState<AppId | null>(null)`; each sheet rendered with `open={sheet === id}`; Modal `closeOnBack` (DS default) makes Android back close it. `NotesSheet` and `SettingsSheet` are `React.lazy` imports wrapped in `Suspense` with a centered Spinner fallback inside a Modal.
- `useDocumentTitle(route === 'jp' ? 'Anime + Manga' : undefined, { app: 'Start' })`.
- Keyboard: `/` focuses search (SearchBar handles it), `Escape` closes sheets (DS).

### Home (`#/home`)

Layout, max width 72rem centered, `px-[var(--nish-page-gutter)]`, `nish-pad-bottom-inset` (room above the phone dock):
1. Clock line (`Clock.tsx`): `Wednesday, October 28` and the time `7:42 PM` (`time()` from @nish/ui/format), updated every 15s (useNow). Right of it the `WeatherChip` (icon + `68°`, from the weather cache only; never triggers geolocation by itself; tap opens the weather sheet; hidden when no cache). Text `text-sm text-th-hi3`, the time `text-th-hi2 tabular-nums`. 360: both on one line, date shortened to `Wed, Oct 28` below 400px.
2. Search (`SearchBar.tsx`): wrapped in `StickyBar` (opaque, sticky at top 0 on home since the header is not sticky; pass `top="0px"`), a `SearchInput` size lg (min-h-12, 16px font, icon left, clear button), placeholder `Search Google` plus a `Kbd` `/` hint at md+ (fine pointers only). `autoFocus` only when `matchMedia('(pointer: fine)')` (so the phone keyboard does not pop up). Typing shows a listbox panel under the input (absolute, `bg-th-elevated`, `shadow-pop`, radius, max 6 rows of `ListRow dense` with Favicon, link text, host in hi3, section name as meta) of config links whose text or host contains the query (case-insensitive), ranked prefix first. ↑/↓ moves the highlight (`aria-activedescendant`), Enter opens the highlighted link in the same tab, Enter with no highlight goes to `https://www.google.com/search?q=${encodeURIComponent(q)}` in the same tab, Escape clears then blurs. Empty query on Enter: nothing. The panel closes on blur (after a 120ms delay so a tap on a row works).
3. Link grid (`LinkGrid.tsx`): `grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]`; each section a `Card padding="none"`: header row `px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-th-sky` (the old header color) with the link count in hi3 on the right; links as `ListRow dense` rows inside a `ul` with `Favicon url label=text size=20`, the text truncated with `title`, the whole row the `<a href>` (same tab, as before), `min-h-11` (`min-h-10` at lg with a fine pointer). Empty section: a muted "No links" row. Zero sections: `EmptyState` "No links yet" with a Button "Open Settings" (opens settings).
4. App row (`AppDock.tsx`): from md an inline centered row of 5 `Button variant="secondary"` with icon + label: Notes (`NotebookPen`), Weather (`CloudSun`), Watchlist (`ChartCandlestick`), Mail (`Mail`), Settings (`Settings`), with `aria-haspopup="dialog"`. Below md the same five as a `BottomNav` (`hideFrom="md"`, `label="Apps"`, items with `onSelect`, `active` = the open sheet).
5. Footer (`Footer.tsx`): in flow at the end, centered `text-xs text-th-hi3`: `Created by Nishant Arora · ` + link `View source` (https://github.com/nishant/nishant.github.io, target _blank rel noopener noreferrer, `linkClass()`), padding-bottom handled by the page.
- Background: a subtle radial gradient behind the top of the page: `bg-[radial-gradient(ellipse_at_top,var(--nish-accent-soft),transparent_60%)]` on a `pointer-events-none absolute inset-x-0 top-0 h-80 -z-10` div; static, no animation.
- Entrance: sections fade in once (`motion-safe:animate-[nish-fade-in_.2s_ease-out]` if the keyframe exists in base.css; otherwise skip). No skeleton needed: config is synchronous.

### Notes sheet

- `Modal` title "Notes", `size="xl"`, `sheetHeight="full"` on phones, `subtitle` = save status: "Saved" (with a check icon, hi3), "Saving…", "Not saved" (warn, when the last write failed). Footer: `Button` "Save" (secondary, `Kbd` Ctrl S hint on fine pointers) and "Done" (primary, closes). Closing never prompts; it flushes a pending autosave first.
- Editor (`Editor.tsx`, lazy): Tiptap with StarterKit (headings 1-6, bold, italic, strike, code, blockquote, lists), Underline, Link (`openOnClick: false`, autolink), Image (by URL), TextAlign (paragraph, heading), TextStyle + Color, Highlight (multicolor), Placeholder "Write something…". Initial content `loadNotes()`. `onUpdate` → debounce 600ms → `saveNotes(editor.getHTML())`. Mod-S saves now (preventDefault). The editor area: `prose`-like styles with tokens (`text-th-hi`, links `text-th-accent`, blockquote border `th-line-strong`, code `bg-th-surface-2`), 16px font, `min-h-[50dvh]`, flex-1 with internal scroll on phones.
- Toolbar (`Toolbar.tsx`): one row in a `ScrollRow` of 40px (44 on touch) IconButtons with tooltips on fine pointers: Bold, Italic, Underline, Strike, Inline code, Quote, Numbered list, Bullet list, Heading (DropdownMenu: Paragraph, H1…H6), Link (Popover with a URL input + Apply/Remove), Image (Popover with a URL input), Text color (Popover with 8 swatches from `--nish-chart-1..8` + Reset), Highlight (same swatches at 30% + Reset), Align (DropdownMenu: left, center, right, justify). Active marks get `aria-pressed` and the pressed look. Desktop: toolbar above the editor with a bottom border. Phone: toolbar fixed to the bottom of the sheet above the keyboard (the sheet is full height and the viewport meta uses `interactive-widget=resizes-content`, so a toolbar at the bottom of a flex column sits above the keyboard).

### Settings sheet

- `Modal` title "Settings", `size="xl"`, `sheetHeight="full"` on phones. `Tabs` (block on phones): "Links", "Appearance", "Raw JSON". A draft `Config` lives in the sheet's state, initialised from `useConfig()` on open.
- Footer: left a status text ("Unsaved changes" in warn when draft ≠ saved, else "Changes apply when you close" in hi3); right `Button` "Save" (primary, disabled when clean): validates, `setConfig(draft)`, `toast.success('Saved')`, stays open.
- Close (X, Escape, backdrop, swipe, back): if the draft is valid → `setConfig(draft)` when dirty, then close (the old apply-on-close). If the Raw JSON tab holds invalid JSON → stay open, switch to that tab, show the error Callout, and `toast.error("Fix the JSON before closing, or discard your edits")` with an action "Discard" that closes without saving.
- Links tab (`LinksEditor.tsx`): a list of section cards. Section header row: a text `Input` (16px, aria-label "Section name"), IconButtons move up / move down (disabled at the ends), delete (opens `ConfirmDialog` "Delete {name}?" body "Its {n} links go too." tone danger). Inside, link rows: `Favicon` + two inputs (Name, URL `type="url" inputMode="url"`), stacked on phones (`grid-cols-1`, from sm `grid-cols-[1fr_1.4fr]`), with up/down/delete IconButtons (delete without confirm, but a toast with "Undo"). An invalid URL (not parseable by `new URL`, after adding `https://` when it has no scheme on blur) shows a field error "Enter a full address, like https://example.com". "+ Add link" (ghost button) at the bottom of each section adds an empty row and focuses its Name; "+ Add section" at the end adds "New section". Empty name or URL rows are dropped on save with no error.
- Appearance tab (`AppearanceTab.tsx`): "Font" as a radio list (one `label` per font, 44px rows, the name rendered in its own face, a sample "The quick brown fox" in hi3, a "Not on this device" Badge when `fontAvailable` is false after the Google CSS loaded for google fonts). Picking applies immediately (`applyFont` + `saveFont`, as the old picker did live). "Theme": `<ThemeToggle phone="segmented" block />`.
- Raw JSON tab (`JsonTab.tsx` + lazy `JsonEditor.tsx`): CodeMirror 6 with the JSON language, line wrapping, lint gutter (`jsonParseLinter`), tab size 2 for display, 16px font on touch, height `min(60dvh, 32rem)`, themed with tokens (background `--nish-surface`, text `--nish-hi`, selection `--nish-accent-soft`, gutter `--nish-hi3`). It edits `serializeConfig(draft)`; on change, `parseConfig` → valid updates the draft (so the Links tab reflects it), invalid shows `Callout tone="loss"` "Line 4, column 12: …". Buttons: "Format" (re-serialize when valid), "Reset to defaults" (ConfirmDialog, then draft = DEFAULT_CONFIG).

### Weather sheet and chip

- `weather.ts`: `useWeather(open)` state machine `idle | locating | loading | ready | error` with `error.kind: 'denied' | 'unavailable' | 'server' | 'not-configured'`. Geolocation `getCurrentPosition` with `{ enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }`; then both endpoints in parallel. Cache `{ data, location, at }` in sessionStorage `start-weather` for 10 minutes (opening the sheet within 10 minutes shows it instantly; a background refresh runs when older than 5 minutes). Kelvin → °F rounded. Times via `time(ts, { timeZone: data.timezone })` and dates via `date(ts, 'weekday')` from @nish/ui/format. Icon map: OWM icon code → lucide icon (01d Sun, 01n Moon, 02d CloudSun, 02n CloudMoon, 03/04 Cloud, 09 CloudDrizzle, 10 CloudRain, 11 CloudLightning, 13 Snowflake, 50 CloudFog).
- Sheet: `Modal` title = city (`Austin, TX` when state exists), subtitle `Updated 3m ago` (RelativeTime), `size="md"`, `sheetHeight="auto"`, header action IconButton Refresh.
  - Ready: hero row (48px icon in `text-th-accent`, `text-5xl tabular-nums` temperature, "Feels like 68°" and the description capitalized, right side "H 84° · L 65°" from daily[0]); `KeyValueList dense` in 2 columns from sm: Humidity %, Wind `12 mph` with a direction arrow rotated by wind_deg, UV index, Chance of rain (daily[0].pop %), Sunrise, Sunset. Then a `Segmented` "Next hours | Next days". Hours: a `ScrollRow snap` of 64px columns (time, icon, temp, rain % when pop ≥ 0.2) for the next 24 hours. Days: 7 `ListRow dense`-like rows: day label (`Today`, then `Thu 10/29`), icon, rain % (≥ 20%), a `RangeBar` (min = lowest low of the week, max = highest high, low/high of the day, current temp on today), and `65° / 84°` tabular.
  - Locating / loading: skeletons in the same shape (hero circle + 2 lines, 6 KeyValue rows, the segmented row) with the text "Finding your location…" while locating.
  - Errors: `ErrorState` with copy per kind: denied "Location is blocked" / "Allow location for start.nish.software in your browser settings, then try again."; unavailable "Couldn't find your location" / "Try again in a moment."; server "Weather is unavailable" / "The weather service didn't answer. Try again in a moment."; not-configured (503) "Weather isn't set up" / "Add OPENWEATHERMAP_API_KEY to server/.env on the PC.". Retry button on all but not-configured.
- `WeatherChip`: reads the sessionStorage cache only; shows icon + temperature; button opening the sheet; hidden without cache.

### Mail sheet

- `gmail.ts`: `loadGis(): Promise<void>` (inject `https://accounts.google.com/gsi/client` once), `requestToken(clientId, prompt: '' | 'consent'): Promise<string>` via `google.accounts.oauth2.initTokenClient({ client_id, scope: 'https://www.googleapis.com/auth/gmail.readonly', callback })`, cached token read/write in `KEYS.googleToken` (valid while `Date.now() < timestamp + 55 * 60_000`), `listInbox(token, pageToken?)`: `GET https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=25[&pageToken]`, then each message `GET .../messages/{id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date` with at most 6 requests in flight; maps to `{ id, from: string /* display name or address, without <...> */, subject: string ('(no subject)' when empty), snippet: string (HTML entities decoded), date: number (internalDate), unread: boolean (labelIds includes UNREAD) }`. A 401 throws `AuthError`.
- Sheet: `Modal` title "Inbox", `size="lg"`, `sheetHeight="tall"`; header actions: Refresh IconButton and a link button "Open Gmail" (https://mail.google.com/mail/u/0/#inbox, new tab). States:
  - Not configured (`googleClientId` null): `EmptyState` icon Mail, title "Gmail isn't set up yet", description "Add GOOGLE_CLIENT_ID to server/.env on the PC, then reload." 
  - Signed out (no valid token): `EmptyState` title "Connect Gmail to see your inbox", description "Read-only. Your mail stays in this browser.", primary Button "Connect Gmail" → requestToken(prompt '' first; 'consent' when that fails) → load.
  - Loading: 8 skeleton rows (two lines each, 64px).
  - List: `ul` of `ListRow` as `<a href="https://mail.google.com/mail/u/0/#inbox/{id}" target="_blank" rel="noopener noreferrer">`: title = sender (semibold when unread, with a 8px accent dot before it), meta = relative time (`ago` short, `Tue` style for older than 6 days via `date(t,'short')`), subtitle = subject on line 1 and snippet (hi3, clamp 1) on line 2. "Load more" Button at the end when there is a nextPageToken.
  - Expired (AuthError): clear the cached token, show the signed-out state with the description "Your Gmail session expired. Connect again to refresh it."
  - Other errors: `ErrorState` "Couldn't load your inbox" with the message and Retry.
- Footer link "Disconnect" (ghost, when signed in): revokes with `google.accounts.oauth2.revoke(token)` and clears the key.

### Watchlist sheet (the old Stocks button)

- `trading.ts`: `const base = (await getAppConfig()).tradingUrl`; `fetchJson(path)` with `credentials: 'include'`, `cache: 'no-store'`, 8s timeout via AbortController. Errors: HTTP 401 → `TradingAuthError`; network failure, CORS failure or timeout → `TradingUnreachableError`; other HTTP → `TradingError(message)`. `getOverview(): Promise<{ snapshots: Snapshot[]; updatedAt: string }>` (`GET /api/market/overview`), `getBars(symbol, range: '1D' | '1M' | '3M' | '1Y'): Promise<{ symbol: string; range: string; prevClose: number | null; bars: { t: string; c: number }[] }>` (`GET /api/tickers/{symbol}/bars?range=`). `Snapshot` = `{ symbol, price, prevClose, dayChangePct, dayHigh, dayLow, dayVolume, updatedAt }` (copy the type; dayChangePct is a percent number, e.g. -0.42 means −0.42%; verify against trading's shared types and its UI before formatting).
- Sheet: `Modal` title "Watchlist", subtitle `Updated 12s ago`, `size="lg"`, `sheetHeight="tall"`; header actions: Refresh IconButton and link "Open Trading" (base URL, new tab). Polls overview every 30s while open and the document is visible.
  - List: `ul` of rows (52px): symbol (semibold, mono) and day range text `$263.70 – $269.03` (hi3, hidden below 400px) on the left; on the right price `money()` tabular and a change Badge (`signed`, tone ok/loss/neutral, `pct(dayChangePct, { fromRatio: false, signed: true })`); under the row a `RangeBar` of dayLow–dayHigh with the current price (from sm). Tap → detail view.
  - Detail (`SymbolDetail.tsx`, same sheet, back IconButton "Back to list" in the header, Android back returns to the list via the sheet's own history entry or a nested state): symbol + price + change; `Segmented` 1D | 1M | 3M | 1Y (default 1D); `LineChart` (height 220, area, tone ok when last ≥ first else loss, baseline = prevClose on 1D, yFormat money, xFormat time on 1D / `date(t,'short')` otherwise, loading while fetching, keeps the last series dimmed while switching range); a `KeyValueList dense` 2 columns: Day range, Previous close, Volume (`num(compact)`), Updated (RelativeTime). Link "Open in Trading" → `${base}/tickers/${symbol}` new tab.
  - Loading: 6 skeleton rows. Empty watchlist: `EmptyState` "Your watchlist is empty" + link "Add symbols in Trading".
  - Signed out (TradingAuthError): `EmptyState` icon Lock, "Sign in to Trading", description "The watchlist uses your Trading sign-in.", Button link "Open Trading" (new tab) and "Try again".
  - Unreachable: `EmptyState` icon WifiOff, "Can't reach Trading", "Trading is only available on Tailscale. Connect to your tailnet and try again.", Button "Try again".

### Anime + Manga page (`#/jp`)

- `anime-links.ts`: the 472-line `links.ts` data moved as is (type `{ link: string; text: string; linkType: LinkType }`), plus `CATEGORIES` in the navigator's order with lucide icons: Streaming (Play), Manga (BookOpen), Novels (Library), Schedules (CalendarDays), Information (Info), Guides (Compass), Downloads (Download), Tools (Wrench).
- Layout: `PageContainer size="wide"`; H1 "Anime + Manga" (`text-2xl font-semibold`); `SectionNav` (sticky under the sticky AppHeader) with the 8 categories and their link counts, `updateHash={false}`; a grid `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4` of section Cards (id = category slug, class `nish-scroll-target`), each with a header (icon, name, count) and a `ul` of `ListRow dense external` rows (Favicon, text, host in hi3 from md). Links open in a new tab with `rel="noopener noreferrer"`. No numbering.

### Server (`server/`)

- `GET /api/config` → `{ googleClientId: process.env.GOOGLE_CLIENT_ID || null, tradingUrl: process.env.TRADING_URL || 'https://trading.nish.software' }` with `Cache-Control: no-cache`.
- Weather `/data`: return `hourly` first 24 and `daily` first 7, plus `timezone` and `timezone_offset` from One Call (backward compatible: same fields, more items).
- Static caching: Vite emits `assets/<name>-<hash>.js|css`; mark files under `/assets/` immutable (`/[\\/]assets[\\/].+-[A-Za-z0-9_-]{8,}\.(js|css|woff2|png|svg)$/`), everything else `no-cache` (index.html, manifest, icons).
- `server/.env.example`: add `GOOGLE_CLIENT_ID=` (comment: "OAuth web client id for Gmail (public value). Authorized JavaScript origin: https://start.nish.software") and `TRADING_URL=https://trading.nish.software`.
- Tests: none exist for the server; add `server/src/config.test.ts`? No test runner in server: skip; typecheck covers it.

### CI, docs

- `.github/workflows/deploy.yml` check job: Node 22, `npm ci`, `npm run check` (typecheck + vitest + build to a temp dir: `npx vite build --outDir /tmp/start-check`), then the server typecheck as today. Update comments (no Angular).
- `README.md`: rewrite the top (what the page is, stack, `npm run dev` with the server, `npm run build` writes `docs/`, storage keys table, Gmail setup steps: create an OAuth web client in Google Cloud Console, add `https://start.nish.software` as an Authorized JavaScript origin, put the id in `C:\Apps\startpage\server\.env` as `GOOGLE_CLIENT_ID`, restart; watchlist needs Tailscale and a Trading sign-in). Keep the "Hosting on nish.software" section, updated (no Angular).
- `CLAUDE.md`: replace "frontend changes need `npm run deploy` to rebuild `docs/`" with "`npm run build` rebuilds `docs/`; commit it", keep the rest.

### Security

- No secrets in the client; `GOOGLE_CLIENT_ID` is public. The Gmail token lives only in the browser (same as before). Trading data never passes through the start page server.
- All external links `rel="noopener noreferrer"`; user-entered URLs in config are rendered as `href` only when their scheme is http, https or mailto (others render as plain text rows with a warning icon and title "Unsupported link").
- Notes HTML is rendered only inside Tiptap (which sanitizes to its schema); never via `dangerouslySetInnerHTML`.

### Performance

- Home route JS ≤ 200 KB gzip-ish budget: React + @nish/ui + lucide icons used. Tiptap, CodeMirror, Gmail and Watchlist code are lazy (`React.lazy` per sheet; CodeMirror only on the Raw JSON tab).
- Favicons lazy-load with fixed boxes (no layout shift).

## Tasks

All tasks: repo startpage, checkout `C:\Code\startpage-ux-overhaul`. Do not edit files you do not own. Type errors in files owned by tasks still running are expected; check your own files with `npx tsc --noEmit -p tsconfig.json` and filter, and run your own tests with `npx vitest run <your test files>`.

### S1 Scaffold, libs, tooling
- Owns: `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json` (+ `tsconfig.node.json` if needed), `eslint.config.js`, `.prettierrc`, `.gitignore`, `index.html`, `public/**`, `scripts/make-icons.mjs`, `src/main.tsx`, `src/index.css`, `src/vite-env.d.ts`, `src/lib/**` (+ `src/lib/*.test.ts`), deletion of the Angular files listed above (except `docs/`, which S8 rebuilds).
- Depends on: none
- Change: Stack and files; Shared contracts; the font pre-paint script. `main.tsx` imports `./App` (owned by S8). Tests: `src/lib/storage.test.ts` (round-trip with TAB indent, tolerant parse, extra keys preserved, invalid → warning and no overwrite, missing → defaults saved, line/column in errors), `src/lib/route.test.ts`.
- Acceptance: `npm install` works; `npx vitest run src/lib` passes.

### S2 Home
- Owns: `src/pages/Home.tsx`, `src/components/SearchBar.tsx`, `src/components/LinkGrid.tsx`, `src/components/AppDock.tsx`, `src/components/Clock.tsx`, `src/components/Footer.tsx`, `src/components/*.test.tsx`
- Depends on: S1
- Change: Home section. `Home({ onOpen, openSheet }: { onOpen: (id: AppId) => void; openSheet: AppId | null })`. Tests: search ranking and Enter behavior (encoded Google URL; highlighted link), link rows render favicons and unsafe schemes as text.

### S3 Settings
- Owns: `src/features/settings/**`
- Depends on: S1
- Change: Settings sheet. Tests: dirty/valid close logic (a pure reducer or helper you write in `settings-state.ts`), link reorder/delete helpers.

### S4 Notes
- Owns: `src/features/notes/**`
- Depends on: S1
- Change: Notes sheet. Test: the debounce/flush helper.

### S5 Weather (client and server)
- Owns: `src/features/weather/**`, `server/src/routes/weather.ts`
- Depends on: S1
- Change: Weather sheet and chip; server weather changes. Tests: Kelvin conversion, icon map, the day/hour mapping from a fixture response (write `weather.fixture.json` from the documented shapes).

### S6 Mail (client and server config)
- Owns: `src/features/mail/**`, `server/src/index.ts`, `server/.env.example`
- Depends on: S1
- Change: Mail sheet; `/api/config` route and static cache rule in `server/src/index.ts`. Tests: message mapping (From parsing `"Name" <a@b.c>` → `Name`, entity decoding, unread), token cache validity.
- Acceptance also: `cd server && npm ci && npm run typecheck`.

### S7 Watchlist
- Owns: `src/features/watchlist/**`
- Depends on: S1
- Change: Watchlist sheet. Tests: error classification (401, network TypeError, timeout), change formatting.

### S8 App shell, Anime page, build, CI, docs
- Owns: `src/App.tsx`, `src/pages/Anime.tsx`, `src/pages/anime-links.ts`, `.github/workflows/deploy.yml`, `README.md`, `CLAUDE.md`, `docs/**` (the built output), `ROADMAP.md`
- Depends on: S2, S3, S4, S5, S6, S7
- Change: App shell; Anime page; CI and docs; run `npm run build` to regenerate `docs/` (delete the old Angular files in it).
- Acceptance: `npm run check` passes; `cd server && npm run build && node dist/index.js` (PORT=8811) serves `http://127.0.0.1:8811/#/home` with no console errors (check with Playwright at 360 and 1440), stop it after.

## Waves

W1: S1 · W2: S2, S3, S4, S5, S6, S7 · W3: S8

## Review focus

- Data compatibility: load Nish's real-shaped data (a config with 6 sections of 5-12 links, notes HTML from ngx-editor with headings, lists, colors and an image, font "Fira Code") into localStorage before loading the new build; everything must show and round-trip unchanged.
- Phone (360x780, 840x900 touch) and desktop (1440x900), light and dark: home above the fold (search, first sections, dock visible), every sheet, the keyboard with Notes and Settings inputs, Android back closing sheets.
- The watchlist error states (signed out, unreachable) and Gmail states without real credentials.
- Bundle: home route JS stays small; editors are lazy.

## Release

After ui v0.7.0 is tagged and trading's CORS + bars route is live: switch `@nish/ui` to the v0.7.0 tag if a file: link was used, `npm run build`, commit `docs/`, PR, merge (no PR checks: local `npm run check` is the gate), watch the `deploy` run, then verify https://start.nish.software/#/home and #/jp at 360/840/1440 in both themes (with seeded localStorage in Playwright), `/health`, `/api/config`.

## Open questions for the research phase

None.
