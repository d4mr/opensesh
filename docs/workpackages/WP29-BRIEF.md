# WP29 — Evaluation correctness (OS-013, OS-014, OS-016 + verified adjacents)

All findings verified against this exact commit. NO schema changes — do not touch
packages/domain/migrations or db/schema.

## Hard rules

- NO git commit/push/deploy. NO prod DB. DB `opensesh_wp29` (`apps/web/.dev.vars` set);
  `pnpm --filter @opensesh/domain db:reset` re-seeds. Dev port **3029**.
- Read AGENTS.md (Effect v4 discipline) + docs/DESIGN.md for UI (dense, quiet, status via
  --status-* tokens, sentence case).
- CAUTION: verifier scripts (cfp:verify, review-desk:verify) mutate seed state — db:reset after.
- Finish: `pnpm check` clean; db:reset ends "Seed verification passed"; REPORT-WP29.md.

## Fix 1 — accepted submissions vanish from Results/export (OS-014, P1)

- Accepting rewrites kind→"session" (repos/review-desk.ts:1229-1243). The evaluation workspace
  loads ONLY kind="abstract" (repos/reviews.ts:358), so the accepted row loses its Results row,
  reviews, weighted aggregate, AI result, CSV export row (server-fns/reviews.ts:403-445 iterates
  view.results) and its Assignments-tab row — while Progress denominators still count it
  (reviews.ts:480-499), so tabs disagree.
- Fix: change reviews.ts:358 to the desk's own predicate (review-desk.ts:281-286):
  `or(isNotNull(submissions.sourceFormId), eq(submissions.kind, "abstract"))`. Then add a
  status column/badge to the round Results table (StatusBadge component exists) so decided rows
  read as decided, and include status in the CSV export.
- Acceptance: accept a reviewed submission → its reviews/aggregate/reviewer/comments/export row
  all remain, now showing accepted; decline likewise; Progress and Results agree.

## Fix 2 — spotlight "Reviews · 0" (OS-013, P2)

- Two disjoint stores: submission spotlight/list count the LEGACY `reviews` table
  (review-desk.ts:548-549, :207) but round reviewers write reviewAssignments/reviewAnswers only
  (reviews.ts:1469-1533). `Reviews.upsert`/`listBySubmission` (reviews.ts:779-834) are dead code.
- Fix (minimal, no dual-write): in review-desk detail + list queries, count completed round
  assignments per submission (reviewAssignments status='completed') and combine with legacy
  reviews count; in the spotlight detail, ALSO show round reviews (reviewer name, submitted at,
  per-criterion answers are available via reviewAnswers) under the existing Reviews section so
  the record-level view tells the truth. Keep it dense — list rows per DESIGN.md.
- Acceptance: reviewer completes a round review → spotlight Reviews count and content update
  (after invalidation) and match round Results, immediately and after reload.

## Fix 3 — decision preview greets the wrong participant (OS-016, P2)

- decision-dialog.tsx:63-71 picks speakers[0] from a Map built in row-arrival order;
  review-desk list query never selects or orders participants' role/position
  (review-desk.ts:215-251, :310).
- Fix: select role + position into the list's speaker rows, order participants by position, and
  in the dialog prefer `speakers.find(s => /primary/i.test(s.role)) ?? speakers[0]`. Show the
  "Previewing the first recipient" note whenever the previewed submission has >1 speaker (today
  it only shows for multi-submission batches, decision-dialog.tsx:170-175).
- Acceptance: SESS-1-shaped submission (Primary speaker listed second) previews the primary
  speaker's first name; per-recipient sends unchanged.

## Fix 4 — honest assignment/reminder feedback (OS-012/OS-015 adjacents)

- Auto-distribute silently plans ZERO for non-pending submissions (reviews.ts:1404 filters
  status='pending') then toasts success; assign returns the REQUESTED count, not created
  (server-fns/reviews.ts:248-253; pre-existing rows count as ok at reviews.ts:1315).
- Fix: scope the auto-distribute pool to `status <> 'withdrawn'` AND non-draft (decided
  submissions may still be assigned deliberately? No — keep pool = reviewable: pending+maybe;
  the point is the TOAST must be honest). Return {created, skipped} from assignment ops; toast
  "Assigned N" with created only, and when created=0 use a neutral toast "No new assignments —
  all selected submissions already assigned" (toast.info/message, not success).
- Reminders: sendReviewReminders counts only sent/demo deliveries (server-fns/reviews.ts:338-342)
  → "Sent 0 reminders" success on provider failure. Return {queued, sent, failed}; toast an
  error variant when failed>0.
- Acceptance: re-running auto-distribute reports honestly; failed sends produce an error toast.

## Fix 5 — AI review honesty (OS-017 slice)

- Failure is already explicit (good, keep). Add: an `aiConfigured` boolean from the server
  (evaluation admin payload — runtime env has ANTHROPIC_API_KEY as Option) so the "Run AI
  review" affordances render a quiet disabled state with "Anthropic key not configured" hint
  instead of an invitation that always errors. Do NOT add a fake deterministic scorer for
  human-quality reviews — honesty over theater (the agenda solver fallback is a different case:
  it produces a real schedule).
- Acceptance: without a key the button is disabled with the hint; with a key behavior unchanged.

## Verify (dev :3029)

As Dana: assign Rey a review in a round; as Rey complete it; as Dana check round Results,
Progress, submission spotlight all agree; accept it; verify Results row remains with accepted
badge + CSV includes it; decision preview on a 2-speaker submission greets the primary.
`pnpm check` clean; db:reset passes. Write REPORT-WP29.md. Do not commit.
