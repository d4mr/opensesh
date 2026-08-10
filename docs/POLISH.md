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
- [ ] Event settings — WP12 rebuilds it (grouped, dense rails, real pickers); re-check at merge
- [ ] Forms list + form builder page — check header rails, empty states
- [ ] Portal Forms admin page — "Edit portal form" sheet → dedicated page w/ preview (WP12/13 territory; sheet is banned per overlay doctrine)
- [ ] Task templates drawer — overlay doctrine review (modal vs page)
- [ ] File Requests page — header rails + WP10 will add requirements block; polish at merge
- [ ] Email delivery viewer — rails, empty states, retry affordance density
- [ ] Evaluation queue — density + keyboard hints surfacing
- [ ] Dashboard — needs-attention rows already dense; check card paddings
- [ ] Widgets builder — two-pane paddings, Get-code dialog density (WP8 self-reviewed; verify)
- [ ] Empty states sweep — every table/list: quiet one-liner + primary affordance
- [ ] Seeded storytelling — email_log legacy rows need real HTML bodies
- [ ] Full role walkthrough (Dana/Rey/Maya/Lina/Jamal) after WP10–12 merges

## Doctrine (from user, 2026-08-10)

- No side sheets for row detail → Linear spotlight (WP11)
- Attention-capturing overlay → modal; lots going on → dedicated page
- Exact back semantics everywhere: highlight + restore position
