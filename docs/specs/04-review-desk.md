# WP4 — Review desk: abstracts list, review workflow, decisions + accept side-effects

Read `AGENTS.md` first. Prereqs: WP0–WP2 merged. References: `docs/PRD.md` §F4–F5, `research/image-notes-portal.md` (Abstracts list section — behavior/IA source). Seed data is the fixture: 26 abstracts across all statuses, Rey's existing reviews.

This is the heart of the admin product. swyx's minimum: **pending → approve/maybe/deny**, and accepting must auto-create speaker/session/tasks. His stated bonus (build it): email the speaker from inside the app, attaching feedback with the decision.

## A — Abstracts list (`/admin/abstracts`; `/admin/sessions` same component filtered `kind='session'`)

**TanStack Table**, seeded columns: Status (pill, `--status-*` tokens) · Code (`SESS-n`, mono tabular) · Title · Track(s) (colored chips) · Format · Speakers · Rating (avg, 1 decimal) · Reviews (n) · Source · Submitted (relative, title=absolute).

- Status tabs with live counts: All · Pending · Maybe · Accepted · Declined · Withdrawn · Drafts (URL-synced via Router search params).
- Search (title/speaker/code, client-side over loaded set — instant), sort, filter (track, format, tag), **column visibility picker** (shadcn dropdown checklist; persisted localStorage).
- **Inline status edit**: click status pill → popover with the 5 status pills → optimistic update, undo via sonner toast action ("Marked SESS-9 accepted — Undo"). Status change to accepted/declined triggers the decision flow (below) — from the table it opens the decision dialog, not silent.
- Bulk: checkbox select → bulk accept/decline (same dialog, N submissions) / export selection.
- CSV export (visible columns, current filter) — server fn streaming text/csv.
- Row click → detail.

## B — Submission detail (`/admin/abstracts/$id`)

Two-column: left = all answers (sections as submitted, custom answers included), speakers (name, email, bio-present indicator, headshot thumb); right = status + decision panel, reviews (each reviewer: decision badge, score, comment), activity (created/submitted/status changes/notified), email history (from email_log, with preview dialog).

## C — Reviewer queue (`/admin/evaluation`)

For reviewers (and admins): pending submissions in the viewer's tracks (`reviewer_tracks` ∩ `submission_tracks`), un-reviewed-by-me first. Card view: title, track, description, speakers → my review form: **Approve / Maybe / Deny** (segmented), score 1–5, comment. One review per (submission, reviewer) — upsert. Keyboard: 1/2/3 decision, ↑↓ navigate, Enter save+next (no animation on these actions — AGENTS.md). Progress line: "6 of 11 reviewed in your tracks". Admin sees per-plan progress summary + everyone's reviews.

## D — Decisions + accept side-effects (the contract of this WP)

Decision dialog (single or bulk): decision (accept/decline), optional personal message (prefilled from review comments if any — editable), preview of the email that will be sent (template from WP1/WP7 email templates: acceptance/decline + `{{feedback}}` slot), confirm.

On **accept** — one Effect program, transactional (pg transaction via the Db service), idempotent:
1. status → accepted;
2. speakers confirmed as contacts (already exist from submission — ensure flags/links);
3. `auto_assign_on_accept` task templates instantiated per speaker (contact-scope) and per submission (submission-scope) — no duplicates on re-run;
4. decision email recorded to email_log (with feedback text) → send via Mail service (WP7 wires real delivery; DEMO_MODE = log only);
5. `notified_at` set. Notified state visible in list/detail.

On **decline**: status, decline email w/ optional feedback, notified_at. Withdrawn/draft never get decision emails.

Typed errors throughout (`AlreadyDecided` allows re-decide with confirm, `NotFound`, `Forbidden` for reviewers hitting decision endpoints — reviewers review, only admins decide).

## Acceptance

1. `pnpm typecheck && pnpm build`; seed green.
2. Walkthrough (report exact steps): filter Pending → open a submission → as Rey review 3 via keyboard-only → as Dana accept SESS-x with feedback → verify: status pill + Notified indicator, task assignments created for its speakers (query), email_log row contains feedback, speaker's portal (WP2 role switcher) shows the accepted badge + new tasks (portal Tasks page may still be placeholder — verify via DB if so, note it) → bulk decline 2 → undo path on an inline status change → CSV downloads and opens.
3. Accept program re-run (double-click submit / retry) creates zero duplicate tasks or emails.
4. Table interactions feel instant (optimistic everywhere); no spinner on tab/filter changes.
5. Zero-debt self-review + motion checklist.

Visual/table reference: the tabbed data table in shadcn block `dashboard-01` (ui.shadcn.com/view/new-york-v4/dashboard-01) is the user-approved look for our tables — badge cells, tab row, density. Compose TanStack Table logic under that visual pattern.
