# WP15 — Eval schema and deterministic personas

## What was built

- Added the complete review subsystem: rounds, criteria, round membership, assignments, answers, AI results, typed Effect schemas/errors, weighted scoring, blind queue models, assignment/recusal logic, and repository read/write operations.
- Added speaker communications data: workflow status, templates, campaigns, resolved recipients, and reminder rules, with campaign/reminder repository operations.
- Added the organization-plane CRM: canonical contacts and event links, notes, tags, dynamic segments, pipeline stages/cards/history, plus directory/detail/board and mutation repository operations. No CRM table directly references an identity-plane user ID.
- Reused the existing submission/contact edit-history snapshot model after auditing it; no second versioning system was added.
- Added deterministic DevFlow Conf 2027 fixtures: exact event metadata, tracks, formats, rooms, CFP fields, four pending submissions, Priya and Marcus speaker profiles, Sam's review membership, two review rounds and their criteria, acceptance template, disabled reminder, CRM stages, and cross-event canonical contacts.
- Added working better-auth password accounts for Jordan, Priya, Marcus, and Sam, with persona-aware DevFlow event scoping.
- Added review-domain tests covering the required 3.33 weighted score, numeric/dropdown rejection, cap enforcement, duplicate-free distribution, blind redaction, recusal, and AI override preservation.
- Replaced all prior migrations with one flat generated init migration: `packages/domain/migrations/20260810163937_sticky_captain_flint`.

## Decisions and tradeoffs

- The referenced `docs/EVAL-100-PERCENT-SPEC.md` is absent from this worktree. I used the matching authoritative copy at `../sessionboard-clone/docs/EVAL-100-PERCENT-SPEC.md`, then followed WP15's narrower scope exactly.
- DevFlow uses the existing AI.Engineer organization. This keeps the required two-event isolation story while allowing one organization-scoped CRM directory to link existing people with Priya and Marcus, without inventing another organization or compatibility layer.
- Persona default-event routing is resolved from authenticated evaluator email. Jordan and Sam enter the DevFlow admin shell; Priya and Marcus enter its speaker portal. Existing demo personas continue to default to AI.Engineer.
- Auto-distribution is deterministic and cap-aware, with optional track filtering. No assignments or answers are seeded, so evaluator create-from-empty flows remain usable.
- Campaign sending and reminder execution are deliberately repository skeletons, as required for this foundation WP; later WPs own their UI and full delivery workflows.

## Verification evidence

- `pnpm run db:reset` — passed against `postgres://postgres:opensesh@localhost:5433/opensesh_wp15`; seed verification passed all 52 assertions.
- `pnpm check && pnpm test && pnpm build` — passed; 4 test files and 17 tests passed.
- `pnpm run db:reset && pnpm cfp:verify` — passed, 13 checks.
- `pnpm run db:reset && pnpm review-desk:verify` — passed, 13 checks.
- `pnpm run db:reset && pnpm mail:verify` — passed, 10 checks including failure/retry isolation.
- Direct `Reviews.listRounds("evt_devflow_2027")` decode returned Initial Review with all four criteria and Sam as its sole member, and Final Review with both criteria and no members.
- Authenticated HTTP probes on `http://localhost:3015` returned successful sign-in and session responses for all four accounts. Redirect targets were `/admin` for Jordan and Sam and `/portal` for Priya and Marcus.
- Exactly one migration directory exists. `apps/landing` has no diff. Port 3015 was stopped after the probes.
- No commit, push, deploy, or production/remote database operation was performed.

## Open items

None within WP15. Review, communications, and CRM user interfaces remain intentionally out of scope for WP16–WP20.

## Exact walkthrough

From the repository root:

```bash
pnpm run db:reset
pnpm check
pnpm test
pnpm build

pnpm run db:reset && pnpm cfp:verify
pnpm run db:reset && pnpm review-desk:verify
pnpm run db:reset && pnpm mail:verify
```

Confirm the single flat migration:

```bash
find packages/domain/migrations -mindepth 1 -maxdepth 1 -type d
```

Run the walkthrough server only on the reserved WP15 port:

```bash
pnpm --filter @opensesh/web dev --port 3015
```

Open `http://localhost:3015/login` and use:

| Persona | Email | Password | Expected landing |
| --- | --- | --- | --- |
| Jordan Alvarez | `jordan.organizer@sbek-test.example.com` | `SbekTest!2027-org` | `/admin`, DevFlow Conf 2027 |
| Priya Raman | `priya.speaker@sbek-test.example.com` | `SbekTest!2027-spk` | `/portal`, DevFlow Conf 2027 |
| Marcus Okafor | `marcus.speaker@sbek-test.example.com` | `SbekTest!2027-spk2` | `/portal`, DevFlow Conf 2027 |
| Sam Whitfield | `sam.reviewer@sbek-test.example.com` | `SbekTest!2027-rev` | `/admin`, DevFlow Conf 2027 |

Stop the server with `Ctrl-C` when the walkthrough is complete.
