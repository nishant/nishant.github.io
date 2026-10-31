# Start page
Nish's start page at https://start.nish.software (and https://nishant.github.io): search, a grid of
link sections, a clock and weather chip, and sheets for Notes, Weather, Mail, the trading Watchlist
and Settings. `#/jp` is the Anime + Manga page.

Stack: React 19, Vite, Tailwind 4, [`@nish/ui`](https://github.com/nishant/ui), lucide-react.
Tiptap (Notes) and CodeMirror (Settings, Raw JSON) are lazy chunks, as is each sheet.

## Develop

```bash
cd server && cp .env.example .env && npm ci && npm run build && npm start   # API on :8800
npm install && npm run dev                                                    # http://localhost:4200, /api proxied
```

- `npm run check` is the gate: typecheck, vitest, then the build.
- `npm run build` writes the production bundle to `docs/` (emptying it first). Commit the result:
  GitHub Pages and the server both serve that folder.

## Saved data

Everything lives in the browser's localStorage. The formats are unchanged from the Angular version.

| Key | Holds |
|---|---|
| `nishant.github.io-config` | JSON `{ "sections": [{ "header", "links": [{ "text", "url" }] }] }`, tab-indented |
| `nishant.github.io-notes` | The Notes HTML string |
| `nishant.github.io-font` | The font family name, e.g. `Fira Code` |
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

The same bundle GitHub Pages serves from `docs/` also runs as **https://start.nish.software**,
served by the small Express server in [`server/`](./server) together with the weather API it used
to get from Render. One Node process, port 8800, fronted by Caddy and the Cloudflare tunnel from
[nishant/hosting](https://github.com/nishant/hosting).

| Path | What |
|---|---|
| `server/src/index.ts` | Express: serves `docs/`, mounts `/api/weather`, `/api/config` (Gmail client id, Trading URL); `/health` for the deploy |
| `server/src/routes/weather.ts` | OpenWeatherMap One Call 3.0 + reverse geocode, cached, key from `server/.env` |
| `vite.config.ts` | `npm run dev` proxies `/api` to `localhost:8800` so dev works against the local server |
| `scripts/deploy.ps1` | Run by the self-hosted runner on push to `master`: pull into `C:\Apps\startpage`, build `server/`, restart the task |
| `scripts/tasks.ps1`, `scripts/Startpage.task.xml`, `scripts/supervise.mjs` | The `Startpage` scheduled task (SYSTEM, at boot) and its log-teeing supervisor (`logs\app.log`) |

### Run it locally

```bash
cd server
cp .env.example .env        # then paste your OPENWEATHERMAP_API_KEY
npm ci && npm run build && npm start
# http://localhost:8800/#/home  (serves ../docs)  -  http://localhost:8800/health
```

For frontend work keep that server running and use `npm run dev` at the repo root; the proxy sends
`/api` to it.

### Deploying

1. Frontend changes: `npm run build` (writes `docs/`), commit the result. GitHub Pages and the
   server both serve that committed folder; the deploy never builds the frontend on the PC.
2. Push to `master`. The `deploy` workflow checks the build on GitHub, then the runner on the
   hosting PC (`C:\actions-runner-startpage`, labels `self-hosted, windows, startpage`) runs
   `scripts\deploy.ps1`.
3. First time only, on the PC (elevated): register the runner, create `C:\Apps\startpage\server\.env`
   from `.env.example`, and register the task:
   `Register-ScheduledTask -Xml (Get-Content C:\Apps\startpage\scripts\Startpage.task.xml -Raw) -TaskName Startpage -Force`
   (`tasks.ps1 start` also registers it if missing).
4. Gmail sign-in only works on origins listed in the OAuth client (Google Cloud Console →
   Credentials → the web client → Authorized JavaScript origins): add `https://start.nish.software`.
