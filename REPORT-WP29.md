# WP29 report — Evaluation correctness

## What was built

- Kept CFP-origin submissions in every evaluation round view after acceptance or decline by using
  the review desk's source-form predicate. Results, assignments, aggregates, AI results, reviewer
  answers, and exports now continue to include decided submissions.
- Added the submission status badge to round Results and added a distinct `Submission status`
  column to evaluation CSV exports. The existing assignment status export is now labeled
  `Review status`.
- Made the review desk count completed round assignments in addition to legacy reviews. Submission
  spotlight details now render completed round reviews with reviewer name, completion time, and
  per-criterion answers under the existing Reviews section.
- Added participant role and position to review desk speakers, ordered participants by position,
  and made decision previews prefer a role containing `primary`. Multi-recipient preview copy now
  appears for either a batch or a single submission with multiple speakers.
- Made manual and automatic assignment responses return `{ created, skipped }`. Repeated assignment
  attempts now use a neutral zero-created toast, and successful toasts report only newly created
  assignments. Auto-distribution is limited to pending and maybe submissions.
- Made reminder responses return `{ queued, sent, failed }`. Provider failures now produce an error
  toast; zero eligible reminders produce a neutral toast.
- Added a server-derived `aiConfigured` flag. With no Anthropic key, AI review buttons remain visible
  but disabled and show the quiet `Anthropic key not configured` hint.
- Invalidated review desk list and detail queries after a reviewer completes a round review so cached
  spotlight counts and content refresh immediately.

## Decisions and tradeoffs

- Round reviews remain separate from the legacy `reviews` table. The read model combines their
  counts and presents both sources, avoiding the dual-write path explicitly rejected by the brief.
- `reviewCount` combines completed round reviews with all legacy reviews, while the legacy rating
  remains based on legacy numeric scores. Inventing a cross-system rating would mix incompatible
  scorecards.
- Automatic distribution treats only `pending` and `maybe` as reviewable. Decided, withdrawn, and
  draft submissions stay visible where required but are not automatically assigned.
- CSV now distinguishes submission decision state from per-review assignment state instead of
  overloading one `Status` heading.
- No database schema, migration, dependency, production data, deployment, commit, or push was
  touched.

## Verification

Passed:

- `pnpm test` — 11 files, 41 tests.
- `pnpm review-desk:verify` — all 13 checks passed.
- `pnpm cfp:verify` — all 13 checks passed.
- Targeted local repository scenario on `opensesh_wp29`:
  - first assignment created; repeated assignment skipped;
  - completed round review appeared as count 1 in list and detail;
  - spotlight exposed Sam Whitfield, completion metadata, and all four criterion answers;
  - acceptance preserved the result row, one human review, and weighted aggregate `3.67`;
  - the accepted submission remained in the Abstracts desk and spotlight;
  - re-decision preserved the row with declined status;
  - primary recipient resolved to Priya Raman, ordered before Marcus Okafor;
  - first auto-distribution created 3 assignments; the repeat created 0 and skipped 3;
  - `aiConfigured` was false without `ANTHROPIC_API_KEY`.
- `pnpm --filter @opensesh/domain db:reset` after every mutating verifier; the final run ended with
  `Seed verification passed`.
- `pnpm check` — clean across the workspace.
- `pnpm build` — complete client and Worker build passed.
- HTTP smoke check: `http://localhost:3029/login?demo=organizer` returned `200 text/html`.
- `git diff --check` — clean.

## Open verification item

The automated in-app browser walkthrough could not run because this Codex session exposed no
browser backend. The server was started successfully on port 3029 and all non-browser acceptance
paths above were exercised. A final human browser pass should confirm the exact rendered toasts,
badges, CSV download, decision-preview greeting, and disabled AI affordance.

## How to verify

```sh
pnpm --filter @opensesh/domain db:reset
cd apps/web && pnpm exec node --env-file=.dev.vars scripts/run-vp.mjs dev --port 3029
cd ../..
pnpm test
pnpm check
pnpm build
```

Open:

- Organizer: `http://localhost:3029/login?demo=organizer`
- Reviewer: `http://localhost:3029/login?demo=reviewer`
- Evaluation: `http://localhost:3029/admin/evaluation`
- Abstracts: `http://localhost:3029/admin/abstracts`

Walkthrough: as Dana, open the initial round, assign Rey a review, and repeat the same assignment to
confirm the neutral zero-created toast. Switch to Rey and submit the scorecard. Switch back to Dana
and compare Progress, Results, the Abstracts review count, and the submission spotlight. Accept and
then decline the reviewed submission and confirm its Results row, review details, aggregate, status
badge, and CSV row remain. Preview the two-speaker SESS-1 decision email and confirm it greets Priya.
With the local environment's missing Anthropic key, confirm `Run AI review` is disabled with the
configuration hint.
