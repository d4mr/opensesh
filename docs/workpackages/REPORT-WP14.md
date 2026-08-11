# WP14 — Speaker spotlight depth

## What I built

- Expanded the existing speaker-directory bootstrap with each speaker's task assignments, current file versions, ten most recent emails, and pending profile changes.
- Added the complete dense spotlight sequence: copy-email header action, profile-readiness checklist, contact/logistics and bio, linked sessions, tasks with Waive, downloadable files, linked email history, and inline profile-change review.
- Added `?email=` deep linking to Email delivery so a spotlight email row opens the existing viewer dialog for that message.
- Extracted the profile diff mapping and diff UI shared by Content management and the speaker spotlight.
- Added optimistic visual state for task waivers and profile approvals/rejections, followed by directory and portal-cache reconciliation.

## Decisions and tradeoffs

- I extended the existing speaker-directory server call instead of adding page-level portal and email queries. The repository performs the independent reads concurrently and returns one decoded bootstrap to the page. This keeps navigation/loading behavior simple at the cost of a wider directory payload.
- Current file versions are selected from rows ordered by upload date in TypeScript. This transfers more version rows than a Postgres-specific distinct/window query, but preserves the repository's database-dialect boundary and is adequate for this bounded admin directory.
- Submission-scoped tasks appear for every speaker linked to that session, matching the existing Tasks board ownership rule. Contact-scoped tasks appear only for their contact.
- `dietaryRequirements: "none"` counts as answered because it is the stored answer for “no dietary needs”; it is not a missing state. T-shirt readiness remains pending when its nullable value is absent.
- The spotlight displays the newest unresolved profile change. The current data model/flow normally has one pending profile history entry; all pending rows still remain in the read model.
- I reused `waiveAdminAssignment`, `approveProfileChange`, and `rejectProfileChange` unchanged. No profile-approval write logic was modified.
- UI follows the binding density rules: 11px overline labels, 32px enumerable rows, status-token dots, flat border/divider grouping, no nested Cards, and only existing press feedback. The Emil design-engineering skill reinforced keeping this frequent admin surface unanimated beyond those existing interaction affordances.

## Constraints confirmed

- Branch remained `wp14-speaker-depth`.
- No commit, push, deploy, remote database access, or production database access.
- Local database was `opensesh_wp14` from `apps/web/.dev.vars`.
- Dev server was run only at `http://localhost:3014/` and was stopped after verification.
- No database schema or migration files changed.
- Spotlight primitive internals, agenda layout, review-desk decisions, and profile-approval write logic were untouched.
- Final local database state is a fresh canonical seed.

## Verification

- `pnpm check` — passed across landing, domain, and web; no format, lint, or type errors.
- `pnpm test` — passed, 3 test files / 9 tests.
- `pnpm build` — passed for landing and the Cloudflare Worker app. Vite retained the existing landing `/dither-fade.png` runtime-resolution warning; it did not fail the build and is outside WP14.
- `pnpm run db:reset` then `pnpm cfp:verify` — passed all 13 CFP checks.
- Fresh `pnpm run db:reset` then `pnpm review-desk:verify` — passed all 13 review-desk checks.
- Fresh `pnpm run db:reset` then `pnpm mail:verify` — passed failure isolation plus all 9 mail/calendar checks.
- Final `pnpm run db:reset` — passed and restored the canonical seed.
- Direct Effect repository verification against the local database decoded 26 directory rows; 15 carried depth data. Seeded Maya Chen decoded with 2 sessions, 4 tasks, 1 current file, 1 email, 1 pending profile change, and `pending_review` readiness.
- Local HTTP check against `http://localhost:3014/admin/speakers?spotlight=con_01` returned the expected unauthenticated `307` redirect without server errors.

## Open items

- No functional WP14 item is open.
- Automated visual interaction could not run because the in-app browser runtime exposed no browser instance. A manual walkthrough is therefore recommended using the URLs below. Static checks, production build, local repository decoding, local serving, and every required database verifier passed.

## Exact manual walkthrough

```sh
pnpm run db:reset
pnpm --filter @opensesh/web dev -- --port 3014
```

1. Open `http://localhost:3014/login?demo=organizer`.
2. Open `http://localhost:3014/admin/speakers?spotlight=con_01` for the fully populated seeded Maya Chen spotlight.
3. Verify the copy-email action, five readiness rows, linked session rows, four task rows, file download, seeded email row, and pending bio diff with Approve/Reject.
4. Follow the seeded email row; it should open `http://localhost:3014/admin/emails?email=email_01` with the existing email viewer dialog selected.
5. Open another speaker with sparse data to verify the exact empty states: “No tasks assigned.”, “No files yet.”, and “No emails sent.”

Run the complete automated matrix with:

```sh
pnpm check
pnpm test
pnpm build
pnpm run db:reset
pnpm cfp:verify
pnpm run db:reset
pnpm review-desk:verify
pnpm run db:reset
pnpm mail:verify
pnpm run db:reset
```
