# WP17 — Speaker roster administration + communications engine

Read `docs/EVAL-100-PERCENT-SPEC.md` first — Steps 7–8 of §9 and rubric items SPK-01…SPK-16 (§8.3) are authoritative. WP15's schema (`contacts.workflow_status`, `email_templates`, `email_campaigns`, `email_campaign_recipients`, `reminder_rules`) is on main — extend repos/UI only; NO schema or migration changes.

## Scope

### Roster administration (Step 7)
1. **Add Speaker** (manual): button on /admin/speakers opening a dedicated create page or wide dialog with FULL profile: name, email, title, company, bio (RTE), social links (twitter/linkedin/website), headshot upload (reuse R2 file plumbing), dietary, t-shirt, and free-form travel/logistics (persists into `contacts.custom`). Organizer **Edit Speaker** with the same fields from the speaker spotlight (extend WP14's spotlight with an Edit action → same form).
2. **Workflow status** (SPK-04): editable status (invited/onboarding/confirmed/ready/declined) as a text-labelled badge in roster rows + spotlight; status filter on the roster; persists.
3. **Roster columns/filters** (SPK-01, SPK-12): identity, title, company, profile readiness, workflow status, task progress (n/m done); search (exists) + status filter + task complete/incomplete filters; record count; Clear filters.
4. **CSV import hardening** (SPK-03): current Import CSV must show header mapping (auto-recognize `name,email,title,company,bio`), a preview table of parsed rows, dedupe by event+normalized email offering Update/Skip for matches, and a result summary (created/updated/skipped counts). Must import `/private/tmp/killmysaas-evals/fixtures/speakers.csv` creating Dana Kowalski without duplicating Priya/Marcus.
5. **Portal invitation** (SPK-06): per-speaker (spotlight action) + bulk (roster selection): sends/logs a welcome email via existing mail infra AND shows a success state with a copyable portal path. Idempotent (shows "already invited" state).

### Communications engine (Step 8)
6. **Communications page** (`/admin/communications`, add nav item): campaign composer — recipient selection by filter (all speakers, status filter, task-incomplete filter) or explicit multi-select; template picker (reuse seeded acceptance template + CRUD for `email_templates` with documented merge tokens `{speaker_name}`, `{talk_title}`, `{event_name}`, `{portal_url}`); tokenized editor + **per-recipient resolved preview** before send (SPK-14 — show Priya's actual resolved subject/body); Send → campaign snapshot + one `email_campaign_recipients` row per contact each linked to an email_log entry; campaign history list with per-recipient status drill-in (SPK-13).
7. **Reminder rules** (SPK-16): settings block on Communications (or Tasks) page: days-before-due, enable/disable, last-run; a **Run now** action that sends task reminders only for incomplete+unwaived assignments due within the window, logs each recipient, idempotent within the window (skip already-sent). Wire the scheduled path if a cron/scheduled handler pattern exists; Run now is the deterministic evidence path.
8. **Task multi-assignment check** (SPK-05): task template create/edit must support choosing which speakers get assigned (all/selection) — verify existing auto-assign covers the fixture flow (3 tasks × 2 speakers = 6 assignments); add explicit speaker selection if missing.

## UI rules

`docs/DESIGN.md` binding. Dense rails; text-labelled statuses; counts everywhere; bulk toasts include counts ("Sent 2 invitations"); no sheets — pages or centered dialogs; primary actions above the fold; forms preserve values on validation failure.

## Constraints (HARD)

- Branch `wp17-speaker-comms`. NO commit/push/deploy/prod DB. Local DB `opensesh_wp17`, port 3017 only, stop server after. No schema/migration changes. Don't touch apps/landing or untracked files.
- Emails only through the existing demo-mode mail provider (records to email_log) — never attempt real delivery.
- `pnpm check`/`test`/`build` + three verifiers (fresh db:reset each) green. Add unit tests per §11.2 (CSV dedupe, merge-token resolution per recipient, campaign recipient rows, reminder skip-completed + idempotency).
- REPORT-WP17.md per §19 with rubric IDs satisfied.

## Acceptance (rehearse SPK-S1/S2/S3 traces from §7)

- Priya & Marcus creatable from empty; organizer bio edit sentinel persists; Confirmed status + filter round trip.
- CSV import: Dana created, no duplicates, counts shown.
- Portal invite success + copyable path + log entry.
- Welcome campaign: tokenized template, resolved Priya preview, send, campaign + recipient history.
- Reminder Run now targets only incomplete tasks; log entries prove recipients.
- Travel/logistics fixture text saves and reloads.
