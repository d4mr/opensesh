# WP17 — Speaker roster administration and communications

## What was built

- Expanded `/admin/speakers` into a dense roster with identity, title/company, profile readiness, text-labelled workflow status, task progress, record counts, search, workflow/task filters, and clear filters.
- Added centered full-profile create/edit dialogs with name, email, title, company, rich-text bio, social links, R2-backed headshot upload, dietary requirements, T-shirt size, workflow status, and travel/logistics persisted in `contacts.custom`.
- Hardened CSV import into mapping, preview, per-match Update/Skip, normalized event-email deduplication, and created/updated/skipped results. The evaluator fixture produced `1 created / 1 updated / 1 skipped`, with exactly one Dana, Priya, and Marcus.
- Added per-speaker and selected-speaker portal invitations through the existing mail log/provider, including copyable `/portal` success state and idempotent already-invited feedback.
- Added `/admin/communications` and navigation with recipient filters/selection, template CRUD, documented merge tokens, real per-recipient previews, campaign snapshots, recipient/log linkage, history, and recipient status drill-in.
- Added configurable incomplete-task reminder rules with enable/disable, days-before-due, last-run, and deterministic Run now behavior. Runs exclude done/waived assignments and are idempotent within the same UTC delivery day.
- Extended general task create/edit with all-speaker or explicit multi-speaker assignment. Edits remove only deselected in-event assignments and retain completion state for speakers that remain selected.
- Added focused tests for evaluator CSV parsing/deduplication, per-recipient merge resolution and campaign row cardinality, reminder eligibility, and idempotency.

## Rubric coverage

- WP17 directly implements SPK-01 through SPK-06 and SPK-12 through SPK-16.
- Existing SPK-07 through SPK-11 portal, task, file-version, and session-assignment behavior was preserved and covered by the full regression/check/build and mail/review verifier runs.
- The resulting Speaker Management surface covers SPK-01 through SPK-16 without schema changes.

## Decisions and tradeoffs

- Used wide centered dialogs for create/edit/import/invite flows. This keeps primary actions above the fold and preserves roster context; separate pages would add routes without improving the specified workflow.
- Stored free-form travel/logistics in `contacts.custom.travelLogistics`, as required. No typed column or migration was added.
- Reused the existing rich-text editor, Portal/R2 file plumbing, Email Log, and demo-mode Mail service. No alternate upload or delivery path was introduced.
- Normalized email addresses at import/save boundaries and scoped matches and mutations by event. Cross-event contact IDs are ignored/rejected by the relevant repository boundary.
- No scheduled-handler pattern exists in the project, so Run now is the deterministic reminder evidence path specified by WP17. Run now first persists the visible rule settings, then queues eligible reminders.
- Campaign recipient subject/body values are resolved and stored per recipient before sending, keeping history stable if a template later changes.
- Task assignment edits preserve retained assignment rows and their completion state. Replacing all rows would have been simpler but would incorrectly reset completed tasks.
- No schema or migration files changed. No dependencies were added.

## Automated and integration evidence

Final code checks:

- `pnpm check` — passed; all packages formatted, linted, and type-checked.
- `pnpm test` — passed; 6 files, 22 tests.
- `pnpm build` — passed for landing and web Worker bundles.
- `git diff --check` — passed.

Required verifiers were repeated against the final code, with a separate successful `pnpm db:reset` before each:

- `pnpm cfp:verify` — passed all 13 checks.
- `pnpm review-desk:verify` — passed all 13 checks.
- `pnpm mail:verify` — passed failure isolation plus all 10 calendar/reminder checks; 12 calendar invitations and 13 task reminders.

WP17-specific database round trips against `opensesh_wp17`:

- Organizer profile edit sentinel, workflow status, and travel/logistics persisted after reload.
- A cross-event workflow mutation returned `NotFound`.
- First portal invite created an email-log row; the second returned already invited without another row.
- A two-speaker campaign created exactly two recipient rows, both linked to email-log rows, and resolved Priya's subject to `Welcome Priya Raman to DevFlow Conf 2027`.
- Three general tasks assigned to Priya and Marcus created exactly six assignments.
- After completing one assignment and waiving one, Run now logged exactly two recipient reminders; a same-day rerun was skipped.
- Editing a task from two speakers to Priya plus an out-of-event contact retained exactly Priya's in-event assignment.
- The evaluator CSV produced `created: 1, updated: 1, skipped: 1` and no duplicate fixture contacts.

Authenticated HTTP smoke checks on the required dev port returned 200 for:

- `http://localhost:3017/admin/speakers`
- `http://localhost:3017/admin/tasks`
- `http://localhost:3017/admin/communications`
- `http://localhost:3017/admin/emails`

The rendered responses contained the new roster actions/columns, seeded template, real Priya data, merge tokens, campaign history, and reminder controls. The in-app browser runtime reported no available browser instances, so a visual click-through/screenshot could not be captured in this session; no unrelated browser automation was substituted. The authenticated HTTP and repository round trips above cover the same routes and mutations. The dev server was stopped afterward, and port 3017 is free.

## Open items

- No implementation or automated-check items remain open.
- A human visual walkthrough can be run with the URLs below because browser control was unavailable here.
- No commit was created because the WP17 worktree instruction explicitly prohibited commits, overriding the generic reporting template's commit item. No push, deploy, remote database, or production database action was performed.

## Exact verification commands and URLs

Confirm the active local database before any reset:

```sh
rg '^DATABASE_URL=postgres://postgres:opensesh@localhost:5433/opensesh_wp17$' apps/web/.dev.vars
```

Run checks:

```sh
pnpm check
pnpm test
pnpm build
```

Run the required verifier sequence, keeping each reset separate:

```sh
pnpm db:reset
pnpm cfp:verify
pnpm db:reset
pnpm review-desk:verify
pnpm db:reset
pnpm mail:verify
```

Start the local walkthrough only on port 3017:

```sh
pnpm --filter @opensesh/web dev -- --port 3017
```

Sign in as Jordan Alvarez and verify:

- `http://localhost:3017/admin/speakers`
- `http://localhost:3017/admin/tasks`
- `http://localhost:3017/admin/communications`
- `http://localhost:3017/admin/emails`
- `http://localhost:3017/portal`

Stop the dev server with `Ctrl-C` when finished.
