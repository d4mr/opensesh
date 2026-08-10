# WP18 — Organizer content editing, history/restore, central files library, ZIP export

Read `docs/EVAL-100-PERCENT-SPEC.md` first — Step 9 of §9 and rubric items CNT-06, CNT-08…CNT-14 (§8.4) are authoritative. Use existing `submission_edit_history` / `contact_edit_history` tables — NO schema or migration changes (WP15 already audited them).

## Scope

1. **Organizer session editor** (CNT-09): from the review-desk/sessions spotlight (and Content page), organizer edits title + abstract (RTE) directly. Every changed save writes an attributed `submission_edit_history` entry (author = organizer event member, previous/new values). Organizer edits are auto-approved (they ARE the approver) — status approved, public content updates immediately.
2. **History + restore UI** (CNT-11): history section (session spotlight + Content page) listing timestamped, author-attributed entries with field-level diffs (reuse `change-diff.tsx` from WP14). **Restore** action on any entry: writes a NEW history entry restoring that snapshot (never deletes history), with in-app confirmation. Two sequential organizer edits → two Jordan-attributed entries; restoring the first removes only the second change.
3. **Organizer speaker editor** (CNT-10): edit bio + replace headshot from admin (coordinates with WP17's Edit Speaker — if that form exists on main already, extend it; otherwise build a minimal bio/headshot editor on the speaker spotlight); writes `contact_edit_history`, approved immediately, public rendering updates.
4. **Approval gating audit** (CNT-12): verify EVERY public query (all five public views, widget embeds, direct public session detail URL `/e/$slug/sessions/$code`) excludes unapproved content; direct lookup of unapproved returns the public not-found state. Add server tests per §11.3 (public query excludes unapproved; direct lookup NotFound).
5. **Upload constraints evidence** (CNT-06): portal upload controls must visibly state accepted types + max size BEFORE file selection, and the server must reject violations with a visible inline error. Verify/complete both sides.
6. **Bulk reminders evidence** (CNT-08): deliverables dashboard filter → select outstanding → send reminders → toast with count + email_log entries. Verify/complete (may exist from WP7 — make the count + logs airtight).
7. **Central files library** (CNT-13): new `/admin/files` page (add nav item "Files"): one row per file request/upload target with session, speaker, kind, date, status, **version count**, filters (session/speaker/status), record count, links into the existing file detail (versions + comments + download). Read model over existing tables — no new storage.
8. **ZIP export** (CNT-14): multi-select rows (latest versions) → "Export ZIP" → grouping dialog (by session / by speaker) → generates a real ZIP (uncompressed STORE entries are fine — implement a small standards-compliant ZIP encoder in the domain or web layer, NO new dependency) served as a download from the worker; queued/ready states if generation is async, else direct download. Paths: `<session-code>/<filename>` or `<speaker-name>/<filename>`. Include only selected latest versions. Unit-test the encoder (§11.3: ZIP contains only selected latest versions, correct grouping paths — a minimal parser assertion on central directory entries is enough).

## UI rules

`docs/DESIGN.md` binding: dense rails, text-labelled statuses (Approved/Pending review/Draft), counts, Clear filters, no sheets, confirmations for restore, forms preserve values on validation failure, bulk toasts include counts.

## Constraints (HARD)

- Branch `wp18-content-admin`. NO commit/push/deploy/prod DB. Local DB `opensesh_wp18`, port 3018 only, stop server after. No schema/migration changes. Don't touch apps/landing or untracked files.
- `pnpm check`/`test`/`build` + three verifiers (fresh db:reset each) green. Add §11.3 unit tests.
- REPORT-WP18.md per §19 with rubric IDs satisfied.

## Acceptance (rehearse CNT-S3 trace from §7)

- Prefix a session title with `UPDATED: `, append a sentence to the abstract, reload → both persist; second edit → two attributed entries; restore removes only the second.
- Organizer bio edit + headshot replace persist and render publicly.
- Unapproved session absent from all public surfaces including direct URL.
- Files library shows slides row with version count 2; ZIP with chosen grouping downloads and passes manual inspection.
