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
- [x] Forms list + form builder page — verified dense (single form row w/ counts + Open chip, Create form in header)
- [x] Portal Forms admin page — WP13 merged: dedicated /admin/portal-forms/$formId two-pane page w/ live preview, back restores list + highlight (verified)
- [x] Task templates drawer — converted ALL remaining Sheets to centered Dialogs: task create/edit, add file request, agenda SessionPeek, AI drafts (e531e2b)
- [x] File Requests page — requirements block landed dense with WP10 (verified)
- [x] Email delivery viewer — already dense: status badges, retry w/ optimistic update, sent-at, HTML dialog (verified)
- [x] Evaluation queue — dense card, keyboard hints (1/2/3), prev/next, Save & next (verified)
- [x] Dashboard — cards + needs-attention verified dense
- [x] Widgets builder — list verified clean; toggles + Updated dates
- [x] SSR timezone sweep — sidebar/public-shell/event-switcher/public-agenda/portal-home format in event TZ (hydration errors eliminated)
- [x] Speaker spotlight depth — WP14 merged: readiness/tasks/files/emails/profile diff w/ approve-reject, ?email= deep link; fixed grid min-width blowout + demo-pill clearance (browser-verified)
- [x] Empty states sweep — verified in walkthrough: portal tasks ("No contact tasks outstanding."), speaker spotlight ("No tasks assigned."/"No files yet."/"No emails sent."), AI drafts ("No agenda drafts yet"), file requests ("No uploads yet."), evaluation ("No reviews yet.")
- [x] Seeded storytelling — email_log rows now rendered through real mail templates (2c1da9f)
- [ ] Dev-only: TanStack Router warns on nav links generated via /admin/$section that collide with static routes (nav-main, section-cards, dashboard-attention, admin-shell palette); harmless in prod, fix = link each section to its real route
- [x] Full role walkthrough (Dana/Rey/Maya/Lina/Jamal) — done post-WP14 merge:
  - Dana: dashboard/abstracts/sessions/content/speakers/forms/evaluation/agenda/widgets/tasks/emails/portal-forms/file-requests all dense + working
  - Rey: nav scoped to Dashboard + Evaluation (3ad5bc0); evaluation queue track-scoped
  - Maya: home cards, submissions spotlight w/ populated selects + Files (versions/comments/reply), tasks all-done states
  - Lina: 0/4 tasks w/ next-due whisper; per-task Fill form/Upload affordances
  - Jamal: "Add your bio" whisper, Maybe/Pending chips, 0/0 tasks
- [ ] Rey's dashboard needs-attention rows still link into admin pages a reviewer cannot open (access whisper, no crash) — consider role-aware dashboard later
- [x] WP19 public card hierarchy (user feedback): star was absolutely positioned and misaligned with SESS code; cards crowded. Redesigned both sessions-list and itinerary cards — title row with right-aligned code+star group (pixel-verified all three centers at same y), single muted time·room line, compact speaker lines with medium names, chips, description clamped to 2 lines with Show more (added expanded state to Itinerary). Removed the pre-speakers divider.
- [x] WP16 round editor route never rendered (nested under /admin/evaluation with no Outlet) — renamed to admin.evaluation_.$roundId (un-nest pattern), verified in browser
- [x] Scorecard numeric criteria now segmented 1–5 pickers (user: "have 1,2,3,4,5 number pickers not number entry") — ScorePicker radiogroup, integer ranges ≤10 wide; falls back to number input otherwise; toggle-off supported; verified 4/2 selection + submit + reopen
- [x] Demo-pill clearance: widget-builder Get-code panel (pb-14) and reviewer scorecard form (pb-14) — Copy/Submit buttons no longer covered
- [x] Seeded file downloads/ZIP: seed/… storage keys had no R2 object → downloads and exports failed; deterministic placeholder PDF served for seed keys only (63c46ed); ZIP dialog now reaches Ready · Download
- [x] Post-merge integration sweep (WP16–20 on main): nav labels §5.2 complete incl. Organization → Speaker CRM, Portals → Files/Communications; speakers spotlight union (WP17 dialogs + WP18 inline editor + attributed history verified with live bio edit); communications composer resolved preview; CRM four tabs; event switcher Create event preserved

## Doctrine (from user, 2026-08-10)

- No side sheets for row detail → Linear spotlight (WP11)
- Attention-capturing overlay → modal; lots going on → dedicated page
- Exact back semantics everywhere: highlight + restore position
