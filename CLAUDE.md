# CLAUDE.md

Read `README.md` first ("Hosting on nish.software" covers the server and deploy). Hosting
conventions live in `nishant/hosting` (`CLAUDE.md`, `docs/OPERATIONS.md`); they win if this file
disagrees. A push to `master` deploys; frontend changes need `npm run deploy` to rebuild `docs/`.

- Target device: Samsung Galaxy Z Fold 7 (cover screen ~360-390 CSS px, unfolded a near-square
  ~840px). Every page must look right, with no horizontal page scroll, at 360px (not just
  375/390), ~840px and desktop, in light and dark, with 44px touch targets. Check in a browser
  at those widths before calling UI work done.
