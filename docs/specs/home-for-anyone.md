# Start as a homepage anyone can use

Status: in progress · Slug: home-for-anyone · Date: 2026-10-31 · Size: large
Repos: nishant.github.io (startpage, spec lives here). Plus a one-line comment fix in nishant/hosting (done by the session, not a task).
ROADMAP: `ROADMAP.md`, "Homepage for anyone"

## Goal
start.nish.software is a public homepage that anyone can bookmark and set up. A new visitor should get a useful page straight away. Settings should move between browsers without accounts, and the page should be fast, work offline and stay private: no link list sent to Google, no Google Fonts. The public weather endpoint must not burn the paid quota.

1. Ctrl+K (Cmd+K) and `/` open a command palette (@nish/ui `CommandPalette`). It covers the user's links, the apps and pages, quick actions, and bangs: `!gh foo` searches GitHub, `!yt`, `!w` and others likewise. The home search bar's Enter also honors bangs.
2. Settings → a new **Backup** tab exports and imports the settings (links, font, theme, optionally notes) as a `.json` file. It can also copy a share link that carries the settings in the URL fragment. Opening such a link shows a preview and asks before replacing anything.
3. An offline app shell: after one visit, the page loads with no network (cached shell and hashed assets), and the API calls fail as they do today.
4. The Anime route is lazy-loaded. The Inbox route is lazy-loaded once workflows-inbox has moved `useInboxCounts` out of `src/pages/Inbox.tsx` (see Decisions).
5. The weather forecast is cached in localStorage with its 10-minute TTL, so a new tab doesn't refetch, and other open tabs pick up a fresh forecast.
6. Fira Code (default) and Roboto are self-hosted from npm packages. index.html and font.ts make no request to fonts.googleapis.com.
7. Link icons come from a same-origin `/api/favicon` proxy with caching, so the browser never sends the link list to Google. Without an icon, the existing letter avatar shows.
8. First visit: useful starter links instead of "header 1 / link 1 → google.com", and a dismissible welcome card that explains the page and offers to edit, import, or keep the starter set.
9. The weather endpoint rounds coordinates to 2 decimals before calling OpenWeatherMap. It has a daily upstream cap, a per-IP limit, and a same-site check.
10. `/health` no longer returns `staticDir`.
11. The frontend is built on the PC by `scripts/deploy.ps1` into `dist/`, and `docs/` stops holding the build. `docs/index.html` becomes a GitHub Pages redirect to start.nish.software that carries the visitor's links along.
12. Small fixes:
    - the CORS list is reduced to what is used;
    - the theme-init script is injected after `<meta charset>`;
    - the manifest has separate `any` and `maskable` icons;
    - URL normalization handles `host:port` links and runs on every parsed config (Raw JSON, import, load);
    - the hosting Caddyfile comment no longer says "Angular".

## Out of scope
- `src/pages/Inbox.tsx`, `src/features/inbox/*`. workflows-inbox owns them; its notification-action change to `public/sw.js` lands separately.
- `.github/workflows/*.yml`, `scripts/supervise.mjs`, `scripts/tasks.ps1`, `scripts/Startpage.task.xml`. server-kit owns them. `deploy.ps1` gets only the minimal change in T2.
- Accounts or server-side settings sync. Settings stay in the browser.
- A user-chosen default search engine (Google stays the default; bangs cover the rest).
- Changing @nish/ui. Its `Favicon` is hard-wired to Google, so this repo wraps the image itself (see T3). A `src` prop on `Favicon` is a later ui change.
- Security headers or CSP, which are not approved.

## Decisions
- **Palette hotkeys.** Ctrl/Cmd+K and `/` both open the palette, because `CommandPalette`'s built-in hotkey does both. SearchBar's own `/` listener is removed, so the two never fight. The search bar keeps link suggestions and gains bangs on Enter, so phone users without a keyboard get bangs too.
- **Bang syntax.** `!bang terms` or `terms !bang`, case-insensitive. An unknown bang searches Google for the whole text. A known bang with no terms opens the site's home page.
- **Custom bangs.** Optional `bangs` key in the config: `[{ "bang": "jira", "name": "Jira", "url": "https://x.atlassian.net/search?q=%s" }]`, edited in Raw JSON. They win over built-ins with the same name (default; cheap, and makes the page configurable for anyone).
- **Backup bundle format** `{ "app": "start", "v": 1, "exportedAt", "config", "font"?, "theme"?, "notes"? }`. A plain config object `{ "sections": [...] }` is also accepted on file import, so old Raw JSON copies work.
- **Share links** go in the hash, `#/home?settings=<code>`, so they never reach a server. `<code>` is `1.` + base64url(deflate-raw(JSON)) when `CompressionStream` exists, else `0.` + base64url(UTF-8 JSON). Share links never carry notes. When importing from a link, any `notes` field is ignored.
- **Size limit.** Share codes over 30,000 characters are refused with "Too many links for a share link. Download a file instead."
- **Imports always preview first.** Nothing replaces the current settings without a click. A share link can't silently swap someone's links for phishing ones.
- **Offline shell is build-stamped.**
  - A Vite plugin writes the build id and the precache list into `dist/sw.js`, so every deploy changes `sw.js` and the browser installs the new worker.
  - Navigations are network-first, with the cached shell used only when offline, so a deploy shows up on the next load exactly as today.
  - `/api/*` is never cached, except favicons.
  - In `npm run dev` (unstamped `sw.js`) the fetch handler does nothing.
- **One unversioned asset cache** `start-assets`, pruned to the newest 150 entries. An old open tab can still lazy-load the previous build's chunks after a deploy.
- **Favicon upstream.** DuckDuckGo `https://icons.duckduckgo.com/ip3/<host>.ico`, which answers 404 for unknown hosts. On a DuckDuckGo 404 the proxy tries Google `https://www.google.com/s2/favicons?sz=64&domain=<host>`, with redirects followed only to `*.gstatic.com`. Both 404 means no icon. Measured 2026-10-31: DDG answers 200 or 404 directly; Google answers 301 to gstatic, then 200 or 404.
  - The upstream sees the server's IP and a host name, never the visitor or the list.
  - The server only ever fetches those two fixed hosts, so there is no SSRF surface.
- **Rate limits are local helpers** (`server/src/lib/guard.ts`). The server is Express, and @nish/server is not out yet; server-kit can swap in its `clientIp()` and limiter later. Client IP is `cf-connecting-ip`, else the rightmost non-loopback X-Forwarded-For entry, else the socket address.
- **Same-site check.** Requests pass if `Sec-Fetch-Site: same-origin` is set, or if `Origin` (or `Referer` when `Sec-Fetch-Site` is absent) is the server's own origin or in the allowed list. Everything else gets 403. This stops other sites and casual scripts. The caps cover the rest.
- **Weather daily cap:** `WEATHER_DAILY_CAP` env, default 900 upstream calls per UTC day (data and location count alike), under One Call 3.0's 1,000 free calls. Once the cap is reached, a stale cache entry is served if one exists, else 503 with `code: "daily_cap"`.
- **Weather per-IP limit:** 60 requests per 10 minutes per IP across `/api/weather/*` → 429. **Favicon per-IP limit:** 300 upstream fetches per hour per IP (cache hits are free) → 429.
- **Build output** goes to `dist/` (already gitignored). The server's default `STATIC_DIR` becomes `../dist`. `docs/` keeps only `docs/index.html` (the Pages redirect), `docs/.nojekyll` and `docs/specs/`.
- **deploy.ps1** is owned by server-kit. The change here is minimal and isolated: build the frontend after `git reset`, while the task is stopped, and check `dist\index.html`. server-kit was told about it on 2026-10-31.
- **Lazy Inbox.** `App.tsx` imports `useInboxCounts` from `./pages/Inbox`, which pulls the whole page into the main chunk, and this session may not edit Inbox.tsx. workflows-inbox was asked on 2026-10-31 to move the hook into `src/features/inbox/counts.ts`. T4 lazy-loads Inbox only if that file exists on master when T4 runs; otherwise it leaves the Inbox import as it is and says so. The session does it after the other PR merges.
- **First visit** means the config key `nishant.github.io-config` is absent at load. A saved config equal to the old placeholder default (six "header N" sections of "link N → https://google.com") also counts as a first visit: it is replaced by the new default. The welcome card shows until dismissed. Dismissal is stored in `nishant.github.io-welcome-dismissed` = `"1"`.
- **Fonts.** `@fontsource-variable/fira-code` and `@fontsource-variable/roboto`. Fira Code's CSS is imported into the main bundle; its unicode-range subsets download only when needed. Roboto's CSS is imported dynamically when chosen.
- **CORS list.** `https://start.nish.software` only; the server's own origin is always allowed. `localhost:4200` is covered by the self check through the Vite proxy, which keeps the Host header. `nishant.github.io` no longer calls the API (it redirects), and `nish.software` never did.

## Current state
- `src/App.tsx`: the hash routes `home | jp | inbox` (from `lib/route.ts`), the lazy sheets (`SHEETS` map of `AppId` → lazy component), and `AppHeader` nav. `Anime` and `InboxPage` / `useInboxCounts` are static imports.
- `src/components/SearchBar.tsx`: the sticky search field.
  - `matchLinks`, `resolveEnter` and `googleSearchUrl` are exported and tested in `src/components/home.test.tsx`.
  - Lines 81-91 hold a document `/` keydown listener that focuses the field.
  - Shows a `<Kbd>/</Kbd>` hint, and uses `Favicon` from @nish/ui in suggestions.
- `src/components/LinkGrid.tsx`: `isSafeUrl`, `hostOf`, `LinkGrid`, `SectionCard`, `LinkRow` (uses `Favicon`). `src/pages/Anime.tsx` also uses `Favicon` and `hostOf`.
- @nish/ui v0.10.0 (`node_modules/@nish/ui/dist/index.d.ts`):
  - `CommandPalette({ open, onOpenChange, items, placeholder, emptyText, hotkey, onQuery, footer, onSubmitQuery })` and `CommandItem { id, label, group?, hint?, keywords?, icon?, href?, external?, onSelect? }`, plus `useCommandHotkey` and `navigateFromLayer`.
  - With an items array, the palette ranks by label (prefix, word start, substring, subsequence), then keywords (prefix, word start, substring), and groups rows with ungrouped rows first. `onSubmitQuery` fires only when nothing matches. An `href` item navigates with `navigateFromLayer` (or `window.open` when `external`).
  - `Favicon({ url, size, label })` always loads `https://www.google.com/s2/favicons`. Given a URL with no host (e.g. `""`), it renders only the colored letter avatar.
  - Theme: `getThemeChoice()`, `setThemeChoice(choice)`, `isThemeName(v)`, `cycleTheme()` (exported from `@nish/ui`; check `dist/index.d.ts`, else `@nish/ui/theme`). The choice is stored under localStorage `nish-theme`.
- `src/lib/storage.ts`:
  - `KEYS` (config, notes, font, googleToken), `Config` / `Section` / `LinkItem`, `DEFAULT_CONFIG` (from `default-config.json`: six placeholder sections).
  - `parseConfig(text)`, which validates and trims but does not normalize URLs.
  - `loadConfig()`, which writes the default when the key is absent. Also `saveConfig`, `loadNotes`/`saveNotes`, `loadFont`/`saveFont`.
- `src/features/settings/settings-state.ts`:
  - `normalizeUrl` (line 68) treats `localhost:3000` and `example.com:8080/x` as having a scheme, because its regex accepts `.` and stops at the first `:`.
  - `finalizeConfig` normalizes only on save.
- `src/features/settings/SettingsSheet.tsx`: `TABS` = links, appearance, json; `TabId` type; `Tabs` / `TabPanel` from @nish/ui. `JsonTab.tsx` and `AppearanceTab.tsx` (font list from `lib/font.ts` `FONTS` with `source: 'google' | 'system'`; `missing` only for system fonts).
- `src/lib/font.ts` loads Google Fonts CSS links. `index.html` has a pre-paint inline script that sets `--app-font` and also injects the Google CSS link.
- `src/features/weather/weather.ts`: `CACHE_KEY = 'start-weather'` in **sessionStorage** (`readWeatherCache`, `writeWeatherCache`, which dispatches `CACHE_EVENT` on window). `getJson` maps 503 to `'not-configured'`. `WeatherChip.tsx` listens to `CACHE_EVENT`.
- `public/sw.js`: push and notificationclick only, with no fetch handler. Registered in `main.tsx` only when `isPushHost()` (start.nish.software and local hosts).
- `vite.config.ts`:
  - `nishThemeInit()` injects `@nish/ui/theme-init.js` with `injectTo: 'head-prepend'`, i.e. before `<meta charset>`.
  - `cleanDocsKeepSpecs()` empties `docs/` except `specs`; `outDir: 'docs'`; `base: './'`.
- `public/manifest.webmanifest`: icons 192/512 marked `"any maskable"`. `scripts/make-icons.mjs` renders `public/favicon.svg` with Playwright.
- Server:
  - `server/src/index.ts`: Express 5, `trust proxy loopback`, a CORS allowlist, `/health` returning `staticDir`, `/api/config`, `/api/weather`, `/api/inbox` (do not touch), the `/api` 404, and static `STATIC_DIR` (default `../../docs` from `dist/`) with immutable caching for `assets/*-hash.*`.
  - `server/src/routes/weather.ts`: axios, an in-memory cache (500 entries) keyed by 2-decimal coords, but the upstream call uses the raw coords.
  - Tests: `server/package.json` `"test": "tsc -p tsconfig.json && node --test dist/routes/inbox.test.js"`, using node:test against compiled JS.
- `scripts/deploy.ps1`: `Run` helper. It resets the live checkout, stops the task, runs `npm ci` and the build in `server/`, checks `docs\index.html`, starts the task, and polls `/health`.

## Design

### Data
```ts
// src/lib/backup.ts
export interface SettingsBundle {
  app: 'start';
  v: 1;
  exportedAt: string;          // ISO
  config: Config;
  font?: string;               // one of FONTS[].family
  theme?: string;              // a ThemeChoice ('system' | theme name)
  notes?: string;              // Notes HTML; file exports only
}
// Config gains an optional, preserved key (unknown keys were already preserved):
export interface CustomBang { bang: string; name: string; url: string } // url contains %s
// config.bangs?: CustomBang[]
```
Server responses:
- `GET /health` → `{ "ok": true, "weatherConfigured": true }`
- `GET /api/favicon?host=github.com` → `200 image/*` bytes (`Cache-Control: public, max-age=604800`, `X-Content-Type-Options: nosniff`, `X-Cache: HIT|MISS`), `404 {"error":"no icon"}` (`Cache-Control: public, max-age=86400`), `400 {"error":"bad host"}`, `403 {"error":"forbidden"}`, `429 {"error":"too many requests"}` + `Retry-After`.
- Weather over the cap: `503 {"error":"Weather has reached today's limit. Try again tomorrow.","code":"daily_cap"}`. Over the per-IP limit: `429 {"error":"Too many weather requests. Try again in a few minutes."}` + `Retry-After`.

### UI
**Command palette** (`src/features/palette/CommandMenu.tsx`), mounted once in `App.tsx`, `placeholder="Search links, apps, or type !gh …"`, `emptyText="No matches. Press Enter to search Google."`, `onSubmitQuery` = go to `googleSearchUrl(q)`. Items, in this order:
- Group **Links**: each safe link (`isSafeUrl`). `label` = link text; `hint` = host; `keywords` = [host, section header]; `icon` = `<SiteIcon url label size={18} />`; `href` = url.
- Group **Apps**: Notes, Weather, Watchlist, Mail, Settings (`onSelect` opens the sheet), with the same lucide icons as `AppDock.APPS`. Also "Anime + Manga" (`href: '#/jp'`) and "Inbox" (`href: '#/inbox'`), with `keywords` ['page'].
- Group **Actions**:
  - "Switch theme" → `cycleTheme()`, then `toast.info` with "Theme: System|Light|Dark";
  - "Export settings" → download a file (see Backup);
  - "Copy share link" → as in Backup;
  - "Import settings" → open the Settings sheet on the Backup tab.
- Group **Bangs**, shown only while the query starts with `!`: one item per bang (built-ins plus custom), `label` = `"<name> search"`, `hint` = `!<bang>`, `keywords` = [`!<bang>`].
- Dynamic item when the query is a bang search (`parseBang` succeeds with terms): the items array is ONLY `[{ id: 'bang', label: 'Search <name> for “<terms>”', hint: '!<bang>', keywords: [query], href }]`.
- Dynamic item for any other non-empty query that does not start with `!`: append `{ id: 'web', group: 'Search', label: 'Search Google for “<q>”', keywords: [q], href: googleSearchUrl(q) }`, so it always matches.
- Track the query with `onQuery`. Reset it to '' whenever the palette opens.

**Bangs** (`src/features/palette/bangs.ts`):
```ts
export interface Bang { bang: string; name: string; url: string; home: string } // url has %s
export const BUILTIN_BANGS: Bang[] = [
  { bang: 'g', name: 'Google', url: 'https://www.google.com/search?q=%s', home: 'https://www.google.com' },
  { bang: 'gh', name: 'GitHub', url: 'https://github.com/search?q=%s', home: 'https://github.com' },
  { bang: 'yt', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s', home: 'https://www.youtube.com' },
  { bang: 'w', name: 'Wikipedia', url: 'https://en.wikipedia.org/w/index.php?search=%s', home: 'https://en.wikipedia.org' },
  { bang: 'a', name: 'Amazon', url: 'https://www.amazon.com/s?k=%s', home: 'https://www.amazon.com' },
  { bang: 'm', name: 'Google Maps', url: 'https://www.google.com/maps/search/%s', home: 'https://www.google.com/maps' },
  { bang: 'i', name: 'Google Images', url: 'https://www.google.com/search?tbm=isch&q=%s', home: 'https://images.google.com' },
  { bang: 'r', name: 'Reddit', url: 'https://www.reddit.com/search/?q=%s', home: 'https://www.reddit.com' },
  { bang: 'so', name: 'Stack Overflow', url: 'https://stackoverflow.com/search?q=%s', home: 'https://stackoverflow.com' },
  { bang: 'mdn', name: 'MDN', url: 'https://developer.mozilla.org/en-US/search?q=%s', home: 'https://developer.mozilla.org' },
  { bang: 'npm', name: 'npm', url: 'https://www.npmjs.com/search?q=%s', home: 'https://www.npmjs.com' },
  { bang: 'hn', name: 'Hacker News', url: 'https://hn.algolia.com/?q=%s', home: 'https://news.ycombinator.com' },
  { bang: 'ddg', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', home: 'https://duckduckgo.com' },
  { bang: 'tr', name: 'Google Translate', url: 'https://translate.google.com/?sl=auto&text=%s', home: 'https://translate.google.com' },
  { bang: 'imdb', name: 'IMDb', url: 'https://www.imdb.com/find/?q=%s', home: 'https://www.imdb.com' },
];
/** Custom bangs from config.bangs (valid entries only: bang /^[a-z0-9]{1,15}$/i, name 1-40 chars,
 *  url https?:// containing %s), then built-ins not overridden. home = origin of url. */
export function allBangs(config: Config): Bang[];
/** "!gh react hooks" or "react hooks !gh" → { bang, terms: 'react hooks' }; "!gh" → terms ''.
 *  Not a bang query (no leading/trailing !token) → null. Unknown bang → null. */
export function parseBang(query: string, bangs: Bang[]): { bang: Bang; terms: string } | null;
/** terms ? url with %s → encodeURIComponent(terms) : home */
export function bangUrl(b: Bang, terms: string): string;
```
`SearchBar.resolveEnter(matches, highlight, query, bangs)`:
1. A highlighted match wins.
2. Else, if `parseBang` succeeds, the result is `bangUrl`.
3. Else Google, as today.

The `bangs` param is optional (default `BUILTIN_BANGS`), so existing tests keep passing.

**Backup tab** (`src/features/settings/BackupTab.tsx`), added to Settings as the 4th tab, label "Backup". Content:
- Section "Download a backup": text "Saves your links, font and theme to a file you can import in any browser." A checkbox "Include notes" (default on). Button "Download file".
- Section "Share link": text "A link that sets up this page with your links, font and theme in another browser. Notes are not included. The settings travel in the part of the link after #, which is never sent to a server." Button "Copy share link" → `navigator.clipboard.writeText`, then toast "Share link copied". If the clipboard fails, show the link in a read-only `Input` with "Copy this link". Over 30,000 characters → toast.error "Too many links for a share link. Download a file instead."
- Section "Import": text "Replace your settings with a backup file." File input (accept `.json,application/json`) with button "Choose file…". On a file: read it as text (max 2 MB, else "That file is too big to be a Start backup."), then `parseBundle` → open `ImportDialog`.
- The draft in Settings: the export uses the **saved** config (`useConfig().config`), not unsaved draft edits. If the draft is dirty, show a `Callout` tone warn: "You have unsaved link changes. Backups use your saved settings."

**ImportDialog** (`src/features/backup/ImportDialog.tsx`): `ConfirmDialog` or `Modal` from @nish/ui.
- Title: "Import settings?"
- Body: the summary line, e.g. "4 sections, 22 links · Font: Fira Code · Theme: Dark · Notes included". Below it, a list of up to 6 sections, each "Header — N links (host1, host2, host3)", with "and N more sections" when longer. Then the callout "This replaces your current links and settings."
- Buttons: "Replace my settings" (primary) and "Cancel".
- On confirm: `applyBundle`, toast.success "Settings imported", then close. When opened from Settings, also close the Settings sheet without saving the stale draft. Simplest: `ImportDialog` takes `onDone`, and BackupTab's caller decides. In SettingsSheet, after an import, reset the draft to the new config and stay open.

**UrlImport** (`src/features/backup/UrlImport.tsx`): mounted once in `App.tsx`.
- On mount and on `hashchange`, read `settings` from the hash query (`shareParam(location.hash)`), decode it, and open ImportDialog.
- On confirm or cancel, `history.replaceState(null, '', '#/home')`.
- If decoding fails: toast.error "That share link is broken or incomplete.", then strip the param.

**Welcome card** (`src/components/Welcome.tsx`): above the LinkGrid on Home, while `firstVisit && !dismissed`. A `Card` with:
- Title "Welcome to Start".
- Text "A fast homepage for your browser. Your links, notes and settings stay in this browser, with no account."
- A tips list:
  - "Press Ctrl K or / to search your links, open apps or use bangs like !gh, !yt and !w."
  - "Set this page as your browser's homepage or new tab page to see it every time."
- Buttons: "Edit links" (primary; opens Settings on the Links tab), "Import settings" (opens Settings on the Backup tab), and "Keep these links" (ghost; dismisses).
- Every button dismisses the card. 44px targets at 360px. The buttons wrap and are full width under 640px.

**New default config** (`src/lib/default-config.json`), 4 sections:
- "Everyday": Gmail https://mail.google.com, Calendar https://calendar.google.com, Drive https://drive.google.com, YouTube https://www.youtube.com, Maps https://maps.google.com
- "News": Hacker News https://news.ycombinator.com, BBC News https://www.bbc.com/news, Reuters https://www.reuters.com, The Verge https://www.theverge.com, Wikipedia https://en.wikipedia.org
- "Build": GitHub https://github.com, Stack Overflow https://stackoverflow.com, MDN https://developer.mozilla.org, npm https://www.npmjs.com, Claude https://claude.ai
- "Tools": Translate https://translate.google.com, Weather.gov https://www.weather.gov, Speedtest https://www.speedtest.net, Excalidraw https://excalidraw.com, Photopea https://www.photopea.com

**Responsive and theming:**
- The palette is @nish/ui's: full-height sheet under 640px.
- Backup tab sections stack at 360px. File and copy buttons are full width under 640px.
- All colors use `th-*` tokens; light and dark both work.

### Security
- `/api/favicon`:
  - Host validation: lowercase, then `^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$`, which rejects IPs, `localhost` and single labels. Punycode `xn--` is fine.
  - Fixed upstream hosts only. Response body ≤ 100 KB, else no icon.
  - Only `image/*` content types (`image/x-icon`, `image/vnd.microsoft.icon`, `image/png`, `image/svg+xml` are NOT allowed, since SVG can carry script; `image/gif`, `image/jpeg`, `image/webp` are allowed).
  - Same-site check and per-IP limiter. At most 6 upstream fetches in flight; beyond that, wait in a queue of at most 50, else 429.
- Weather: the same-site check, the per-IP limiter and the daily cap, all as above. Coordinates are rounded before anything is logged or sent.
- Share-link and file imports go through `parseConfig` (validation plus URL normalization). Unsafe link schemes still render as text (`isSafeUrl`). Fonts must be in `FONTS`, and themes must pass `isThemeName` or equal `'system'`. Notes come only from files and are capped at 1 MB. Tiptap's schema drops scripts.
- The service worker never caches `/api/*` (except `/api/favicon`), and caches only same-origin GETs with `response.ok`. It never caches responses that set cookies.
- No secrets are involved. The repo is public: no passwords in code, specs or PR text.

### Performance
- Main JS should shrink: Anime (510-line link table) moves to a chunk, and Inbox once unblocked. Record the `dist/assets` sizes before and after in the PR body (`npx vite build` output).
- The palette code is small. Keep `CommandMenu` in the main chunk; the palette renders nothing until opened.
- Favicons: same-origin requests, browser-cached for 7 days, and kept by the SW in `start-favicons` (max 300 entries).
- Fonts: unicode-range subsets; latin only is precached by the SW.

### Ops
- New env vars in `server/.env.example`: `WEATHER_DAILY_CAP=900` (commented default). `STATIC_DIR` default becomes `../dist`. Update its comment.
- `deploy.ps1` now runs a root `npm ci` and `npm run build` on the PC (needs codeload.github.com for @nish/ui, as every other app's deploy does).
- GitHub Pages keeps serving `docs/` (only the redirect).

## Tasks

### T1 Server: guards, weather limits, favicon proxy, health, CORS
- Repo / checkout: nishant.github.io at `C:\Code\startpage-home-for-anyone`
- Owns:
  - `server/src/index.ts`
  - `server/src/routes/weather.ts`
  - `server/src/routes/weather.test.ts` (new)
  - `server/src/routes/favicon.ts` (new)
  - `server/src/routes/favicon.test.ts` (new)
  - `server/src/lib/guard.ts` (new)
  - `server/src/lib/guard.test.ts` (new)
  - `server/package.json`
  - `server/.env.example`
- Reads: `server/src/routes/inbox.ts`, `server/src/routes/inbox.test.ts` (test style), `server/tsconfig.json`
- Depends on: none
- Change:
  1. `server/src/lib/guard.ts`:
     - `clientIp(req: Request): string`: `cf-connecting-ip` (first value, trimmed, if non-empty), else the rightmost X-Forwarded-For entry that is not loopback (`127.*`, `::1`, `::ffff:127.*`), else `req.socket.remoteAddress ?? 'unknown'`.
     - `createLimiter({ limit, windowMs, maxKeys = 5000 })` returns `{ hit(key: string, now = Date.now()): { ok: boolean; retryAfterS: number }; size(): number }`, a fixed window per key. Map insertion order: on a new key, when `size >= maxKeys`, delete the oldest keys until under `maxKeys`.
     - `createDailyCap(cap: number)` returns `{ take(now = Date.now()): boolean; used(now?): number }`, counting per UTC date string `YYYY-MM-DD` and resetting when the date changes.
     - `sameSiteOnly(allowed: ReadonlySet<string>): RequestHandler`, as in Decisions. The self origin is `${req.protocol}://${req.get('host')}`. 403 body `{ "error": "forbidden" }`.
     - `upstreamGate(max = 6, queue = 50)` returns `{ run<T>(fn: () => Promise<T>): Promise<T> }`, which rejects with `Error('busy')` when the queue is full.
  2. `weather.ts`:
     - `round2 = (n) => Math.round(n * 100) / 100`, applied in `parseCoords`'s output, so both the cache key and the upstream use the rounded values.
     - The cache keeps expired entries: `getCached(key)` returns `{ value, fresh }`. Bounded as today (500 → drop the oldest 100).
     - Router middlewares, in order: the existing not-configured 503, then `sameSiteOnly(ALLOWED_ORIGINS)`, then the per-IP limiter (60 / 10 min, keyed by `clientIp`). On deny: 429 with the copy above and a `Retry-After` header.
     - Before each upstream call: `dailyCap.take()`. When false and a stale entry exists, `X-Cache: STALE` and respond with it. Otherwise 503 `{ error, code: 'daily_cap' }`.
     - The cap value is `Number(process.env.WEATHER_DAILY_CAP) || 900`, read once at module load.
     - Export a `createWeatherRouter(opts?: { fetchJson?: (url: string, params: Record<string, unknown>) => Promise<unknown>; dailyCap?: number; now?: () => number })` factory for tests (the default uses axios as today). `export default createWeatherRouter()`.
  3. `favicon.ts`: `createFaviconRouter(opts?: { fetchImpl?: typeof fetch; now?: () => number })`, mounted at `/api/favicon`. `GET /?host=`:
     - Validate the host, then apply `sameSiteOnly`.
     - Cache: a Map keyed by host, `{ status: 200 | 404, type, body: Buffer, expires }`. Positive TTL 7 days, negative TTL 1 day. Cap 1,000 entries and 16 MB total, evicting the oldest.
     - On a miss: the per-IP limiter (300/hour), then `upstreamGate`. Fetch DDG with `AbortSignal.timeout(5000)` and `redirect: 'manual'`.
     - On 404 or a non-image response: fetch Google with `redirect: 'follow'` and check `res.url`'s host ends with `.gstatic.com` or is `www.google.com`.
     - Accept only content types in the allowlist (Security) and bodies ≤ 100 KB.
     - Network errors and timeouts are not cached as 404 (respond 404 with `Cache-Control: no-store`).
  4. `index.ts`:
     - Allowed origins: `new Set(['https://start.nish.software'])`. Export it from guard.ts as `ALLOWED_ORIGINS` so weather and favicon share it. Keep the CORS middleware using it plus self.
     - `/health` → `{ ok: true, weatherConfigured }`.
     - Mount `/api/favicon` before the `/api` 404.
     - `STATIC_DIR` default `path.join(__dirname, '..', '..', 'dist')`; update the comments ("The Vite build (`npm run build` at the repo root writes ../dist; the deploy builds it on the PC)").
     - Leave `/api/inbox` as is.
  5. `package.json` test script: `tsc -p tsconfig.json && node --test dist/routes/inbox.test.js dist/routes/weather.test.js dist/routes/favicon.test.js dist/lib/guard.test.js`. Update the description to say `../dist`.
  6. `.env.example`: add `# Upstream OpenWeatherMap calls allowed per UTC day (One Call 3.0 gives 1,000 free).` and `# WEATHER_DAILY_CAP=900`. Fix the STATIC_DIR comment to "Defaults to ../dist (built by the deploy)".
- Edge cases:
  - XFF with spaces or an empty value;
  - `cf-connecting-ip` present;
  - limiter eviction at maxKeys;
  - cap rollover at UTC midnight;
  - a stale entry served under the cap;
  - a host of `127.0.0.1`, `localhost`, `a.b` (TLD too short), an uppercase host;
  - an SVG upstream type → treated as no icon;
  - a body over 100 KB → no icon;
  - a DDG timeout → Google tried; a Google timeout → 404 `no-store`.
- Acceptance: `cd server && npm run typecheck && npm test && npm run build` pass. The tests use node:test + `node:http` (start the app on port 0 via `express()` + the router, with a fake `fetchImpl` / `fetchJson`), and cover each edge case above, plus `/health` having no `staticDir` (test via a small exported `createApp()`, or assert in the index-free router tests and grep). If testing `index.ts` needs a `createApp()` export, add it and keep `app.listen` behind `require.main === module`.

### T2 Build output, offline shell, Pages redirect, deploy, manifest
- Owns:
  - `vite.config.ts`
  - `public/sw.js` (append-only section, see below)
  - `public/manifest.webmanifest`
  - `scripts/make-icons.mjs`
  - `scripts/deploy.ps1`
  - `.gitignore`
  - `.prettierignore`
  - the deletion of everything under `docs/` except `docs/specs/`
  - `docs/index.html` (new redirect)
  - `docs/.nojekyll` (new, empty)
  - `CLAUDE.md`
- Reads: `src/main.tsx`, `src/lib/storage.ts`, `node_modules/@nish/ui/dist/theme-init.js`
- Depends on: none
- Change:
  1. `vite.config.ts`:
     - `build: { outDir: 'dist', emptyOutDir: true }`; delete `cleanDocsKeepSpecs`. Update the top comment ("The build goes to dist/, which the deploy builds on the PC and the server serves.").
     - `nishThemeInit()` becomes `transformIndexHtml: { order: 'post', handler: (html) => html.replace(/(<meta charset="utf-8"\s*\/?>)/i, (m) => `${m}\n    <script>${code}</script>`) }`. Throw at build time if the charset meta is not found.
     - Add `swStamp()` (apply: 'build'). In `writeBundle(options, bundle)`:
       - Compute `files`: every bundle key ending in `.js` or `.css`, plus `.woff2` whose name contains `latin` (any `-latin-` or `latin-ext`), plus `'./'`, `'index.html'`, `'manifest.webmanifest'`, `'favicon.svg'`, `'icon-192.png'`. Exclude `.map`.
       - `version` = first 12 hex chars of the sha256 of the sorted file list joined by `\n`.
       - Read `<outDir>/sw.js` and replace exactly `const SW_VERSION = '__SW_VERSION__';` with `const SW_VERSION = '<version>';` and `const SW_PRECACHE = [];` with `const SW_PRECACHE = <JSON.stringify(files)>;`. Throw if either placeholder is missing.
     - Leave the rest (dev proxy, test config) unchanged. The check job's `npx vite build --outDir /tmp/start-check` must keep working: use the resolved `outDir` from `configResolved`.
  2. `public/sw.js`:
     - Keep everything already there, untouched.
     - Append a section headed by the comment `/* ---- Offline shell (start-home). Keep separate from the push code above. ---- */` containing:
       - `const SW_VERSION = '__SW_VERSION__';`
       - `const SW_PRECACHE = [];`
       - `const SHELL = 'start-shell-' + SW_VERSION; const ASSETS = 'start-assets'; const ICONS = 'start-favicons';`
       - `const ENABLED = !SW_VERSION.startsWith('__');`
     - `install`: if ENABLED, `event.waitUntil(precache().then(() => self.skipWaiting()))`. `precache` caches `'./'` and `'index.html'` into SHELL (fetch with `{ cache: 'reload' }`), and the rest of SW_PRECACHE into ASSETS. Failures of single files are ignored (`Promise.allSettled`); a failure of `'./'` rejects.
     - `activate`: `event.waitUntil(cleanup().then(() => self.clients.claim()))`, where cleanup deletes caches starting with `start-shell-` other than SHELL, then prunes ASSETS to 150 and ICONS to 300 entries (delete the oldest keys first).
     - `fetch`: return early (no respondWith) unless ENABLED, `request.method === 'GET'`, and the URL is same-origin. Then:
       - (a) `request.mode === 'navigate'` → network-first. Fetch; on `ok`, put a clone into SHELL under `'./'` and return it. On failure, return `caches.match('./', { cacheName: SHELL })`, else `Response.error()`.
       - (b) path under `/assets/` (relative to the SW scope) → cache-first in ASSETS. On a miss, fetch and put if ok (after the put, prune with the same helper, at most once per 20 puts).
       - (c) path starting `<scope>api/favicon` → stale-while-revalidate in ICONS (serve the cache if present, fetch in the background and update when ok; if not cached, fetch and put when ok).
       - (d) any other `/api/` → return early.
       - (e) other same-origin files (manifest, icons, sw-adjacent) → network-first falling back to `caches.match(request)`.
     - Never cache a response with a `Set-Cookie` header, or with `response.type !== 'basic'`.
     - Compute paths relative to `self.registration.scope`, because Pages and local previews may serve the app under a sub-path.
  3. `docs/`:
     - `git rm -r` every tracked file under `docs/` except `docs/specs/**`.
     - Add `docs/.nojekyll` (empty).
     - Add `docs/index.html`, a self-contained page (inline CSS and JS, no external requests) titled "Start has moved", with dark and light colors via `prefers-color-scheme` and a viewport meta. Behavior:
       1. Read localStorage `nishant.github.io-config`, `nishant.github.io-font`, `nish-theme` and `nishant.github.io-notes` in try/catch.
       2. If the config is missing or is not JSON with a `sections` array, call `location.replace('https://start.nish.software/' + (location.hash || '#/home'))` at once.
       3. Otherwise build `{ app: 'start', v: 1, exportedAt, config, font, theme }` (no notes) and encode it exactly like `encodeShare` (see T5: `1.` + base64url(deflate-raw) via `CompressionStream('deflate-raw')`, else `0.` + base64url(UTF-8)). Target `https://start.nish.software/#/home?settings=<code>`, or plain `#/home` when the code is over 30,000 chars.
       4. If there are no notes (empty or missing), `location.replace(target)`.
       5. If there are notes, show the copy "Start has moved to start.nish.software. Your links will come with you. Your notes don't fit in a link, so download them first." with buttons "Download backup" and "Continue to start.nish.software". Download saves the full bundle with notes as `start-settings-YYYY-MM-DD.json` via a Blob URL. Continue goes to the target.
       6. `<noscript>`: a plain link to https://start.nish.software.
  4. `.gitignore`: keep `/dist` (already there). `.prettierignore`: add `dist`, and keep `docs` if present.
  5. `public/manifest.webmanifest`: the icons become
     - `favicon.svg` any,
     - `icon-192.png` 192 `"purpose": "any"`,
     - `icon-512.png` 512 any,
     - `icon-maskable-192.png` 192 `"purpose": "maskable"`,
     - `icon-maskable-512.png` 512 maskable.

     The shortcut keeps `icon-192.png`.
  6. `scripts/make-icons.mjs`: also render the maskable variants: a full-bleed `#6366f1` background square with the white "S" at 60% of the size (glyph centered, inside the 80% safe zone), no rounded corners, written to `public/icon-maskable-{192,512}.png`. Do NOT run it (Playwright is not installed here). The session generates the PNGs.
  7. `scripts/deploy.ps1`, minimal and isolated:
     - Change the synopsis text "The Angular bundle is the committed docs/ folder, so no frontend build happens here…" to "Builds the frontend (root `npm ci` + `npm run build` → dist/) and server/."
     - After the server build block (still inside the stopped window), add:
       ```powershell
       Run 'npm ci (frontend)' { npm ci --no-audit --no-fund }
       Run 'build frontend' { npm run build }
       ```
     - Replace the `docs\index.html` check with `if (-not (Test-Path 'dist\index.html')) { throw 'dist\index.html is missing - the frontend build did not produce it' }`.
     - Touch nothing else.
  8. `CLAUDE.md`:
     - Replace "A push to `master` deploys; `npm run build` rebuilds `docs/`; commit it." with "A push to `master` deploys; the deploy builds the frontend on the PC into `dist/` (never committed)."
     - Replace the `npm run build` empties `docs/` bullet with one saying `docs/` holds only the GitHub Pages redirect (`docs/index.html`) and specs.
     - In Autonomy, replace "(and `npm run build` rebuilt `docs/` for frontend changes)" with nothing.
- Edge cases:
  - The SW in dev does nothing.
  - A stamped SW offline on a navigation to `#/jp` serves the shell.
  - An API request offline fails as before.
  - An old tab's lazy chunk after a deploy is still in ASSETS.
  - The Pages redirect with no storage access → plain redirect.
- Acceptance:
  - `npm run build` writes `dist/` with a stamped `dist/sw.js` (grep shows no `__SW_VERSION__`), and `dist/index.html` has the theme-init script right after the charset meta.
  - `git status` shows docs deletions.
  - `npx vite build --outDir /tmp/start-check-sw` also stamps.
  - `node -e "new Function(require('fs').readFileSync('docs/index.html','utf8').match(/<script>([\\s\\S]*)<\\/script>/)[1])"` parses.
  - Report the main JS size.

### T3 Privacy: self-hosted fonts and same-origin favicons
- Owns:
  - `package.json`
  - `package-lock.json`
  - `index.html`
  - `src/lib/font.ts`
  - `src/index.css`
  - `src/features/settings/AppearanceTab.tsx`
  - `src/components/SiteIcon.tsx` (new)
  - `src/components/SiteIcon.test.tsx` (new)
  - `src/components/LinkGrid.tsx`
  - `src/pages/Anime.tsx`
- Reads: `node_modules/@nish/ui/dist/index.d.ts`
- Depends on: none
- Change:
  1. `npm install @fontsource-variable/fira-code @fontsource-variable/roboto` with npm 11 (CLAUDE.md), then confirm that `npx npm@10 ci` works.
  2. `src/index.css`: `@import '@fontsource-variable/fira-code';` (the default font is in the main CSS).
  3. `font.ts`:
     - `FONTS` source `'google'` becomes `'bundled'` for Fira Code and Roboto.
     - Remove `GOOGLE_CSS` / `loadGoogleFont`.
     - Add `loadBundledFont(family)`: for Roboto, `void import('@fontsource-variable/roboto')` once; Fira Code is already loaded.
     - `fallbackFor` is unchanged. The family stack: `'Fira Code Variable', 'Fira Code', ui-monospace, monospace` for Fira Code, and `'Roboto Variable', 'Roboto', system-ui, sans-serif` for Roboto. Export a `fontStack(family)` and use it in `applyFont`.
  4. `index.html`:
     - The inline script keeps setting `--app-font`, with the same stacks as `fontStack` (keep it in step with font.ts, and add a comment).
     - Remove all `fonts.googleapis.com` code.
     - Leave the `<meta charset>` as the first element of `<head>`. T2 injects theme-init after it at build.
  5. `AppearanceTab.tsx`: the `source === 'system'` check stays; `'bundled'` fonts are never "missing". Change any copy that mentions Google Fonts to "Included".
  6. `SiteIcon.tsx`: `export function SiteIcon({ url, label, size = 20, className })`.
     - It derives the host the same way `hostOf` does (import `hostOf` from `LinkGrid`). If there is no host, it returns `<Favicon url="" label={label ?? url} size={size} className={className} />` (the letter avatar).
     - Otherwise it renders `<img src={`${import.meta.env.BASE_URL}api/favicon?host=${encodeURIComponent(host)}`} width height alt="" aria-hidden loading="lazy" decoding="async" />`. `BASE_URL` is `./`, which resolves against the page. Fade in on load like Favicon (`opacity-0` → `opacity-100`, `motion-reduce:transition-none`, `rounded-sm`). On error, switch to the letter avatar.
     - Reset its state when the host changes.
     - Use `hostOf(url)`, which strips `www.`. The server receives the hostname as given, minus `www.`.
  7. `LinkGrid.tsx` and `Anime.tsx`: replace `Favicon` with `SiteIcon` (same props). No other change.
  8. `SiteIcon.test.tsx` (vitest + testing-library):
     - the src for `https://github.com/x` is `./api/favicon?host=github.com`;
     - a no-host URL renders no img;
     - an error event shows the letter avatar.
- Edge cases: `mailto:` links have no host → letter avatar. The Roboto import fails offline → stays on the fallback.
- Acceptance:
  - `npm run typecheck && npm test` pass.
  - `grep -r "fonts.googleapis\|s2/favicons" src index.html` finds nothing (node_modules excluded).
  - `npx vite build --outDir /tmp/t3` succeeds and emits fira-code woff2 files.

### T4 Command palette, bangs, lazy routes
- Owns:
  - `src/App.tsx`
  - `src/components/SearchBar.tsx`
  - `src/components/home.test.tsx`
  - `src/features/palette/bangs.ts` (new)
  - `src/features/palette/bangs.test.ts` (new)
  - `src/features/palette/CommandMenu.tsx` (new)
  - `src/features/palette/CommandMenu.test.tsx` (new)
- Reads: `src/lib/backup.ts` (T5), `src/lib/settings-tab.ts` (T5), `src/components/SiteIcon.tsx` (T3), `src/components/AppDock.tsx`, `src/lib/route.ts`
- Depends on: T3, T5
- Change:
  1. `bangs.ts` as in Design. `parseBang`:
     - trim, then match `/^!(\S+)(?:\s+(.*))?$/` or `/^(.*\S)\s+!(\S+)$/`;
     - look up the lowercased bang in `bangs`;
     - terms are trimmed;
     - if the bang is unknown, return null.
  2. `CommandMenu.tsx`: `export function CommandMenu({ onOpenSheet }: { onOpenSheet: (id: AppId) => void })`.
     - Owns its `open` state and renders `<CommandPalette hotkey ... />` with the items from Design. Uses `useConfig()` for links and `config.bangs`.
     - "Import settings" calls `requestSettingsTab('backup')` (T5), then `onOpenSheet('settings')`.
     - "Export settings" calls `downloadBundle(buildBundle({ config, includeNotes: true }))`.
     - "Copy share link" calls `copyShareLink(config)` (T5 helper that does the clipboard and the toasts).
     - Theme: `cycleTheme()` and the toast.
  3. `SearchBar.tsx`:
     - Remove the `/` keydown effect (lines 81-91).
     - Change the `<Kbd>` hint from `/` to `Ctrl K` (hide it on touch as today).
     - `resolveEnter` gains the optional `bangs` param; pass `allBangs(config)`.
     - Placeholder `Search Google or type !gh …`.
     - Use `SiteIcon` instead of `Favicon`.
  4. `App.tsx`:
     - `const Anime = lazy(() => import('./pages/Anime').then((m) => ({ default: m.Anime })))`, rendered inside `<Suspense fallback={<div className="flex min-h-60 items-center justify-center"><Spinner /></div>}>`.
     - Inbox: if `src/features/inbox/counts.ts` exists in the checkout and exports `useInboxCounts`, import the hook from there and lazy-load `InboxPage` the same way. Otherwise keep the current static import and note it.
     - Mount `<CommandMenu onOpenSheet={setSheet} />` and `<UrlImport />` (T5) next to `<Toaster />`.
  5. Tests:
     - `bangs.test.ts`:
       - `!gh react` → GitHub url with `react`;
       - `react hooks !YT` → YouTube with `react%20hooks`;
       - `!gh` → home;
       - `!nope x` → null;
       - `a!b` → null;
       - custom bang override;
       - an invalid custom bang is ignored;
       - `&` and `#` are encoded.
     - `home.test.tsx`: add `resolveEnter` with a bang. Existing tests stay green.
     - `CommandMenu.test.tsx`:
       - Ctrl+K opens it;
       - typing a link name shows it;
       - typing `!w cats` shows "Search Wikipedia for “cats”";
       - a plain query shows "Search Google for “…”".
- Edge cases:
  - The palette opened while a sheet is open: the hotkey still works, since @nish/ui handles layering.
  - `/` typed inside an input does not open it.
  - Links with unsafe schemes are excluded.
  - Empty config → only Apps and Actions.
- Acceptance: `npm run typecheck && npm test` pass; `npx vite build --outDir /tmp/t4` shows a separate Anime chunk.

### T5 Backup: export, import, share links
- Owns:
  - `src/lib/backup.ts` (new)
  - `src/lib/backup.test.ts` (new)
  - `src/lib/settings-tab.ts` (new)
  - `src/features/settings/BackupTab.tsx` (new)
  - `src/features/settings/SettingsSheet.tsx`
  - `src/features/backup/ImportDialog.tsx` (new)
  - `src/features/backup/UrlImport.tsx` (new)
  - `src/features/backup/UrlImport.test.tsx` (new)
- Reads: `src/lib/storage.ts`, `src/lib/font.ts`, `src/lib/config-context.tsx`, `src/features/settings/settings-state.ts`, `src/features/settings/JsonTab.tsx`
- Depends on: none
- Change:
  1. `backup.ts` exports:
     - `buildBundle({ config, includeNotes }): SettingsBundle`: font from `loadFont()`, theme from `getThemeChoice()`, notes from `loadNotes()` when `includeNotes` and non-empty.
     - `parseBundle(text: string, opts?: { allowNotes?: boolean }): { ok: true; bundle: SettingsBundle } | { ok: false; error: string }`:
       - Invalid JSON → "That file isn't a Start backup (it isn't valid JSON)."
       - An object with `sections` and no `app` → a config-only bundle.
       - `app !== 'start'` or `v !== 1` → "That file isn't a Start backup."
       - The config goes through `parseConfig(JSON.stringify(obj.config))`, and its error is passed through.
       - Font kept only if in `FONTS`; theme only if `'system'` or `isThemeName`; notes only if `allowNotes` (default true) and a string ≤ 1,000,000 chars.
     - `summarize(b): string`, e.g. `"4 sections, 22 links · Font: Fira Code · Theme: Dark · Notes included"`, with parts omitted when absent and singular forms for 1.
     - `applyBundle(b, setConfig: (c: Config) => void): void`: `setConfig(b.config)`; font → `saveFont` + `applyFont`; theme → `setThemeChoice`; notes → `saveNotes`. Storage errors bubble.
     - `downloadBundle(b)`: a Blob `application/json`, `JSON.stringify(b, null, 2)`, file name `start-settings-YYYY-MM-DD.json` (local date), via a temporary anchor; revoke the URL after a tick.
     - `encodeShare(b): Promise<string>`: always drops notes, then compresses.
     - `decodeShare(code): Promise<ParseResult-like>`, which uses `parseBundle(json, { allowNotes: false })`.
     - `shareUrl(code): string` = `${location.origin}${location.pathname}#/home?settings=${code}`.
     - `shareParam(hash): string | null`: the `settings` value from the hash query, only if it matches `/^[01]\.[A-Za-z0-9_-]+$/`.
     - `SHARE_MAX = 30000`.
     - `copyShareLink(config): Promise<void>`, which shows the toasts described in UI. Returns the link, or throws on oversize, so BackupTab can show the fallback input.

     Base64url helpers: no padding, `+/` → `-_`. Compression:
     ```ts
     new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()
     ```
     and the matching `DecompressionStream` for decoding.
  2. `settings-tab.ts`: `let pending: string | null = null; export function requestSettingsTab(tab: 'links' | 'appearance' | 'json' | 'backup'): void; export function takeSettingsTab(): string | null` (returns it and clears it).
  3. `SettingsSheet.tsx`:
     - Add the `'backup'` TabId and the tab `{ value: 'backup', label: 'Backup' }` (4 tabs; check they fit at 360px with `block`, else let Tabs scroll as @nish/ui does).
     - Initial tab: `takeSettingsTab() ?? (rawInvalid !== undefined ? 'json' : 'links')`.
     - Render `<BackupTab dirty={isDirty(draft, config)} onImported={(c) => { setDraft(c); setRaw(null); }} />`. Use whatever the sheet's existing names for draft and raw state are.
  4. `BackupTab.tsx` and `ImportDialog.tsx` as in Design (UI). `ImportDialog({ bundle, onCancel, onDone })` calls `applyBundle` with `useConfig().setConfig`.
  5. `UrlImport.tsx` as in Design. It is self-contained: reads the hash, decodes, shows ImportDialog, strips the param.
  6. Tests:
     - `backup.test.ts`:
       - encode then decode round-trips, using Node's global CompressionStream (Node ≥ 18 has it; jsdom may not expose it, so fall back to the `0.` path in that case and test both by stubbing);
       - notes are dropped from share codes;
       - a config-only file is accepted;
       - a bad font or theme is dropped;
       - invalid JSON copy;
       - `shareParam` rejects junk;
       - `summarize` singular and plural.
     - `UrlImport.test.tsx`:
       - a hash with a valid code shows "Import settings?";
       - Cancel strips the hash;
       - confirm saves to localStorage.
- Edge cases:
  - The clipboard is denied.
  - Import of a file over 2 MB.
  - A share link opened twice: the second time, there is no param.
  - Import while Settings has unsaved edits: the draft is replaced by the imported config.
- Acceptance: `npm run typecheck && npm test` pass.

### T6 First visit, starter links, URL normalization, weather cache
- Owns:
  - `src/lib/default-config.json`
  - `src/lib/storage.ts`
  - `src/lib/storage.test.ts`
  - `src/lib/config-context.tsx`
  - `src/features/settings/settings-state.ts`
  - `src/features/settings/settings-state.test.ts`
  - `src/components/Welcome.tsx` (new)
  - `src/components/Welcome.test.tsx` (new)
  - `src/pages/Home.tsx`
  - `src/features/weather/weather.ts`
  - `src/features/weather/weather.test.ts`
  - `src/features/weather/WeatherChip.tsx`
- Reads: `src/lib/settings-tab.ts` (T5), `src/features/settings/JsonTab.tsx`
- Depends on: T5
- Change:
  1. `default-config.json`: the starter set from Design (tab-indented like `serializeConfig`).
  2. `storage.ts`:
     - Move `normalizeUrl` here and fix it:
       ```ts
       export function normalizeUrl(url: string): string {
         const t = url.trim();
         if (!t) return '';
         // host:port (localhost:3000, example.com:8080/x) is not a scheme.
         if (/^[a-z0-9.-]+:\d+(?:[/?#]|$)/i.test(t)) return `https://${t}`;
         if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t;
         return `https://${t.replace(/^\/\//, '')}`;
       }
       ```
     - `parseConfig` stores `url: normalizeUrl(l['url'])`, so links whose url is empty stay empty.
     - Add `KEYS.welcome = 'nishant.github.io-welcome-dismissed'`.
     - `loadConfig()` returns `{ config, warning?, rawInvalid?, firstVisit: boolean }`. `firstVisit` is true when the key was absent, or when the saved config is the legacy placeholder: export `isLegacyPlaceholder(c)`, true when there are exactly 6 sections with headers `header 1`…`header 6`, each with exactly 5 links `link 1`…`link 5` → `https://google.com`. In the legacy case, save the new default.
     - Add `loadWelcomeDismissed()` / `saveWelcomeDismissed()`.
  3. `settings-state.ts`: `export { normalizeUrl } from '../../lib/storage';` and remove the local copy. Existing tests keep passing; add tests for `localhost:3000` → `https://localhost:3000` and `example.com:8080/x`.
  4. `config-context.tsx`: expose `firstVisit` from the initial load in the context value.
  5. `Welcome.tsx`: `export function Welcome({ onEditLinks, onImport })`. Uses `useConfig().firstVisit` and the dismissed flag in state. The copy and layout are in Design; @nish/ui `Card`, `Button`, `Kbd`. Hidden once dismissed.
  6. `Home.tsx`: render `<Welcome onEditLinks={() => { requestSettingsTab('links'); onOpen('settings'); }} onImport={() => { requestSettingsTab('backup'); onOpen('settings'); }} />` between `AppDock` and `LinkGrid`.
  7. `weather.ts`:
     - Use `localStorage` instead of `sessionStorage` (same key and TTL logic). Update the doc comment.
     - In `getJson`, a 503 with body `code === 'daily_cap'`, or a 429, maps to `'server'`. A 503 without that code stays `'not-configured'`. The body read is guarded.
     - Round lat/lon to 2 decimals before building the query (privacy; matches the server).
  8. `WeatherChip.tsx`: also listen to `window` `storage` events whose `key === CACHE_KEY`, and run the same update, so other tabs refresh the chip.
  9. Tests:
     - `storage.test.ts`: legacy placeholder detection; firstVisit when the key is absent; normalization in `parseConfig`.
     - `weather.test.ts`: the cache in localStorage; `storage` event handling if testable.
     - `Welcome.test.tsx`: renders on first visit; "Keep these links" hides it and persists the flag.
- Edge cases: storage blocked (firstVisit true, card dismissible for the session); an existing user with custom links never sees the card.
- Acceptance: `npm run typecheck && npm test` pass.

## Waves
W1: T1, T2, T3, T5 · W2: T4 (needs T3, T5), T6 (needs T5)

## Review focus
- The service worker: it must never serve a stale index.html when online, never cache `/api/*` other than favicons, and do nothing in dev. Check the stamp and precache list and the pruning.
- Favicon proxy SSRF and abuse: fixed upstreams, host regex, size and type limits, no SVG.
- The weather same-site check against real browser behavior: same-origin `fetch()` GETs send `Sec-Fetch-Site: same-origin` and no Origin. Check the per-IP key under Caddy and cloudflared.
- Imports: a share link can't change anything without a click, and notes never come from a URL.
- 360px: the palette, the Backup tab with 4 tabs, and the welcome card buttons.

## Release
Single repo. Merge after the PR checks. The deploy builds the frontend on the PC.
- Verify:
  - https://start.nish.software and `/health` (no `staticDir`);
  - `/api/favicon?host=github.com` with `Sec-Fetch-Site: same-origin` → 200 image; without it → 403;
  - weather without headers → 403;
  - `https://nishant.github.io/` redirects to start.nish.software (after the Pages build);
  - screenshots at 360x780, 840x900 and 1440x900, light and dark, with the palette open.
- Then the hosting Caddyfile comment fix as its own small PR.
- Then, after workflows-inbox merges `counts.ts`, the lazy Inbox follow-up.

## Open questions for the research phase
None.
