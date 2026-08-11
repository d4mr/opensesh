# Production Manual Eval Run — 2026-08-11 V2

Durable, resumable working record for a fresh full production pass of the SessionBoard Eval Kit against OpenSesh after the new deployment. This run is independent of the earlier 2026-08-11 pass: old observations are regression targets, not accepted evidence.

## Run identity

- Status: **IN PROGRESS**
- Started: 2026-08-11 21:25:45 IST
- Last checkpoint: 2026-08-11 22:00 IST
- Target: <https://app.opensesh.io>
- Evaluator checkout: `/private/tmp/killmysaas-evals`
- Evaluator commit: `2b0f7956ab0c6f4868d41356e495b3a225badaab` (matches remote `main` at run start)
- Scope: all 20 scenarios and all 98 rubric items, including optional Speaker CRM
- Execution: direct browser walkthrough and manual grading; no evaluator LLM/API keys
- Evidence directory: [`docs/eval-evidence/2026-08-11-v2`](./eval-evidence/2026-08-11-v2)

## Safety and isolation

- Use the production UI only; do not inspect cookies, local storage, secrets, or production database rows.
- Use uniquely named V2 entities where creation is needed; do not delete or merge existing records.
- Form submissions, uploads, review decisions, reminders, and fixture communications are authorized by this requested read/write evaluation.
- Capture browser console evidence at the moment of any failure. Do not record credentials or sensitive request payloads.

## Evaluator inventory

- README declares 98 items: 86 required / 12 optional, across 20 scenarios.
- YAML count independently confirms 98 rubric items and 20 scenarios.
- Required headline weighting: CFP 20, Abstracts 20, Speakers 15, Content 15, AI Agenda 10, Public Widgets 20.
- Speaker CRM is reported separately as +10 optional.

## Canonical fixture coverage and known invention pressure

The evaluator has two overlapping speaker sources. `sample-data.json` is the richer identity fixture; `speakers.csv` is deliberately sparse. Defaults must preserve the richer record when a sparse import is used.

| Field / need | Priya in `sample-data.json` | Priya in `speakers.csv` | Marcus | Dana | Eval-agent risk / desired default |
|---|---|---|---|---|---|
| Name, email, title, company, bio | present | present, shorter bio | present | present only in CSV | must round-trip and CSV must not erase richer profile fields |
| Twitter, LinkedIn | present | absent | absent | absent | optional public/profile depth; absence should render gracefully, not block save |
| Dietary requirement, T-shirt size | present | absent | absent | absent | task/profile flow must have usable fields or clear optional defaults; evaluator should not need to invent for Marcus/Dana |
| Headshot | separate `headshot.png` fixture | absent | absent | absent | missing-photo fallback is explicitly evaluated; upload must work without native-picker assistance |
| Phone/mobile | absent | absent | absent | absent | product must treat as optional and display a clean empty state/default |
| Speaker source, region, areas of focus | absent | absent | absent | absent | CRM analytics mentions these but supplies no values; product should seed deterministic defaults or show honest empty analytics |
| CRM tag/custom field | scenario invents `AI Experts`, `Speaker Type=External`, or `AI` | absent | absent | absent | UI must make creation discoverable and not require undocumented prerequisites |
| Pipeline score/rationale | scenario suggests values only if offered | absent | absent | absent | optional depth; omission must not block enrollment |
| Travel/logistics | not supplied | absent | absent | absent | speaker-management journey probes logistics; optional fields should have discoverable empty state rather than silently not existing |
| Event role | organizer/reviewer roles supplied; speaker role is implicit | absent | implicit | implicit | participant role must default/map to Primary speaker and never block submit |
| Co-speaker relationship | only implied by scenarios | absent | Marcus used as co-speaker | absent | evaluator must be able to add Marcus using fixture email without inventing a relationship model |
| Session owner for Marcus | scenario invents `Lightning: Agents in Production Q&A` | absent | identity only | absent | direct accepted-session creation needs a safe path and deterministic defaults |

## Run entities

| Entity | Value | URL / ID | Status |
|---|---|---|---|
| Organizer | Jordan Alvarez (`jordan.organizer@sbek-test.example.com`) | pending | fixture account |
| Primary event | `DevFlow Conf 2027` | pending | seeded chain target |
| Isolation event | `Forward Summit 2028` | `/e/forward-summit-2028` | created, but creator immediately has no access |
| Speaker | Priya Raman (`priya.speaker@sbek-test.example.com`) | pending | fixture account/contact |
| Co-speaker | Marcus Okafor (`marcus.speaker@sbek-test.example.com`) | pending | fixture account/contact |
| Reviewer | Sam Whitfield (`sam.reviewer@sbek-test.example.com`) | pending | fixture account |

## Scenario checkpoints

Verdicts are `pending`, `pass`, `partial`, `fail`, or `blocked`. Every verdict must point to screenshot(s) and a written observation.

| # | Scenario | Persona | Status | Evidence / resume note |
|---:|---|---|---|---|
| 1 | CFP-S1 — build and publish CFP | organizer | partial | Builder/save/options/validation/public pass; condition and creator access fail |
| 2 | CFP-S2 — speaker draft, submit, edit | speaker | partial | Existing edit + round-trip + confirmation pass; fresh-start/save-draft path fails; profile-readiness regresses |
| 3 | CFP-S3 — reviewer assignment and scoring | organizer → reviewer | pass | Exact one-item blind queue, 4/4/Accept/comment persisted; assignment remains stale until reload |
| 4 | CFP-S4 — decisions, notifications, handoff, close | organizer → speaker | in progress | Accept/decline, sent state, and session handoff pass; close-date enforcement remains |
| 5 | ABS-S1 — submissions with co-author | speaker | pass | Three fixture submissions and Priya/Marcus role labels confirmed; fresh third already seeded per fallback |
| 6 | ABS-S2 — rounds, pools, assignments, reminders | organizer | partial | Two rounds/pools/scorecards/caps/two assignments pass; reminder has no visible confirmation; AI lacks key |
| 7 | ABS-S3 — blind scoring, aggregates, export | reviewer → organizer | partial | Exact queue, blind scope, 4/2 + 5/5, weighted aggregates, sorting, 2/2 pass; export produced no observable download |
| 8 | SPK-S1 — roster and onboarding tasks | organizer | pending | |
| 9 | SPK-S2 — speaker onboarding | speaker | pending | |
| 10 | SPK-S3 — progress and bulk communications | organizer | pending | |
| 11 | CNT-S1 — content collection setup | organizer | pending | |
| 12 | CNT-S2 — upload and version deliverable | speaker | pending | |
| 13 | CNT-S3 — track, approve, export | organizer | pending | |
| 14 | AIA-S1 — agenda and conflicts | organizer | pending | |
| 15 | AIA-S2 — auto-schedule and publish | organizer | pending | |
| 16 | EMB-S1 — public browse surfaces | attendee | pending | |
| 17 | EMB-S2 — itinerary | attendee | pending | |
| 18 | EMB-S3 — widget builder and consistency | organizer | pending | |
| 19 | CRM-S1 — directory and enrichment | organizer | pending | |
| 20 | CRM-S2 — pipeline and reuse | organizer | pending | |

## Evidence log

### Checkpoint 0 — evaluator and fixture freeze

- Remote `main` and local evaluator checkout both resolve to `2b0f7956ab0c6f4868d41356e495b3a225badaab`.
- Evaluator checkout has one pre-existing untracked `manual-results.prepared.json`; it is left untouched.
- New screenshot bundle and this V2 log were created before production mutations.
- Fixture gap/default-risk matrix recorded above so missing fields are not misclassified as product persistence failures.

### Checkpoint 1 — organizer entry, CFP builder, and second-event probe

- Organizer login succeeds cleanly and initially selects AI.Engineer; event switcher moves to seeded **DevFlow Conf 2027**.
- DevFlow overview is populated and the new program-lifecycle stepper accurately summarizes 3/7 stages.
- CFP builder now reports **Saved** with no browser console warning/error. This is a positive regression from the earlier permanently failing save.
- Added required `Key takeaway` and optional long-text `Workshop prerequisites`, conditional on Format = Workshop. The save progressed Unsaved → Saving → Saved and the configuration survived the builder's own re-renders.
- Participant collection now defaults to usable required First Name, Last Name, and Email fields with min/max speakers 1–1. This removes the earlier empty participant-step configuration.
- Existing form remains open, supports multiple drafts, redirects to portal, has a future Nov 30, 2026 close date, and a 4-submission limit.
- Created evaluator-exact second event **Forward Summit 2028** through the switcher. Creation succeeded and selected the event, but both Event Settings and Submissions immediately render **You do not have access** for the organizer who created it. Therefore multi-event creation exists, but creator membership/authorization is broken and event-scoping cannot be graded from the new event.
- Evidence: `003-devflow-overview.png` through `011-forward-summit-empty-submissions.png`.

### Checkpoint 2 — logged-out public CFP and hydration regression

- Logged-out public CFP loads with DevFlow branding, a visible Nov 30, 3:59 PM PST deadline, five-step progress, and the 4-submission limit.
- On the first Continue interaction, the client unexpectedly reconciled from Welcome to a blank **Step 5 of 5 · Review** state while the intended click reported no stable target. Clicking Submit then sent the user back to the Account step instead of accepting blank required fields.
- Browser console captured production React minified error `#418` from `assets/index-DCeXNtoU.js` at `2026-08-11T16:00:50.715Z`. This is the same hydration-class regression seen in the first run and plausibly explains the unstable step state.
- Because the form requires authentication before field validation, the exact required-field and dropdown checks continue under CFP-S2 as Priya.
- Evidence: `012-public-cfp-logged-out.png`, `013-cfp-blank-review-state.png`, `014-cfp-required-validation.png`.

### Checkpoint 3 — Priya submission journey

- Speaker password login succeeds and scopes Priya to three fixture submissions; portal has no admin navigation.
- Public CFP Account step recognizes Priya and lists the three submissions, but also renders stray **Event not found** text under otherwise valid DevFlow content.
- Starting a fourth submission shows a correctly populated form and all exact format options. However, every fresh-start attempt reaches **You cannot edit this submission** on Continue and no draft appears in the Account list after reload. No explicit Save draft control exists. This blocks a true fresh CFP-S2 chain.
- Required-field validation is clear and field-specific.
- The `Workshop prerequisites` field is visible before Format selection and remains visible after choosing `Talk (30 min)`, so the configured show-when rule is not enforced on the public renderer.
- Editing existing SESS-1 works after satisfying the newly-added required `Key takeaway`: the appended `Updated: now includes 2026 benchmark data.` persists, participant roles render correctly as **Primary speaker** Priya and **Co-presenter** Marcus, Review shows exact values, and Submit reaches **Submission received** with the configured success message and portal redirect.
- This is a positive regression for the prior participant-role blocker: the public step can now produce and persist the stable Primary speaker / Co-presenter roles.
- Important default-data observation: the builder's participant defaults collect only First Name, Last Name, and Email. The evaluator's canonical Priya fixture also supplies bio, LinkedIn, Twitter, dietary, and T-shirt size. The public submission cannot refresh the bio from fixture data because no Bio question is present.
- The same-session portal home changed from **Profile ready** before the submission update to **Add your bio** afterward; Profile now shows a blank Biography while dietary=Vegetarian, T-shirt=M, LinkedIn, Twitter, and headshot remain. This strongly indicates sparse participant answers can clear biography/profile readiness while preserving other fields.
- Evidence: `015-cfp-format-options.png` through `031-speaker-profile-after-cfp-submit.png`.

### Checkpoint 4 — reviewer assignment, scoring, decisions, and review depth

- Initial Review is a per-round blind plan with four distinct criteria: Originality 1–5 weight 2, Relevance 1–5 weight 1, Recommendation dropdown, and Comments long text. Final Review is a separate dated round with a different 1–10 Final Score + Comments scorecard and its own empty reviewer pool.
- Sam's reviewer pool membership is scoped only to Initial Review. Assignment UI exposes per-reviewer cap, track filter, bulk selection, and Auto-distribute.
- Assigning SESS-1 still leaves the organizer UI at `Assignments (0)` / `Unassigned` until reload; after reload it correctly becomes `Assignments (1)`. This is the same stale-cache regression from the first run.
- Sam's first queue contains exactly SESS-1 and no admin navigation. Blind detail contains no Priya, Marcus, company, or other reviewer scores. Recuse is visible. The abstract body, however, visibly includes literal `<p>...</p>` markup instead of rendered rich text.
- Sam submitted 4/4/Accept + canonical comment, then after the second assignment changed SESS-1 to 4/2/Accept and submitted SESS-2 as 5/5/Accept with the exact short comment. Both stored and queue finished 0 pending / 2 completed.
- Organizer results show weighted aggregates exactly: SESS-2 = 5.00 and SESS-1 = 3.33, with full human-review detail. Descending and ascending sorts produce the expected order. Accepted SESS-1 remains in Results after disposition, fixing prior OS-014.
- Progress moves from 1/2 to 2/2 and 100%. Reminder action executes, but after selection/send there is no toast, count, log entry, or other visible confirmation.
- CSV export button is present and activates, but no browser download event or visible success state occurs within 5 seconds. Treat payload export as unverified, not a pass.
- Accepting SESS-1 and declining SESS-2 each open a personalized email preview, send successfully, update status immediately, and show `Sent`. Accepted SESS-1 appears in Sessions with title, track, format, Priya, and Marcus intact. Sessions now also exposes a direct `Add session` action.
- Evidence: `032-evaluation-overview.png` through `061-review-progress-complete.png`.

## Issue and default-gap register

Add every observed issue here even when its rubric item passes.

| ID | Severity | Kind | Surface | Summary | Evidence | Regression? | Status |
|---|---|---|---|---|---|---|---|
| V2-001 | P0 | Product defect | Multi-event / authorization | Creating `Forward Summit 2028` succeeds but the creator immediately sees `You do not have access` on settings and submissions. | `010-forward-summit-created.png`, `011-forward-summit-empty-submissions.png` | related to prior onboarding/access defects | confirmed |
| V2-002 | P1 | Product defect | Public CFP runtime | Logged-out form hydration is unstable: Welcome reconciled to a blank Review step and console emitted React #418. | `012-public-cfp-logged-out.png`–`014-cfp-required-validation.png` + console timestamp | prior OS-011 | confirmed |
| V2-003 | P1 | Product defect | CFP conditional logic | `Workshop prerequisites` renders with no Format and still renders for `Talk (30 min)` despite a saved Format=Workshop condition. | `015-cfp-format-options.png`, `016-cfp-workshop-field-hidden-for-talk.png` | new/old conditional logic unverified | confirmed |
| V2-004 | P0 | Product defect | CFP fresh submission | `Start a submission` cannot persist/continue a new proposal; it returns `You cannot edit this submission`, and no draft is listed after reload. | `019-cfp-title-only-draft.png`, `020-cfp-filled-proposal.png`, `022-cfp-draft-save-result.png` | replaces prior role blocker with a different fresh-start blocker | confirmed |
| V2-005 | P1 | Product defect | Speaker profile round-trip | Submission update using sparse participant questions changes portal home from `Profile ready` to `Add your bio`; Biography becomes blank while other profile fields remain. | `030-speaker-portal-after-submit.png`, `031-speaker-profile-after-cfp-submit.png`; pre-submit portal snapshot in login evidence | related to prior sparse CSV erasure | confirmed |
| V2-006 | P2 | Fixture/default gap | CFP participant defaults | Default participant questions omit Biography even though the canonical fixture supplies it and the rubric expects speaker bio collection. | `008-cfp-participant-questions.png`, `031-speaker-profile-after-cfp-submit.png` | prior builder depth gap | confirmed |
| V2-007 | P3 | Product defect | Public CFP copy | Valid DevFlow Account and Proposal steps render stray `Event not found` text at the bottom. | `018-cfp-draft-account-state.png`, `019-cfp-title-only-draft.png` | new | confirmed |
| V2-008 | P2 | Product defect | Review assignments | Assignment succeeds in storage but the organizer remains at `Assignments (0)` / Unassigned until reload. | `035-review-assignment-immediate.png`, `036-review-assignment-after-reload.png` | prior OS-012 | confirmed |
| V2-009 | P3 | Product defect | Reviewer content rendering | Blind reviewer detail shows literal `<p>…</p>` markup for the rich-text abstract. | `038-reviewer-queue.png`, `054-reviewer-two-item-queue.png` | new | confirmed |
| V2-010 | P2 | Product defect | Reviewer reminders | Reminder action has no visible sent/queued confirmation or history after execution. | `049-review-progress-before-reminder.png`, `050-review-reminder-confirmation.png` | prior OS-015 | confirmed |
| V2-011 | P2 | Product/eval uncertainty | Review export | `Export CSV` activates, but no download event or visible confirmation is observable within 5 seconds. | `060-review-export-triggered.png` | related to prior export limitation | confirmed UI ambiguity; payload unverified |
| V2-012 | P3 | Environment/default gap | AI first-pass | AI review is visibly disabled with `Anthropic key not configured`; human review remains complete. | `042-review-results.png`, `058-final-review-results-desc.png` | prior OS-017 | confirmed |

## Rubric scoring

Populate after all evidence is gathered.

| Area | Area weight | Items | Score |
|---|---:|---:|---:|
| Call for Papers | 20 | 18 | pending |
| Abstract Management | 20 | 14 | pending |
| Speaker Management | 15 | 16 | pending |
| Content Management | 15 | 14 | pending |
| AI Agenda | 10 | 8 | pending |
| Public Widgets | 20 | 16 | pending |
| **Required headline** | **100** | **86** | pending |
| Speaker CRM (optional) | +10 | 12 | pending |

## Resume protocol

1. Read this file and continue from the first `pending` scenario.
2. Reuse the same evaluator commit and production accounts unless the log explicitly changes them.
3. Save screenshots immediately under `docs/eval-evidence/2026-08-11-v2/` with a monotonic numeric prefix.
4. Update the scenario row and evidence log immediately after each meaningful checkpoint.
5. Record product failures, fixture/default gaps, evaluator limitations, and process deviations separately.
