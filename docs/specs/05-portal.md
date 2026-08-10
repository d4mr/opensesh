# WP5 — Speaker portal + portal admin (tasks, forms, file requests)

Read `AGENTS.md` first. Prereqs: WP0–WP2 merged; WP3's `FormRenderer` (`src/components/forms/`) if already merged — if not, coordinate: build against the same form-definition schema from WP1 and keep rendering in that shared component. References: `docs/PRD.md` §F6–F7, `research/image-notes-portal.md` (speaker portal + Portal>Tasks/Forms/File Requests sections). Fixtures: seeded task templates (hotel/flight/bio), assignments for accepted speakers, portal forms.

## A — Speaker portal (`/portal/*`, speaker persona)

- **Home**: My Submissions card (`SESS-n — title`, format, status pill — status is THE thing a speaker checks; make it unmissable), My Profile card (avatar, name, email, completeness hint "Add your bio"), Tasks summary ("2 of 4 tasks done" + next due). Cards enter with a 40ms stagger on first paint only.
- **Submissions**: list + detail; edit own submission via FormRenderer until form close date (`FormClosed` inline notice after); withdraw (confirm dialog, status → withdrawn).
- **Profile**: bio (rich text, 5000 counter), names, pronouns, headshot upload (R2 — add bucket binding; store key on contact; render everywhere), social links. Autosave on blur + "Saved" whisper.
- **Tasks**: grouped **My Tasks** (contact-scope) / **Submission Tasks** (per accepted submission). Each: title, instructions (rich text), due date, status. Complete = check-off (manual), or fill linked portal form (inline via FormRenderer → response recorded → task auto-completes), or upload for file-request tasks. **Task completion is the one designed delight moment**: checkbox → spring settle (motion lib, subtle, ~300ms, bounce ≤0.2), row fades to done group. Respect reduced-motion.

## B — Portal admin (`/admin/tasks`, `/admin/portal-forms`, `/admin/file-requests`)

- **Tasks**: template list (title, scope badge Contact|Submission, linked form/file-request, auto-assign flag, assigned/done counts) + create/edit drawer (shadcn `sheet`). **Assignments board** tab: per accepted speaker — outstanding/done counts, filter "has outstanding", row expand → their assignments, manual assign/waive. This is the PRD's "real-time dashboard of speakers with outstanding onboarding tasks" — make the outstanding filter the default sort.
- **Portal forms**: list + 3-step editor (Setup: name/title/scope · Questions: sections + fields, same builder pieces as WP3 · Settings: confirmation email toggle+body). Responses tab per form: table of responses (submitter, submitted at, answers dialog), CSV export.
- **File requests**: list + create drawer (title, scope, instructions); uploads collected on the request (uploader, file, date, download); bundle download (zip via server fn is fine at demo scale).

## C — Content management depth (eval-critical: this area is 15% of the rubric — build it FULLY)

- **File versioning**: re-uploading to a file-request task (or replacing a headshot/slides) creates a new version, never overwrites — version list per file (uploader, date, size, download each), newest is "current". Schema: `file_versions` child table (FLAT rule applies — regenerate the init migration).
- **File comment threads**: comments on an uploaded file, visible to BOTH roles — organizer comments ("please re-export at 1920px") appear in the speaker's portal on that file, speaker replies appear in admin. Plain thread (author, timestamp, body), no rich text needed. Unread indicator on the task/file row.
- **Session edit history + restore**: every edit to a submission's content fields (via portal or admin) records a history entry (who, when, field-level diff of changed fields). Detail views get a History tab: list of edits, expandable diffs, **Restore** button per entry (restores those field values as a NEW edit — history is append-only).
- **Approval gating**: submission content edits after acceptance land as `pending_review` changes — admin sees a "content changes awaiting approval" queue (badge on Sessions nav), approves/rejects each. Public agenda/pages render the last APPROVED content only; the portal shows the speaker "changes pending approval" state. Simplest correct model: `approved_snapshot` JSON on submission, updated on approve.
- Speaker profile adds **dietary requirements** (free text or select: None/Vegetarian/Vegan/GF/Other) and **t-shirt size** (XS–XXL) — surfaced in admin speaker views and CSV exports (CRM rubric).

## Acceptance

1. `pnpm typecheck && pnpm build`; seed green.
2. Walkthrough: role-switch to accepted speaker → complete hotel form task inline (form response recorded, task auto-done, delight moment fires) → upload flight receipt to file-request task → update bio + headshot (appears in admin submission detail) → edit their submission → as Dana: assignments board shows the completion state live, download the uploaded file, view form responses, create a new task template with auto-assign and verify it appears for newly accepted speakers (accept one pending submission to prove it end-to-end).
3. Speaker can never see another contact's tasks/submissions (probe with two speaker personas; `Forbidden` typed path).
4. Zero-debt self-review + motion checklist (the ONE spring is the only motion-lib usage; everything else CSS).
