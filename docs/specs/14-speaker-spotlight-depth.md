# WP14 — Speaker spotlight depth: consolidate speaker management into the directory

## Why

Sessionboard's speaker management shows everything about a speaker in one place. Our Speakers directory spotlight (WP11) currently shows only contact info, bio, and session links. Readiness lives on the list, tasks live on the Tasks page, files live on File Requests, emails live on Email delivery — fragmented. Consolidate the READ view (and light actions) into the speaker spotlight panel in `apps/web/src/components/admin/speakers-directory.tsx`.

## Scope — spotlight panel sections (top to bottom)

1. **Header** (exists): avatar, name, pending-profile chip, close. Add: copy-email icon button.
2. **Profile readiness**: compact checklist — bio present, headshot present, dietary/t-shirt answered (from contact), profile approved vs pending_review. Quiet colored dots (`--status-*` tokens), one line each, no cards.
3. **Contact & logistics** (exists — keep dense).
4. **Sessions** (exists): keep; each row links to the Sessions desk spotlight (`/admin/sessions?status=all&spotlight={id}`).
5. **Tasks**: this speaker's task assignments (template title, status badge, due date). Waive button per open task (reuse `waiveAdminAssignment`). Empty state: "No tasks assigned."
6. **Files**: uploads owned by this contact (headshot + file-request uploads + session assets they created): filename/kind, current-version date, download icon (reuse existing download path). Empty state: "No files yet."
7. **Emails**: last ~10 email_log rows for this contact — subject, type chip, status, sent date. Row click opens the existing email viewer route/dialog if one exists; otherwise plain rows. Empty state: "No emails sent."
8. **Profile changes**: pending profile-change entry with Approve/Reject (reuse the existing approve/rejectProfileChange server fns + diff rows from the Content page — extract the diff renderer if needed, do not duplicate it).

## Data

- Extend the speakers directory read model ONLY IF the data is missing: prefer one bootstrap query (`packages/domain/src/server/repos/widgets.ts` speaker directory or the admin portal repo — check what the page already loads). Read-model additions to `packages/domain` repos are allowed (WP11 rule: prefer reusing existing queries; add joined reads, no schema changes).
- NO schema changes; migrations untouched.

## Hard rules

- Worktree only, branch `wp14-speaker-depth`. NO git commit/push/deploy, NO prod/remote DB. Local DB `opensesh_wp14` (already in `apps/web/.dev.vars` here), dev port ONLY 3014.
- Do NOT touch: profile-approval WRITE logic in portal.ts (reuse reviewProfile as-is), agenda layout, review-desk decide, spotlight primitive internals.
- `pnpm check`, `pnpm test`, `pnpm build` green; `pnpm run db:reset` + `cfp:verify`, `review-desk:verify`, `mail:verify` (each after fresh reset) green.
- docs/DESIGN.md binding. Dense: section labels are xs muted headers, rows 32px, no Card shells inside the panel.
- Write `REPORT-WP14.md` with the standard sections.
