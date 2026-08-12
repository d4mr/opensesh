# Production Evaluation — Isolated Round 03

Status: **IN PROGRESS**  
Started: 2026-08-13  
Application: https://app.opensesh.io  
Production Worker version: `66c6ceba-a1ed-4a23-90ee-2fa8c5ca481e`  
Git revision: `f4bd513`  
Eval definition baseline: `killmysaas-evals@8109958`

## Isolation contract

This is a sealed evaluation run.

- No organization, event, submission, session, speaker, reviewer assignment, schedule, task, resource, communication, or CRM state from any previous evaluation may be reused or reconciled.
- No screenshot, network trace, console output, identifier, observation, score, or conclusion from V3 or any previous run may be used as Round 03 evidence.
- Only the published YAML specifications and fixture definitions are reusable. They describe the test; they are not evidence.
- Every persona uses a Round 03-specific email address. Every workspace and event is created during this run.
- Every evidence file is written directly into `docs/eval-evidence/2026-08-13-isolated-r3/` and its existence is verified immediately.
- If evidence is not captured in this run, it is marked missing. It is never backfilled from another run.
- Round 03 is scored only after all twenty scenarios finish. Product fixes, if any, happen after the run is frozen, followed by a new isolated run.

## Run identity

| Entity | Round 03 value | Created/verified |
| --- | --- | --- |
| Organizer | Jordan Alvarez — `sbek-organizer+r03-20260813-001@example.com` | Pending |
| Speaker 1 | Priya Nair — `sbek-speaker+r03-20260813-001@example.com` | Pending |
| Speaker 2 | Marcus Chen — `sbek-speaker2+r03-20260813-001@example.com` | Pending |
| Reviewer | Sam Whitfield — `sbek-reviewer+r03-20260813-001@example.com` | Pending |
| Attendee | Alex Attendee — `alex.attendee+r03-20260813-001@example.com` | Pending |
| Organization | `DevFlow Eval R03 20260813-001` | Pending |
| Event | `DevFlow Conf 2027` | Pending |
| Event slug / ID | Assigned during this run | Pending |

Names and scenario content follow the published fixture. Email suffixes and container identities are Round 03-specific so the run cannot inherit prior account or event state.

## Evidence protocol

For each material step, record:

1. Persona, scenario, step number, UTC/local timestamp, page URL, and visible result.
2. Screenshot path created in the Round 03 evidence directory.
3. Console errors and failed network requests observed at that step.
4. Product friction even when the rubric step succeeds.
5. Any prerequisite the fixture did not provide, including missing speaker-detail values.

No workaround is silent. If a scenario requires extra setup, an unexpected navigation, a retry, a persona impersonation, or data outside the fixture, it is recorded as friction and considered during scoring.

## Scenario ledger

| Scenario | Description | Status | Evidence / observations |
| --- | --- | --- | --- |
| CFP-S1 | Organizer builds and publishes the CFP | Pending | — |
| CFP-S2 | Speaker drafts, submits, and edits proposals | Pending | — |
| CFP-S3 | Organizer assigns a reviewer; reviewer scores | Pending | — |
| CFP-S4 | Organizer decides, notifies, hands off, and closes the CFP | Pending | — |
| ABS-S1 | Speaker seeds submissions with a co-author | Pending | — |
| ABS-S2 | Organizer configures rounds, pools, assignments, reminders | Pending | — |
| ABS-S3 | Reviewer scores blind; organizer checks aggregates and export | Pending | — |
| SPK-S1 | Organizer builds the speaker roster and assigns onboarding tasks | Pending | — |
| SPK-S2 | Speaker completes onboarding in the portal | Pending | — |
| SPK-S3 | Organizer tracks progress and sends bulk communications | Pending | — |
| CNT-S1 | Organizer sets up content collection | Pending | — |
| CNT-S2 | Speaker uploads and versions a deliverable | Pending | — |
| CNT-S3 | Organizer tracks, reviews, approves, and exports | Pending | — |
| AIA-S1 | Build agenda structure, place sessions, trigger and resolve conflicts | Pending | — |
| AIA-S2 | Auto-schedule assist and publish the agenda | Pending | — |
| EMB-S1 | Non-admin tour of the four browse widgets | Pending | — |
| EMB-S2 | Schedule itinerary browsing and personal-schedule building | Pending | — |
| EMB-S3 | Organizer embed generation, snippet retrieval and data consistency | Pending | — |
| CRM-S1 | Build and organize the speaker database | Pending | — |
| CRM-S2 | Source a speaker through the pipeline and reuse across events | Pending | — |

## Working log

### Run initialization

- Round 03 evidence directory created empty.
- Isolation invariant recorded before any Round 03 product action.
- No prior evaluation log or evidence directory was consulted to initialize or score this run.

## Issues discovered

None recorded yet.

## Score

Not scored while the run is in progress.
