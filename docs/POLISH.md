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
- [x] Sidebar nav scoping — Settings nav + command palette entries hidden for non-admin roles (f3b214a)
- [x] Hydration error on every page load — fixed via event-TZ formatting sweep (6e3d8e3, cfc73d1)
- [x] Event settings — WP12 merged: grouped Basics/Schedule/Branding/Submissions, dense rails, datetime+tz pickers, icon previews (verified in browser)
- [ ] Forms list + form builder page — check header rails, empty states
- [x] Portal Forms admin page — WP13 merged: dedicated /admin/portal-forms/$formId two-pane page w/ live preview, back restores list + highlight (verified)
- [ ] Task templates drawer — overlay doctrine review (modal vs page)
- [x] File Requests page — requirements block landed dense with WP10 (verified)
- [x] Email delivery viewer — already dense: status badges, retry w/ optimistic update, sent-at, HTML dialog (verified)
- [x] Evaluation queue — dense card, keyboard hints (1/2/3), prev/next, Save & next (verified)
- [x] Dashboard — cards + needs-attention verified dense
- [x] Widgets builder — list verified clean; toggles + Updated dates
- [x] SSR timezone sweep — sidebar/public-shell/event-switcher/public-agenda/portal-home format in event TZ (hydration errors eliminated)
- [x] Speaker spotlight depth — WP14 merged: readiness/tasks/files/emails/profile diff w/ approve-reject, ?email= deep link; fixed grid min-width blowout + demo-pill clearance (browser-verified)
- [ ] Empty states sweep — every table/list: quiet one-liner + primary affordance
- [x] Seeded storytelling — email_log rows now rendered through real mail templates (2c1da9f)
- [ ] Dev-only: TanStack Router warns on nav links generated via /admin/$section that collide with static routes (nav-main, section-cards, dashboard-attention, admin-shell palette); harmless in prod, fix = link each section to its real route
- [ ] Full role walkthrough (Dana/Rey/Maya/Lina/Jamal) after WP10–12 merges

## Doctrine (from user, 2026-08-10)

- No side sheets for row detail → Linear spotlight (WP11)
- Attention-capturing overlay → modal; lots going on → dedicated page
- Exact back semantics everywhere: highlight + restore position
