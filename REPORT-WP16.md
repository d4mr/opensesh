# WP16 — Evaluation engine report

Date: 2026-08-10  
Branch: `wp16-evaluation-engine`

## What was built

- Replaced the evaluation placeholder with a role-aware rounds index and a dedicated round editor at `/admin/evaluation/$roundId`.
- Added round setup for name, dates, order, blind review, numeric/dropdown/long-text criteria, weights, bounds, options, reordering, validation, live reviewer-form preview, and authoritative reload after save.
- Added round-scoped reviewer pools, email provisioning, copyable reviewer access paths, assignment caps, track-filtered assignment, auto-distribution, exact assignment, idempotent retries, unassignment confirmation, and invite logging.
- Replaced the reviewer queue with a round-grouped workspace that returns only the signed-in reviewer's assignments, shows deadline and status counts, renders the configured scorecard, validates every answer on the server, reopens stored answers, and supports confirmed recusal with an optional reason.
- Added defense-in-depth blind review redaction. Blind reviewer payloads omit participant/contact/custom-answer identity and redact participant names, company, email, and social handles if they appear in reviewer-visible title or description text.
- Reduced reviewer navigation to My Reviews, suppressed organizer event switching/portal controls, restricted reviewer event listing to the active event, and enforced organizer/reviewer authorization again in every server function.
- Added organizer progress, lagging-reviewer selection, logged reminder delivery, results with human answers and co-presenter role labels, weighted aggregates, visible stable ascending/descending sorting, recommendations, completion, and real CSV downloads.
- Added real Anthropic AI first-pass generation with typed visible configuration/provider failures, persisted score/reasoning/provider/model, a visually distinct AI result, and attributed persistent human overrides that retain the original score.
- Extended the Effect schemas, tagged error mapping, repository operations, server functions, TanStack Query definitions, and focused review-domain tests needed by the feature.

## Rubric coverage

Implementation coverage is complete for `CFP-10`, `CFP-11`, and `ABS-01` through `ABS-14`:

- `CFP-10`, `ABS-02`, `ABS-05`, `ABS-06`: reviewer provisioning, round isolation, exact/bulk assignments, caps, track filtering, auto-distribution, restricted shell, and server authorization.
- `CFP-11`, `ABS-03`, `ABS-07`, `ABS-12`: dynamic persisted scorecards, reviewer-owned queues, blind payloads, and recusal.
- `ABS-01`, `ABS-04`: independent persisted round configurations and weighted numeric aggregation.
- `ABS-08`, `ABS-09`, `ABS-10`, `ABS-13`: live progress, logged reminders, stable result sorting, and CSV export.
- `ABS-11`: participant roles, including co-presenter, are preserved and displayed in organizer results; the existing submission and speaker surfaces remain unchanged.
- `ABS-14`: provider-backed AI generation, stored provenance, distinct presentation, and persistent attributed override.

Browser-evidence sign-off is not claimed below where the environment could not supply a browser or provider key.

## Decisions and tradeoffs

- Kept the WP15 schema and the single existing migration untouched. Criteria retain their IDs during routine edits so saved answers are not erased; removed criteria alone are deleted. The rejected alternative was delete-and-reinsert, which was shorter but would discard answers.
- Reviewer provisioning attaches an existing normalized-email account or creates the minimal user, organization membership, and event membership needed for local evaluator access. Membership in one round never implies membership in another.
- Blindness is enforced in the repository's separate reviewer read model rather than hidden only in React. The organizer read model retains identities. The rejected UI-only approach would leave identity in query caches, HTML, and network payloads.
- Assignment retries return an existing assignment before checking the cap, preserving idempotency at the limit.
- Aggregates use only configured numeric criteria and their weights; equal/null values retain source order so both directions are stable.
- AI output uses Anthropic's tool response contract and never invents a fallback result. Regenerating a result intentionally clears its old human override because it creates a new AI baseline.
- Step 6 mentions an AI “inputs version,” but the locked WP15 `ai_review_results` table has no such column and WP16 explicitly forbids schema changes. The implementation persists all available authoritative fields: score, reasoning, provider, model, generation timestamps, original score, override, reason, actor, and override timestamp. Adding an unsanctioned metadata encoding was rejected.
- No new dependency or UI primitive was added; existing shadcn components and project tokens were reused.

## Automated checks

All commands completed successfully after the final code change:

| Command | Result |
| --- | --- |
| `pnpm check` | Passed in all three workspace packages; formatting, lint, and TypeScript clean. |
| `pnpm test` | Passed: 4 files, 18 tests. |
| `pnpm build` | Passed for landing and web through Vite+; no fallback used. The existing unresolved-at-build-time `/dither-fade.png` warning remains non-fatal. |
| `pnpm db:reset && pnpm cfp:verify` | Passed after a fresh local reset. |
| `pnpm db:reset && pnpm review-desk:verify` | Passed after a separate fresh local reset. |
| `pnpm db:reset && pnpm mail:verify` | Passed after a separate fresh local reset, including failure isolation. |
| Final `pnpm db:reset` | Passed; `opensesh_wp16` is back at its canonical seed. |

Repository-level scenario exercise also verified two exact Sam assignments, a stored `4 / 2 / Accept / comment` review, organizer completion, and a weighted aggregate of `3.33`. A serialized blind reviewer payload scan found none of Priya Raman, Marcus Okafor, Latticework Systems, Priya's email, or her social handle.

## Manual scenario evidence

- The dev server started successfully on the required `http://localhost:3016` and was stopped after the attempt; port 3016 has no listener now.
- The in-app browser runtime reported zero available browser instances even after its documented availability check. Therefore no browser screenshots, network inspection, downloaded-file inspection, or full CFP-S3/ABS-S2/ABS-S3 click trace could be captured in this environment.
- No `ANTHROPIC_API_KEY` is present in the local evaluator environment. The unconfigured typed-error path is implemented and persistent in the UI, but a real provider response plus browser override/reload trace was not executed.

## Open evidence

The feature code, project checks, domain integration exercise, and all required verifiers are complete. The remaining sign-off evidence requires environment capabilities rather than more implementation:

1. Rehearse CFP-S3, ABS-S2, and ABS-S3 in a working browser and capture the before/after screens, blind network-visible scan, CSV contents, and access-denial evidence.
2. Supply a local-only `ANTHROPIC_API_KEY`, generate one AI review, override it as Jordan, reload, and record the persisted original/override result.

No schema or migration file, `apps/landing` source file, remote database, deployment, or pre-existing untracked `codex-wp16.log` was touched. No commit was created because the user explicitly prohibited commits.

## Exact verification commands and URLs

Run from the repository root:

```sh
pnpm check
pnpm test
pnpm build

pnpm db:reset && pnpm cfp:verify
pnpm db:reset && pnpm review-desk:verify
pnpm db:reset && pnpm mail:verify
pnpm db:reset
```

Start the local app only on the permitted port:

```sh
cd apps/web
node --env-file=.dev.vars scripts/run-vp.mjs dev --port 3016
```

Then verify:

- `http://localhost:3016/admin/evaluation`
- `http://localhost:3016/admin/evaluation/rnd_devflow_initial`
- Organizer: `jordan.organizer@sbek-test.example.com` / `SbekTest!2027-org`
- Reviewer: `sam.reviewer@sbek-test.example.com` / `SbekTest!2027-rev`

Stop the server with `Ctrl-C` when finished.
