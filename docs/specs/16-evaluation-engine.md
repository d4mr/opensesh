# WP16 — Evaluation engine: rounds, pools, blind scoring, results, AI triage

Read `docs/EVAL-100-PERCENT-SPEC.md` first — Steps 3–6 of §9 and rubric items CFP-10, CFP-11, ABS-01…ABS-14 (§8.2) are the authoritative requirements. WP15's schema (`review_rounds`, `review_criteria`, `review_round_members`, `review_assignments`, `review_answers`, `ai_review_results`) and repo skeletons in `packages/domain/src/server/repos/reviews.ts` are already on main — extend them; do NOT change the schema or migrations.

## Scope

Replace the current single-plan Evaluation page with the full round-based engine:

1. **Rounds workspace** (`/admin/evaluation`): rounds list (name, window, blind badge, reviewer count, progress) + Create/Edit round on a dedicated page (`/admin/evaluation/$roundId`) — NOT a sheet (overlay doctrine: complex editor = page). Round editor: name, opens/closes (datetime pickers with event timezone, reuse `datetime-picker.tsx`), blind flag, position; scorecard criteria CRUD (numeric w/ min/max/weight, dropdown w/ option editing + reorder, long text; required flag; positions) with a live reviewer-form preview pane (two-pane like the WP13 portal-form editor).
2. **Reviewers tab per round**: add/invite by email (creates or attaches the account; success state MUST show a copyable access path — CFP-10), assignment cap editing, pool list. Adding to one round never touches another (ABS-02).
3. **Assignments tab per round**: table of submissions × assignment state; select submissions + reviewer → Assign selected; track filter; Auto-distribute honoring pool, caps, track filter, existing assignments (deterministic, no duplicates — unit tests exist from WP15); unassign. Idempotent.
4. **Reviewer experience** (replaces reviewer queue): only own assignments, grouped by round with deadline + pending/completed/recused counts; dynamic scorecard rendering from criteria; server-validated bounds/options/required; blind rounds suppress ALL identity (names, company, headshots, emails, socials, identifying custom answers) — including page title, breadcrumbs, HTML attributes, cache (ABS-07 + Step 5.6); recusal action with optional reason + in-app confirmation; completed reviews reopen with stored values; reviewer shell has zero organizer capability (server-enforced).
5. **Progress & results** (organizer): per-round progress rows (assigned/completed/recused/remaining/%) updating live (ABS-08); select lagging reviewers → send reminder with sent count + email log (ABS-09, use existing mail infra, template mentioning round + pending count); results table per submission: criterion values, weighted aggregate (repo fn from WP15), recommendation, review count, completion; stable asc/desc sort on aggregate with visible direction (ABS-10); CSV export (round, submission, participants, reviewer, criteria, weighted total, recommendation, recusal, status — real download, ABS-13).
6. **AI first-pass** (ABS-14): per-submission action calling the configured Claude binding (same env/config pattern as WP9 agenda drafts — reuse its provider plumbing; typed visible failure when unconfigured, NEVER fabricated output); stores score + reasoning + provider/model; renders clearly labelled "AI" and visually distinct from human reviews; human override with reason, attributed, persists after reload, original AI score still shown.

## UI rules

`docs/DESIGN.md` binding: dense rails, 32–36px rows, text-labelled statuses (pending/completed/recused — never color alone), record counts on every list, filled-state headings, filters show active state + Clear filters, primary actions above the fold, no sheets (dialogs for small confirms, pages for editors). Save buttons say the action ("Save round", "Assign selected", "Send reminders", "Override score"). Counts in bulk toasts ("Assigned 2 submissions", "Sent 1 reminder").

## Seeded fixtures you can rely on

DevFlow Conf 2027 with Initial Review (blind; Originality 1–5 w2, Relevance 1–5 w1, Recommendation dropdown, Comments) + Final Review (Final Score 1–10, Comments), Sam Whitfield in Initial pool only, four pending fixture submissions. The evaluator will re-do these flows from scratch, so create-from-empty must work and re-creating must not duplicate (show matching record, offer reuse).

## Constraints (HARD)

- Branch `wp16-evaluation-engine`. NO commit/push/deploy/prod DB. Local DB `opensesh_wp16` (apps/web/.dev.vars), port 3016 only, stop server after.
- No schema/migration changes (WP15 owns them). If a column is genuinely missing, STOP and write it in REPORT-WP16.md instead of adding migrations.
- Don't touch apps/landing or untracked files. No `any`; typed Effect errors; one round trip per server fn where feasible.
- `pnpm check`/`test`/`build` + all three verifiers (fresh db:reset before each) green.
- Write REPORT-WP16.md per §19 of the eval spec (include rubric IDs satisfied).

## Acceptance (rehearse ABS-S2/ABS-S3 + CFP-S3 traces from §7)

- Both seeded rounds reload with full config; new round create-from-empty works.
- Sam's queue: exactly assigned submissions; blind view has zero identity strings (grep the HTML).
- Scores 4/2/Accept/comment persist and reopen; progress 0/2 → 2/2; aggregate ≈3.33 shown for the isolated first review; asc/desc sort reorders visibly.
- Reminder logs; CSV downloads with correct content; AI result + override survive reload.
