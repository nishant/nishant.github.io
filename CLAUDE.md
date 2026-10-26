# CLAUDE.md

Read `README.md` first ("Hosting on nish.software" covers the server and deploy). Hosting
conventions live in `nishant/hosting` (`CLAUDE.md`, `docs/OPERATIONS.md`); they win if this file
disagrees. A push to `master` deploys; frontend changes need `npm run deploy` to rebuild `docs/`.

- Target device: Samsung Galaxy Z Fold 7 (cover screen ~360-390 CSS px, unfolded a near-square
  ~840px). Every page must look right, with no horizontal page scroll, at 360px (not just
  375/390), ~840px and desktop, in light and dark, with 44px touch targets. Check in a browser
  at those widths before calling UI work done.

## Autonomy

Nish (2026-10-26): "you have full autonomy to merge and deploy. Just make sure everything is always
live when you're done… Do not hold up development waiting for an answer from me unless absolutely
100% critically necessary."

- Claude sessions build, commit, push, open and merge PRs, release and deploy on their own judgment,
  without asking Nish. Work is done only when it is merged, the `deploy` run is green and
  https://start.nish.software serves the new build (and `npm run deploy` rebuilt `docs/` for
  frontend changes).
- Pick sensible defaults instead of asking. Stop for Nish only when critically necessary:
  credentials or account signups, or anything destructive to production data.
