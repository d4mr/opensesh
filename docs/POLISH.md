# Polish ledger

Working list of surface polish. Rule of thumb per docs/DESIGN.md: dense h-9 section rails (bg-muted/30, xs font-medium title + tabular count, actions right-aligned IN the rail), 32–36px table rows, no fat CardHeaders, no orphaned Add buttons, whispers over spinners, every empty state written.

## Polished ✅

- Admin shell + sidebar (WP2c/2d) — stock sidebar block, density pass
- Review desk tables — status tabs w/ icons + colored counts
- Content page — merged "Awaiting approval" rail (Session/Profile chips, h-10 rows); speaker rows; peek sheet (spotlight conversion pending WP11)
- Speakers directory — pending-approval chip (spotlight + readiness consolidation pending WP11)
- Agenda builder — single scroll surface, no z-fights, wrapped header actions
- AI draft compare — full-width dense table, x-scroll contained
- Portal (speaker) — profile whisper, dense task/submission lists
- Public /e views + embeds (WP8 shipped conformant)
- Landing page (landing agent's)

## To polish 🔧

- [x] Program library page — fat section headers → dense rails, Add in rail (done, this pass)
- [ ] Sidebar nav scoping — Rey (reviewer) sees Settings/Event/Library nav but gets "You do not have access"; hide unauthorized nav items instead
- [ ] Hydration error on every page load — server/client text mismatch ending "…2026" (likely a date formatted in server TZ vs browser TZ); forces full client re-render. Find with React hydration diff in dev console.
- [x] Event settings — WP12 merged: grouped Basics/Schedule/Branding/Submissions, dense rails, datetime+tz pickers, icon previews (verified in browser)
- [ ] Forms list + form builder page — check header rails, empty states
- [ ] Portal Forms admin page — "Edit portal form" sheet → dedicated page w/ preview (WP13 dispatched)
- [ ] Task templates drawer — overlay doctrine review (modal vs page)
- [x] File Requests page — requirements block landed dense with WP10 (verified)
- [x] Email delivery viewer — already dense: status badges, retry w/ optimistic update, sent-at, HTML dialog (verified)
- [x] Evaluation queue — dense card, keyboard hints (1/2/3), prev/next, Save & next (verified)
- [x] Dashboard — cards + needs-attention verified dense
- [x] Widgets builder — list verified clean; toggles + Updated dates
- [x] SSR timezone sweep — sidebar/public-shell/event-switcher/public-agenda/portal-home format in event TZ (hydration errors eliminated)
- [x] Speaker spotlight depth — WP14 dispatched (readiness/tasks/files/emails/profile changes)
- [ ] Empty states sweep — every table/list: quiet one-liner + primary affordance
- [ ] Seeded storytelling — email_log legacy rows need real HTML bodies
- [ ] Full role walkthrough (Dana/Rey/Maya/Lina/Jamal) after WP10–12 merges

## Doctrine (from user, 2026-08-10)

- No side sheets for row detail → Linear spotlight (WP11)
- Attention-capturing overlay → modal; lots going on → dedicated page
- Exact back semantics everywhere: highlight + restore position
