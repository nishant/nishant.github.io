# Roadmap

## Ideas

- ~~**One inbox for every app** (2026-10-28): a small local service collects events from every app (trading alerts, tracker price drops and flight watches, job-apps source health and follow-ups, mc-packs releases, CI failures, site outages) into one Inbox page here, with phone push, quiet hours, a daily digest, snooze and mark handled; replaces trading's bell and trackers' ntfy; trading keeps its Discord messages. Repos: inbox (new), ui, hosting, status, trackers, job-apps, trading, skills.~~ Done 2026-10-29, nishant/nishant.github.io#23 (service: nishant/inbox#1; spec: `git show 9f6783c:docs/specs/inbox.md` in nishant/inbox).

- ~~**Start page rebuild** (2026-10-28): rebuild start.nish.software in React + @nish/ui with the same links, notes, settings and data; phone dock, structured settings, autosaving notes, weather states, Gmail in the browser, and the trading watchlist with charts in a sheet.~~ Done 2026-10-28 (spec: `git show e46e751:docs/specs/ux-overhaul.md`).

- ~~**Inbox: live, actionable, per-source rules** (2026-10-31): the Inbox page updates live over SSE; phone notifications carry the item's own action buttons; per-source rules (severity, mute, auto-handle after N hours, don't reopen for N hours); a device list with remove and a warning when a device stops getting pushes; urgent items skip the hourly cap; "Mark all handled" only handles what you have seen; a Log out button. Repos: inbox, nishant.github.io.~~ Done 2026-10-31, nishant/nishant.github.io#38 (service: nishant/inbox#6).
