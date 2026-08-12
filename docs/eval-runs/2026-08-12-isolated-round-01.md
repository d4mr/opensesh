# Production Eval — Isolated Round 01

## Run identity

- Status: closed — hard-blocked during isolated onboarding
- Product baseline: `b3a4fb8`
- Production Worker: `e36d0d6e-93d6-4f13-9477-63137dc35da6`
- Evaluator baseline: `killmysaas-evals@8109958`
- Target: `https://app.opensesh.io`
- Evidence: `docs/eval-evidence/2026-08-12-isolated-r1/`

## Isolation contract

- This round starts in a brand-new workspace created for this run.
- No event, contact, submission, review, session, task, upload, agenda placement,
  widget, CRM record, or other product state from an earlier evaluation may be reused.
- No screenshot or observation from an earlier evaluation counts as evidence.
- The seven evaluator areas run in their specified order because they intentionally
  chain state within one full evaluation.
- Product fixes are forbidden until every Round 01 scenario has finished and the
  complete issue register below is frozen.
- Workarounds are allowed only to keep the evaluation moving and must be recorded as
  issues even when the associated rubric item ultimately passes.

## Round workspace

- Workspace: `SBEK Isolated Round 01` (`sbek-isolated-r1-20260812`)
- Primary event: `DevFlow Conf 2027` — creation failed before an event ID was issued
- Secondary event: `Forward Summit 2028`
- Organizer: fixture identity
- Speaker: Priya Raman fixture identity
- Reviewer: Sam Whitfield fixture identity
- Attendee: Alex Attendee fixture identity

## Scenario ledger

| Area | Scenario | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| Call for Papers | CFP-S1 | Blocked | `003`, `004`, `005` | Fresh event creation failed twice during prerequisite onboarding. |
| Call for Papers | CFP-S2 | Blocked | `004`, `005` | No isolated primary event exists. |
| Call for Papers | CFP-S3 | Blocked | `004`, `005` | No isolated primary event exists. |
| Call for Papers | CFP-S4 | Blocked | `004`, `005` | No isolated primary event exists. |
| Abstract Management | ABS-S1 | Blocked | `004`, `005` | No isolated primary event exists. |
| Abstract Management | ABS-S2 | Blocked | `004`, `005` | No isolated primary event exists. |
| Abstract Management | ABS-S3 | Blocked | `004`, `005` | No isolated primary event exists. |
| Speaker Management | SPK-S1 | Blocked | `004`, `005` | No isolated primary event exists. |
| Speaker Management | SPK-S2 | Blocked | `004`, `005` | No isolated primary event exists. |
| Speaker Management | SPK-S3 | Blocked | `004`, `005` | No isolated primary event exists. |
| Content Management | CNT-S1 | Blocked | `004`, `005` | No isolated primary event exists. |
| Content Management | CNT-S2 | Blocked | `004`, `005` | No isolated primary event exists. |
| Content Management | CNT-S3 | Blocked | `004`, `005` | No isolated primary event exists. |
| AI Agenda | AIA-S1 | Blocked | `004`, `005` | No isolated primary event exists. |
| AI Agenda | AIA-S2 | Blocked | `004`, `005` | No isolated primary event exists. |
| Public Widgets | EMB-S1 | Blocked | `004`, `005` | No isolated primary event exists. |
| Public Widgets | EMB-S2 | Blocked | `004`, `005` | No isolated primary event exists. |
| Public Widgets | EMB-S3 | Blocked | `004`, `005` | No isolated primary event exists. |
| Speaker CRM bonus | CRM-S1 | Blocked | `004`, `005` | Round cannot establish the evaluator's isolated event/workspace state. |
| Speaker CRM bonus | CRM-S2 | Blocked | `004`, `005` | Round cannot establish the evaluator's isolated event/workspace state. |

## Working observations

Record facts here during the round. Do not convert them into fixes until the scenario
ledger is complete.

1. The production sign-up path requires a magic-link inbox. The evaluator fixture
   provides identities but no usable inbox integration, so a browser-only agent cannot
   create the organizer account without external help.
2. The production login page exposes `Demo roles`. Dana Admin was used to keep the
   isolated run moving. This is a workaround and does not prove organizer-fixture auth.
3. Organization creation succeeded for a genuinely new workspace. No earlier event or
   seeded product state was selected after organization creation.
4. Event setup accepted the requested name, May 12–14, 2027 dates, and
   `America/Los_Angeles` timezone. The date/time picker required nine individual month
   advances from August 2026 for both start and end dates; this is tedious but usable.
5. `Finish setup` failed twice with the inline message `Could not create event`.
   The page remained on `/onboarding?new=1`; no event ID was produced.
6. Browser console capture returned an empty log array after both attempts. The product
   surface exposes no request ID or server error detail, so the failure is not diagnosable
   from the UI alone.

## Frozen issue register

The register is frozen for Round 01. No product change was made before freezing it.

### R1-001 — Fresh event creation fails during onboarding (critical)

- Reproduction: create a new organization, skip invites, enter a valid event name,
  conference type, May 12–14, 2027 dates, and `America/Los_Angeles`; select
  `Finish setup`.
- Observed: inline `Could not create event`; URL and form state remain unchanged.
- Reproducibility: 2/2 attempts.
- Impact: blocks CFP-S1 and every downstream required and bonus scenario because an
  isolated evaluation cannot legally reuse an older event.
- Evidence: `003-event-setup.png`, `004-first-event-create-failure.png`,
  `005-event-create-failure.png`.
- Diagnostic gap: no visible error code/request ID and no browser console message.

### R1-002 — Evaluator organizer identity cannot self-provision without inbox access (high)

- Observed: sign-up is magic-link-only while the evaluator fixtures supply identities,
  not a connected inbox.
- Workaround used: `Demo roles` → Dana Admin, solely to create a fresh organization.
- Impact: a browser evaluator can be blocked before reaching the product, or may need
  to use a non-fixture identity and then diverge from the prescribed scenario.
- Evidence: `001-production-login.png`.

### R1-003 — Event date entry is unnecessarily laborious for future events (friction)

- Observed: each date picker starts in August 2026 and requires nine separate next-month
  actions to reach May 2027. The start and end pickers repeat the traversal independently.
- Impact: no rubric failure by itself, but it is a clear agent trap and creates many
  failure opportunities in the very first scenario.
- Evidence: `003-event-setup.png` shows the final configured values.

## Score

- Required: 0 provable points; 86 items blocked by R1-001
- Bonus: 0 provable points; 12 items blocked by R1-001

This is a blocked-run score, not an estimate of capability. Isolation rules forbid
credit from any earlier workspace or evaluation.
