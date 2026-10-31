# Roadmap

## Ideas

- **Homepage for anyone** (2026-10-31): start.nish.software as a public homepage anyone can set up: Ctrl-K / `/` command palette with bangs, settings export/import as a file or share link, offline app shell, lazy Anime and Inbox routes, a weather cache shared across tabs, self-hosted fonts, a same-origin favicon proxy (no link list sent to Google), starter links and a welcome card for first visits, a capped weather endpoint, no path in `/health`, and the frontend built on the PC instead of committed to `docs/`. Repos: nishant.github.io, hosting (comment).

- ~~**One inbox for every app** (2026-10-28): a small local service collects events from every app (trading alerts, tracker price drops and flight watches, job-apps source health and follow-ups, mc-packs releases, CI failures, site outages) into one Inbox page here, with phone push, quiet hours, a daily digest, snooze and mark handled; replaces trading's bell and trackers' ntfy; trading keeps its Discord messages. Repos: inbox (new), ui, hosting, status, trackers, job-apps, trading, skills.~~ Done 2026-10-29, nishant/nishant.github.io#23 (service: nishant/inbox#1; spec: `git show 9f6783c:docs/specs/inbox.md` in nishant/inbox).

- ~~**Start page rebuild** (2026-10-28): rebuild start.nish.software in React + @nish/ui with the same links, notes, settings and data; phone dock, structured settings, autosaving notes, weather states, Gmail in the browser, and the trading watchlist with charts in a sheet.~~ Done 2026-10-28 (spec: `git show e46e751:docs/specs/ux-overhaul.md`).
