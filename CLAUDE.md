# CLAUDE.md

Read `README.md` first ("Hosting on nish.software" covers the server and deploy). Hosting
conventions live in `nishant/hosting` (`CLAUDE.md`, `docs/OPERATIONS.md`); they win if this file
disagrees. A push to `master` deploys; `npm run build` rebuilds `docs/`; commit it.

- Target device: Samsung Galaxy Z Fold 7 (cover screen ~360-390 CSS px, unfolded a near-square
  ~840px). Every page must look right, with no horizontal page scroll, at 360px (not just
  375/390), ~840px and desktop, in light and dark, with 44px touch targets. Check in a browser
  at those widths before calling UI work done.
- Every page must be reachable on the phone through a visible UI element (bottom bar, More
  sheet, menu, or a link on another page), never only by typing its URL: no desktop-only nav
  entries, and no page that tells a phone user to open it on a desktop.
- `npm run build` empties `docs/` (Vite `emptyOutDir`), so nothing else can live there: specs go
  in `docs/` only until the next build. Merging master into a branch conflicts on the hashed files
  in `docs/assets`; delete them and rebuild rather than resolving file by file.
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

Nish (2026-10-26): "you have full autonomy to merge and deploy. Just make sure everything is always
live when you're done… Do not hold up development waiting for an answer from me unless absolutely
100% critically necessary."

- Claude sessions build, commit, push, open and merge PRs, release and deploy on their own judgment,
  without asking Nish. Work is done only when it is merged, the `deploy` run is green and
  https://start.nish.software serves the new build (and `npm run build` rebuilt `docs/` for
  frontend changes).
- Pick sensible defaults instead of asking. Stop for Nish only when critically necessary:
  credentials or account signups, or anything destructive to production data.
