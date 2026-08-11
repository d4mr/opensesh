# WP27 — Manual "Add session" + unified portal tasks

Eval issues OS-023 (P2) and OS-024 (P2). Verified findings with file:line refs below. NO schema
changes in this WP — do not touch packages/domain/migrations or db/schema.

## Hard rules (non-negotiable)

- NO git commit, push, or deploy. Leave changes uncommitted.
- NO prod database. Your DB is `opensesh_wp27` (`apps/web/.dev.vars` points at it).
  `pnpm --filter @opensesh/domain db:reset` re-seeds it.
- Dev server port **3027** if needed.
- Read AGENTS.md (Effect v4 discipline: verify APIs against vendor/effect) and docs/DESIGN.md —
  the Linear bar: dense admin surfaces, quiet copy, no banner boxes, one primary per rail,
  sentence case. The portal surfaces were just redesigned (rich cards, strip headers, edge
  scrollbars) — match apps/web/src/components/portal/portal-tasks.tsx's existing card language
  exactly; do not reintroduce shadcn Card (its root gap-6 py-6 is banned on these surfaces).
- Finish: `pnpm check` clean, db:reset ends "Seed verification passed", write REPORT-WP27.md.

## Part A — OS-023: direct "Add session"

The model already supports manual sessions; the creation surface is missing:
- submissions.kind enum already has "session" (db/columns.ts:16); sourceFormId and
  submitterContactId are nullable (db/schema/submissions.ts:84-87).
- Sessions desk filters kind='session' (repos/review-desk.ts:286-287) and preserves kind for
  manual rows (:1001-1006, :1233-1242) — a {kind:"session", sourceFormId:null} row lands in the
  Sessions desk and stays out of the CFP abstracts desk.
- `Submissions.create` (repos/submissions.ts:59, :641-651) allocates a code and inserts — it
  currently has NO callers (dead code ready for this).
- `replaceParticipants` (repos/submissions.ts:827-848) assigns speakers.

Build:
1. Server fn `createManualSession` (apps/web/src/server-fns/review-desk.ts or admin.ts):
   requireAdminEvent → Submissions.create({eventId, kind:"session", status:"accepted",
   sourceFormId:null, submitterContactId:null, title, description, formatId, answers:{}}) →
   replaceParticipants. ENFORCE at least one speaker (mirror the "Every submission must have a
   speaker" invariant at review-desk.ts:1089). Then check taskTemplates.autoAssignOnAccept
   wiring (repos/portal.ts ~:2292): the accept-time auto-assignment hook runs in the DECISION
   transaction, so a directly-created accepted session skips it — replicate that hook here so
   auto-assign templates and requirement assignments apply to manual sessions too.
2. UI: "Add session" primary button on the Sessions desk (apps/web/src/routes/admin.sessions.tsx
   header row). Dialog (sm:max-w-lg): Title (required), Format select (event formats),
   Description (RichTextEditor, optional), Speakers via the existing SpeakerPickerDialog
   (components/admin/speaker-picker-dialog.tsx) summary-row pattern used in
   portal-admin.tsx:727-767 — reuse, don't reinvent. On success: invalidate the sessions desk
   query and spotlight the new session.
3. The new session must appear in: Sessions desk, agenda unscheduled pool, deliverables
   (requirements apply), speaker portal of its speakers ("My sessions" + submissions), and the
   public agenda once scheduled+published+content-approved. Verify each; note results in report.

## Part B — OS-024: portal tasks page shows file deliverables

Verified: portal-tasks.tsx renders data.tasks only; data.requirements is never referenced;
file requirements are only visible inside the submission spotlight (portal-submissions.tsx:312
SessionFiles). Speakers looking at "Tasks" miss their uploads.

Build (no server change needed — speakerBootstrap already returns requirements, files, versions,
comments: repos/portal.ts:543-571):
1. portal-tasks.tsx: add a "Session files" group after the existing task groups, one card per
   (accepted submission × requirement) — reuse the EXACT card language already in this file
   (rounded-xl border, px-4 py-3.5 rows, expanded p-4). Each row: requirement title, session
   code, due date via <Timestamp mode="date" timezone={data.event.timezone}>, status (uses the
   upload state), expand to the existing FileThread (components/portal/file-thread.tsx, requires
   timezone prop) + upload action. Reuse the upload mutation shape from
   portal-submissions.tsx:462-476 (uploadPortalFile with requirementId + submissionId) — extract
   a small shared component if cleaner (components/portal/), do NOT duplicate 100 lines.
2. Progress header "N of M complete" at the top of portal-tasks counts tasks + file
   requirements together.
3. portal-home.tsx Tasks card: include file requirements in the "done of total" count and the
   "next due" line.
4. Portal home/submissions already show "{n} of {m} files uploaded" — keep those consistent.

NOTE: if WP26 (separate worktree) lands a per-speaker assignment model, integration will adapt
your work at merge; code against the CURRENT model in this worktree (requirements + uploads as
they exist here).

## Acceptance
- Admin (Dana): Add session with 2 speakers → appears in Sessions desk + agenda pool; tasks
  auto-assigned if templates say so.
- Portal (Lina): Tasks page lists her file requirements with working upload + thread; home card
  counts include them.
- `pnpm check` clean; seed verification passes.

Write REPORT-WP27.md and stop. Do not commit.
