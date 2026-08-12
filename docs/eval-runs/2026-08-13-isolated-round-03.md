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
| Organizer | Jordan Alvarez — `sbek-organizer+r03-20260813-001@example.com` | Created in Round 03 |
| Speaker 1 | Priya Raman — `sbek-speaker+r03-20260813-001@example.com` | Created in Round 03 |
| Speaker 2 | Marcus Chen — `sbek-speaker2+r03-20260813-001@example.com` | Pending |
| Reviewer | Sam Whitfield — `sbek-reviewer+r03-20260813-001@example.com` | Pending |
| Attendee | Alex Attendee — `alex.attendee+r03-20260813-001@example.com` | Pending |
| Organization | `DevFlow Eval R03 20260813-001` | Created in Round 03 |
| Event | `DevFlow Conf 2027` | Created in Round 03 |
| Event slug / ID | `devflow-conf-2027-3` / form `O37jjey2KkezEeX6Rb4xd` | Created in Round 03 |

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
| CFP-S1 | Organizer builds and publishes the CFP | Complete | `001`–`018`; public form `https://app.opensesh.io/submit/devflow-conf-2027-3/O37jjey2KkezEeX6Rb4xd` |
| CFP-S2 | Speaker drafts, submits, and edits proposals | Complete | `019`–`032`; new submissions `SESS-1` and `SESS-2` |
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

### CFP-S1 — Organizer builds and publishes the CFP

- Created organizer Jordan Alvarez, organization `DevFlow Eval R03 20260813-001`, and `DevFlow Conf 2027` entirely within Round 03.
- Set event dates to May 12–14, 2027, timezone `America/Los_Angeles`, location `Moscone West, San Francisco, CA`, fixture tagline, and fixture description.
- Created exactly three fixture tracks and five fixture formats in the fresh event library.
- Created form `O37jjey2KkezEeX6Rb4xd` with required Title, Description, Track, Format, and Key takeaway; optional Audience level; participant first/last/email; Speaker bio; and co-speaker capacity up to five.
- Configured `Workshop prerequisites` as long text shown only when Format is Workshop.
- Kept the form open and set the close date to Apr 30, 2027, 9:00 AM PDT. Confirmation email is enabled with name/title/portal-link placeholders.
- Public CFP URL: `https://app.opensesh.io/submit/devflow-conf-2027-3/O37jjey2KkezEeX6Rb4xd`.
- Logged out and verified the public event name, deadline, submission limit, welcome content, and account gate. Because fields require sign-in, dropdown, conditional, and validation checks are deferred exactly as permitted by the spec to CFP-S2.
- Signed back in, created `Forward Summit 2028`, and verified its submissions area is empty and explicitly scoped to that event.
- No console errors or warnings appeared during the scenario.
- Evidence: `001-cfp-s1-clean-signup.png` through `018-cfp-s1-second-event-empty-submissions.png`. Every file was written and size-verified in this run.

### CFP-S2 — Speaker drafts, submits, and edits proposals

- Created the Round 03-only speaker account `sbek-speaker+r03-20260813-001@example.com` from the public CFP.
- Entered only the first proposal title; the form displayed `Saving…` then `Saved`. Navigated back to Account and verified `SESS-1 · draft · Resume` with the title preserved.
- Resumed the draft and captured inline errors for Description, Track, Format, and Key takeaway.
- Verified all three tracks, all five formatted session types, and all three Audience level choices in their open dropdowns.
- Verified Workshop selects and displays Workshop prerequisites without a reload, then Talk hides the field without a reload.
- Completed and submitted `SESS-1`, including the fixture abstract, Platform & Infra, Talk, Intermediate, fixture bio, and required takeaway. Confirmation exact visible text: `<p>Thank you. Your submission has been received.</p>` and `Confirmation sent to sbek-speaker+r03-20260813-001@example.com.`
- Portal listed `SESS-1` with status `pending`. Edited the abstract to append `Updated: now includes 2026 benchmark data.`, reloaded the full page, and verified the sentence persisted.
- Completed and submitted `SESS-2` (`Your AI Pair Programmer Is Lying to You: Verification Patterns That Scale`) with AI Engineering, Talk, Advanced, the fixture abstract, and required takeaway.
- Portal dashboard showed exactly two Round 03 proposals, both `pending`.
- No console errors or warnings appeared during the scenario.
- Evidence: `019-cfp-s2-speaker-signup.png` through `032-cfp-s2-dashboard-two-submissions.png`. Every file was written and size-verified in this run.

## Issues discovered

1. **Timezone selection shifts previously chosen calendar dates during onboarding.** The event was initially set to May 12–14 while the default timezone was Asia/Calcutta. Changing the timezone to America/Los_Angeles displayed May 11–13 because the saved instants were preserved. The user-facing onboarding flow therefore requires choosing timezone before dates or correcting both dates. The settings page states that timezone changes preserve UTC instants, but the ordering makes this easy to miss.
2. **Rapid sequential library additions expose stale UI state.** After saving `Developer Experience`, the immediate snapshot showed only two tracks, then the row appeared while a retry form was already open. The retry had to be cancelled to avoid a duplicate. A similar delayed count occurred for Panel: four formats were shown immediately, five after a later wait. There were no console warnings. The product eventually persisted correctly, but an evaluator can reasonably retry and create duplicates.
3. **Public form cannot be field-tested anonymously.** This is allowed by the eval, but it moves dropdown, conditional, and required-field validation evidence into the speaker scenario and adds an account transition before the first data-entry page.
4. **Confirmation rich text is rendered as escaped markup.** The confirmation page visibly says `<p>Thank you. Your submission has been received.</p>` rather than rendering the paragraph. Confirmation delivery text is otherwise explicit and correct.
5. **Autosave/navigation has an ambiguous intermediate state.** Continue/Review/Submit clicks frequently left the current page visible with a `Checking…` or saving state before navigation completed. The action did complete, but an evaluator can interpret the first click as ineffective and click again. No duplicate submissions resulted in this scenario.

## Score

Not scored while the run is in progress.
