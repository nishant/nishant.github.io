# CLAUDE.md

Read `README.md` first ("Hosting on nish.software" covers the server and deploy). Hosting
conventions live in `nishant/hosting` (`CLAUDE.md`, `docs/OPERATIONS.md`); they win if this file
disagrees. A push to `master` deploys; the deploy builds the frontend on the PC into `dist/` (never committed).

- UI follows "Phones and layout" in [`global/CLAUDE.md`](https://github.com/nishant/skills/blob/master/global/CLAUDE.md) in `nishant/skills`: 360px, ~840px and desktop, light and dark, 44px targets, no horizontal page scroll, and every page reachable through visible UI.
- `docs/` holds only the GitHub Pages redirect (`docs/index.html`, `docs/.nojekyll`) and `docs/specs/`. The build goes to `dist/`.
- `public/sw.js` has two parts: push (owned with the inbox work) and an appended offline shell. Vite's `swStamp()` replaces
  `const SW_VERSION = '__SW_VERSION__';` and `const SW_PRECACHE = [];` at build time (the build fails if they are missing);
  unstamped (dev) the shell does nothing. To test offline locally, serve `dist/` with the real server, not `npm run dev`.
- This repo is **public** (GitHub Pages). Never commit or put in a PR body an app password, the hosting password pattern, or a spec that names them; such specs go in a private repo (the inbox spec lives in nishant/inbox for that reason).
- Lockfile: `npm install` under npm 10 crashes on jsdom's optional `canvas` peer
  (`reading 'edgesOut'`). Install with npm 11, then confirm `npx npm@10 ci` (CI's npm) works.
- Cloud sessions: the proxy blocks `codeload.github.com` (403), so `npm ci` cannot fetch `@nish/ui`.
  For local checks, `git archive` the ui tag into a tarball, point package.json and the lockfile at it
  temporarily, `npx npm@10 ci`, then restore both files; never commit that change.
- The Watchlist calls trading.nish.software from the browser. It resolves to a Tailscale address,
  which Chrome's Local Network Access treats as local, so Chrome asks once to allow local network
  access for start.nish.software. Headless Playwright denies it unless the context runs
  `grantPermissions(['local-network-access'])`.

## Autonomy

Nish's standing rule: build, merge, release and deploy without asking; stop only for credentials, account signups, anything destructive to production data, and hosting's hard rules. The canonical text is "Autonomy" in [`global/CLAUDE.md`](https://github.com/nishant/skills/blob/master/global/CLAUDE.md) in `nishant/skills`. Done here means merged, the `deploy` run green and https://start.nish.software serving the new build.

