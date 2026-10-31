# Start page
A homepage anyone can bookmark and set up, at https://start.nish.software (https://nishant.github.io redirects there): search, a grid of
link sections, a clock and weather chip, and sheets for Notes, Weather, Mail, the trading Watchlist
and Settings. `#/jp` is the Anime + Manga page.

Stack: React 19, Vite, Tailwind 4, [`@nish/ui`](https://github.com/nishant/ui), lucide-react.
Tiptap (Notes) and CodeMirror (Settings, Raw JSON) are lazy chunks, as is each sheet.

## Develop

```bash
cd server && cp .env.example .env && npm ci && npm run build && npm start   # API on :8800
npm install && npm run dev                                                    # http://localhost:4200, /api proxied
```

- `npm run check` is the gate (typecheck, vitest, build); also run `npm run lint` (eslint src server/src).
- `npm run build` writes the production bundle to `dist/` (gitignored). The deploy builds it on the PC;
  `docs/` only holds the GitHub Pages redirect to start.nish.software (it carries a visitor's links along as a
  share link) and specs.

## Features for anyone

- **Command palette:** Ctrl/Cmd+K or `/` searches links, apps and actions. Bangs work there and in the search
  bar: `!g`, `!gh`, `!yt`, `!w`, `!a`, `!m`, `!i`, `!r`, `!so`, `!mdn`, `!npm`, `!hn`, `!ddg`, `!tr`, `!imdb`,
  as `!gh react` or `react !gh`. Custom bangs go in the config (Settings, then JSON):
  `"bangs": [{ "bang": "jira", "name": "Jira", "url": "https://x.atlassian.net/search?q=%s" }]`.
- **Backup** (Settings, then Backup): download or import a `.json` file (links, font, theme, notes), or copy
  a share link. The share link carries links, font and theme in the URL fragment, which never reaches a
  server. Opening one shows a preview and asks before replacing anything.
- **First visit:** starter links and a welcome card.
- **Offline:** `public/sw.js` caches the app shell and the hashed assets. The build stamps its version and
  precache list, and navigations stay network-first.
- **Privacy:** link icons come from the server's `/api/favicon` proxy (DuckDuckGo, then Google, cached),
  never from the browser to Google. Fira Code and Roboto are bundled.

## Saved data

Everything lives in the browser's localStorage. The formats are unchanged from the Angular version.

| Key | Holds |
|---|---|
| `nishant.github.io-config` | JSON `{ "sections": [{ "header", "links": [{ "text", "url" }] }] }`, tab-indented |
| `nishant.github.io-notes` | The Notes HTML string |
| `nishant.github.io-font` | The font family name, e.g. `Fira Code` |
| `nishant.github.io-welcome-dismissed` | `"1"` once the welcome card is dismissed |
| `start-weather` | The last forecast, `{ data, location, at }`, reused for 10 minutes across tabs |
| `nishant.github.io-google-access-token` | `{ "accessToken", "timestamp" }`, valid 55 minutes |

## Gmail

Read-only inbox via Google sign-in in the browser. One-time setup: in Google Cloud Console create an
OAuth client of type Web application, add `https://start.nish.software` as an Authorized JavaScript
origin, put the client id in `C:\Apps\startpage\server\.env` as `GOOGLE_CLIENT_ID`, and restart the
`Startpage` task. Until then the Mail sheet says it is not set up.

## Watchlist

The Watchlist sheet calls `https://trading.nish.software` (override with `TRADING_URL`) straight from
the browser with your Trading session cookie. It needs Tailscale and a Trading sign-in; otherwise the
sheet says so.

When the sheet opens it also asks Trading's `GET /api/watchlist/summary` (same cookie, in parallel
with the overview) for per-symbol badges: a star with the top pick's score from the newest finished
scan (its strategy in the tooltip and the row's label; no badge when there is no score) and an Open
marker for real-money positions. Any failure there (an older Trading without the route, 401, CORS,
network) just leaves the badges off. The page never uses Trading's API token.

## Hosting on nish.software

The app runs as **https://start.nish.software**,
served by the small Express server in [`server/`](./server) together with the weather API it used
to get from Render. One Node process, port 8800, fronted by Caddy and the Cloudflare tunnel from
[nishant/hosting](https://github.com/nishant/hosting).

| Path | What |
|---|---|
| `server/src/index.ts` | Express: serves `dist/`, mounts `/api/weather`, `/api/favicon`, `/api/config` (Gmail client id, Trading URL); `/health` for the deploy |
| `server/src/routes/weather.ts` | OpenWeatherMap One Call 3.0 + reverse geocode, cached, key from `server/.env`. Same-site only, 60 requests per 10 min per IP, `WEATHER_DAILY_CAP` (default 900) upstream calls a day, coordinates rounded to 2 decimals |
| `server/src/routes/favicon.ts` | `/api/favicon?host=`: icons from DuckDuckGo, else Google, cached in memory (7 days; 1 day for misses), no SVG, same-site only |
| `server/src/lib/guard.ts` | Client IP (cf-connecting-ip, then rightmost non-loopback XFF), capped limiter, daily cap, same-site check |
| `vite.config.ts` | `npm run dev` proxies `/api` to `localhost:8800` so dev works against the local server |
| `scripts/deploy.ps1` | Run by the self-hosted runner on push to `master`: pull into `C:\Apps\startpage`, build `server/`, restart the task |
| `scripts/tasks.ps1`, `scripts/Startpage.task.xml`, `scripts/supervise.mjs` | The `Startpage` scheduled task (SYSTEM, at boot) and its log-teeing supervisor (`logs\app.log`) |

### Run it locally

```bash
cd server
cp .env.example .env        # then paste your OPENWEATHERMAP_API_KEY
npm ci && npm run build && npm start
# http://localhost:8800/#/home  (serves ../dist; run `npm run build` at the root first)  -  http://localhost:8800/health
```

For frontend work keep that server running and use `npm run dev` at the repo root; the proxy sends
`/api` to it.

### Deploying

1. Never commit a build: `dist/` is gitignored, and the deploy runs `npm ci` and `npm run build` at the
   repo root on the PC.
2. Push to `master`. The `deploy` workflow checks the build on GitHub, then the runner on the
   hosting PC (`C:\actions-runner-startpage`, labels `self-hosted, windows, startpage`) runs
   `scripts\deploy.ps1`.
3. First time only, on the PC (elevated): register the runner, create `C:\Apps\startpage\server\.env`
   from `.env.example`, and register the task:
   `Register-ScheduledTask -Xml (Get-Content C:\Apps\startpage\scripts\Startpage.task.xml -Raw) -TaskName Startpage -Force`
   (`tasks.ps1 start` also registers it if missing).
4. Gmail sign-in only works on origins listed in the OAuth client (Google Cloud Console →
   Credentials → the web client → Authorized JavaScript origins): add `https://start.nish.software`.
