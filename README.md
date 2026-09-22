# github.io
My github.io site hosted @ https://nishant.github.io

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 16.2.1.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

## Hosting on nish.software

The same bundle GitHub Pages serves from `docs/` also runs as **https://start.nish.software**,
served by the small Express server in [`server/`](./server) together with the weather API it used
to get from Render. One Node process, port 8800, fronted by Caddy and the Cloudflare tunnel from
[nishant/hosting](https://github.com/nishant/hosting).

| Path | What |
|---|---|
| `server/src/index.ts` | Express: serves `docs/` and mounts `/api/weather`; `/health` for the deploy |
| `server/src/routes/weather.ts` | OpenWeatherMap One Call 3.0 + reverse geocode, cached, key from `server/.env` |
| `proxy.conf.json` | `ng serve` forwards `/api` to `localhost:8800` so dev works against the local server |
| `scripts/deploy.ps1` | Run by the self-hosted runner on push to `master`: pull into `C:\Apps\startpage`, build `server/`, restart the task |
| `scripts/tasks.ps1`, `scripts/Startpage.task.xml`, `scripts/supervise.mjs` | The `Startpage` scheduled task (SYSTEM, at boot) and its log-teeing supervisor (`logs\app.log`) |

### Run it locally

```bash
cd server
cp .env.example .env        # then paste your OPENWEATHERMAP_API_KEY
npm ci && npm run build && npm start
# http://localhost:8800/#/home  (serves ../docs)  -  http://localhost:8800/health
```

For frontend work keep that server running and use `npm start` (ng serve) at the repo root; the
proxy sends `/api` to it.

### Deploying

1. Frontend changes: `npm run deploy` (writes `docs/`), commit the result. GitHub Pages and the
   server both serve that committed folder; the deploy never rebuilds Angular on the PC.
2. Push to `master`. The `deploy` workflow checks the build on GitHub, then the runner on the
   hosting PC (`C:\actions-runner-startpage`, labels `self-hosted, windows, startpage`) runs
   `scripts\deploy.ps1`.
3. First time only, on the PC (elevated): register the runner, create `C:\Apps\startpage\server\.env`
   from `.env.example`, and register the task:
   `Register-ScheduledTask -Xml (Get-Content C:\Apps\startpage\scripts\Startpage.task.xml -Raw) -TaskName Startpage -Force`
   (`tasks.ps1 start` also registers it if missing).
4. Google sign-in only works on origins listed in the OAuth client (Google Cloud Console →
   Credentials → the web client → Authorized JavaScript origins): add `https://start.nish.software`.
