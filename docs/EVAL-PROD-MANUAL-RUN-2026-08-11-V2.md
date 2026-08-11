# Production Manual Eval Run — 2026-08-11 V2

Durable, resumable working record for a fresh full production pass of the SessionBoard Eval Kit against OpenSesh after the new deployment. This run is independent of the earlier 2026-08-11 pass: old observations are regression targets, not accepted evidence.

## Run identity

- Status: **COMPLETE — strict manual evidence pass**
- Started: 2026-08-11 21:25:45 IST
- Completed: 2026-08-11 (production state captured through screenshot 156)
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
| Organizer | Jordan Alvarez (`jordan.organizer@sbek-test.example.com`) | production account | fixture account; full organizer chain completed |
| Primary event | `DevFlow Conf 2027` | `/e/devflow-conf-2027` | seeded chain target; agenda published |
| Isolation event | `Forward Summit 2028` | `/e/forward-summit-2028` | created, but creator immediately has no access |
| Speaker | Priya Raman (`priya.speaker@sbek-test.example.com`) | portal + event contact | confirmed; profile approved; 2/5 tasks complete |
| Co-speaker | Marcus Okafor (`marcus.speaker@sbek-test.example.com`) | CRM + event contact | accepted speaker; CRM pipeline won |
| Imported speaker fixture | Dana Kowalski (`dana.speaker@sbek-test.example.com`) | CRM + event contact | first created manually; later validated through the real CSV importer |
| Reviewer | Sam Whitfield (`sam.reviewer@sbek-test.example.com`) | reviewer portal | 2/2 assigned reviews complete |

## Scenario checkpoints

Verdicts are `pending`, `pass`, `partial`, `fail`, or `blocked`. Every verdict must point to screenshot(s) and a written observation.

| # | Scenario | Persona | Status | Evidence / resume note |
|---:|---|---|---|---|
| 1 | CFP-S1 — build and publish CFP | organizer | partial | Builder/save/options/validation/public pass; condition and creator access fail |
| 2 | CFP-S2 — speaker draft, submit, edit | speaker | partial | Existing edit + round-trip + confirmation pass; fresh-start/save-draft path fails; profile-readiness regresses |
| 3 | CFP-S3 — reviewer assignment and scoring | organizer → reviewer | pass | Exact one-item blind queue, 4/4/Accept/comment persisted; assignment remains stale until reload |
| 4 | CFP-S4 — decisions, notifications, handoff, close | organizer → speaker | partial | Accept/decline, sent state, and session handoff pass; close-date enforcement not exercised |
| 5 | ABS-S1 — submissions with co-author | speaker | pass | Three fixture submissions and Priya/Marcus role labels confirmed; fresh third already seeded per fallback |
| 6 | ABS-S2 — rounds, pools, assignments, reminders | organizer | partial | Two rounds/pools/scorecards/caps/two assignments pass; reminder has no visible confirmation; AI lacks key |
| 7 | ABS-S3 — blind scoring, aggregates, export | reviewer → organizer | partial | Exact queue, blind scope, 4/2 + 5/5, weighted aggregates, sorting, 2/2 pass; export produced no observable download |
| 8 | SPK-S1 — roster and onboarding tasks | organizer | partial | CSV mapping/import, roster, tasks, deliverables, invite, search/edit/status/travel pass; file deliverables remain unverified |
| 9 | SPK-S2 — speaker onboarding | speaker | partial | Scoped portal, task completion, bio/profile workflow, and file constraints pass; actual uploads unverified |
| 10 | SPK-S3 — progress and bulk communications | organizer | partial | Progress, reminders, campaign, status, logistics pass; file/headshot completion unavailable |
| 11 | CNT-S1 — content collection setup | organizer | pass | Session-scoped presentation requirement and speaker task linkage persisted |
| 12 | CNT-S2 — upload and version deliverable | speaker | blocked | Correct upload constraints exposed; browser controller could not attach a local file |
| 13 | CNT-S3 — track, approve, export | organizer | partial | Version history/restore, tracking, reminders and library pass; upload/ZIP unverified and publication gate fails |
| 14 | AIA-S1 — agenda and conflicts | organizer | pass | Rooms, dates, placements, exact room and speaker conflicts, and resolution verified |
| 15 | AIA-S2 — auto-schedule and publish | organizer | pass | Draft generation, rationale, selective acceptance, conflict-free publish, and persistence verified |
| 16 | EMB-S1 — public browse surfaces | attendee | pass | Five anonymous surfaces, search/filter/detail, consistent published data, graceful image fallbacks |
| 17 | EMB-S2 — itinerary | attendee | pass | Add/remove, My Schedule, reload persistence, print and ICS affordances verified |
| 18 | EMB-S3 — widget builder and consistency | organizer | pass | Five view types, live preview, filters/theme, share URL, iframe, JSON and ICS endpoints verified |
| 19 | CRM-S1 — directory and enrichment | organizer | partial | CSV import, search/filter/segment/profile/tag/note/duplicate safeguards/event link pass; destructive duplicate merge intentionally not executed |
| 20 | CRM-S2 — pipeline and reuse | organizer | pass | Enrollment, moves, history, notes, analytics, personalized bulk outreach and history verified |

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

### Checkpoint 5 — speaker roster, tasks, portal, profile review, and communications

- The organizer created and persisted the three requested general tasks for Priya and Marcus: **Confirm participation** and **Complete bio and profile** due Apr 1, plus **Sign speaker release form** due Apr 15. The template/assignment views show both speakers.
- Marcus's evaluator-created lightning session was accepted. A session-scoped **Upload Session Presentation** requirement persisted with due date May 1 at 9:00 AM, extensions `.pdf,.key,.pptx`, and 25 MB maximum. A separate **Upload Final Headshot (print quality)** request had to be linked to a task before it reached speakers.
- Priya's portal remains role-scoped and `/admin` redirects her back to the portal. It exposed five tasks with exact due dates and constraints. Two non-file tasks were completed and persisted as 2/5.
- Priya entered the canonical long biography with sentinel `SBEK-PORTAL-BIO-01`. The organizer then saw **Awaiting your review** and approved it; the approved bio subsequently appeared on public detail. The underlying pending-version workflow is useful but the speaker is not clearly told that a reload may continue to show the old approved value until an organizer approves.
- Organizer task progress synchronized to Priya 2 completed / 2 outstanding and Marcus 0 / 4. Bulk reminders now give a clear `2 reminders recorded in demo mode` confirmation and queued state, a positive regression from reviewer reminders.
- Priya's invite recorded an email-history entry. Workflow status became **Confirmed** and persisted. Travel notes persisted exactly: `Arrival May 11, aisle seat; dietary: Vegetarian`.
- A two-recipient welcome campaign rendered resolved merge-token previews and recorded a sent campaign with history.
- Evidence: `062-speaker-roster-before-import.png`, `064-task-confirm-participation-form.png` through `088-speaker-campaign-sent.png`.

### Checkpoint 6 — agenda construction, deliberate conflicts, AI draft, and publish

- The builder exposed the three event days, a time grid, four seeded rooms, an unscheduled pool, and inline room creation. **Overflow Room** persisted.
- SESS-1 was placed on May 12 at 10:00 AM in Room 2A. Placing Marcus's SESS-4 at the same time produced the exact speaker double-booking with both session codes, Marcus's name, window, and explanation.
- Moving SESS-4 to May 12 at 2:00 PM cleared that conflict live. Deliberately placing SESS-3 over SESS-1 produced both a room-overlap and Priya double-booking, then moving SESS-3 to May 13 at 11:00 AM cleared both.
- Important fixture/model mismatch: both 10-minute lightning sessions produced `Duration must use 15-minute increments`, an empty duration selection, and could not save until manually overridden to 15 minutes.
- The AI agenda draft proposed SESS-2 at the earliest conflict-free slot with a visible rationale. Accepting the single change reduced the unscheduled count to zero. The final conflict-free agenda was published and remained published after reload.
- Final schedule: SESS-2 May 12 8:00–8:30 Main Stage; SESS-1 May 12 10:00–10:30 Room 2A; SESS-4 May 12 2:00–2:15 Room 2B; SESS-3 May 13 11:00–11:15 Room 2B.
- Evidence: `089-agenda-initial.png` through `104-agenda-published.png`.

### Checkpoint 7 — widget builder and all anonymous attendee surfaces

- The widget builder exposed exactly five view types: Sessions, Speaker list, Speaker gallery, Agenda, and Itinerary. It also exposed track/format/day/tag filters, theme, 12/24-hour time, color, field visibility, custom CSS hooks, enablement, and a live iframe preview.
- **Evaluator Sessions List** generated a stable anonymous share URL, copyable iframe, JSON feed, and ICS feed. The embed rendered four published sessions with titles, dates, times, rooms, speakers, job titles, companies, tracks, formats, and descriptions.
- Logged out, all five public surfaces remained available. Session search worked by title and speaker, and track filtering reduced the exact count. Session and speaker detail surfaces matched the published agenda.
- Speaker list sorts Marcus before Priya and shows title/company/session counts. Gallery and list use clear initials fallbacks because fixture headshots are absent. Priya's approved biography and three sessions appear publicly; Marcus's public detail says **Bio not provided** despite a rich canonical CRM biography.
- Agenda days are chronological and session details contain the exact time range, room, format, track, description, and speaker. May 14 is omitted because it has no sessions.
- Anonymous itinerary add/remove works. My Schedule moved from two sessions to one, and the two-session selection survived reload. Print and Export ICS are visible; the ICS click produced no observable browser download/confirmation, so the affordance passes but payload delivery is not independently verified.
- Evidence: `105-widgets-admin.png` through `129-my-schedule-one-after-remove.png`.

### Checkpoint 8 — Speaker CRM directory, enrichment, pipeline, outreach, and reuse

- The organization CRM began with 28 contacts and offered search, company/title/tag filters, saved dynamic segments, duplicate review, Directory/Pipeline/Segments/Overview tabs, and event history. Priya search returned two same-name records; Latticework filtering returned exactly one record.
- A dynamic **AI Experts** segment persisted. Marcus's rich canonical biography, company, title and event/session links existed in CRM even though his event/public biography was empty. Tag `AI` and the exact evaluator note persisted after reload.
- Marcus enrolled in the pipeline at Prospect with score 85/rationale, then moved Prospect → Contacted → Confirmed. Reload preserved the won column, timestamped transitions, card note, and follow-up activity.
- Overview exposed contact/event totals, open/won/lost counts, profile completeness, pipeline distribution, top companies, and tags.
- Bulk outreach to 28 contacts supported `{speaker_name}` and `{talk_title}` with per-recipient previews and a sensible `your proposed topic` fallback. The campaign sent and appeared in history. The default-enabled **Also add recipients to event** checkbox was explicitly turned off to avoid adding all 28 contacts to DevFlow.
- Duplicate review clearly compared the two Priya records and required both primary selection and an irreversible-action checkbox. No merge was executed because the records use different emails and the earlier safety constraint forbids an unnecessary destructive mutation.
- Dana Kowalski was not present in the seeded directory. In the original chain her exact CSV fixture data was created manually and linked to DevFlow; the post-pass native-picker recheck below subsequently validated the real importer. Dana carried title/company but had only 1/4 profile readiness.
- Evidence: `130-crm-directory-initial.png` through `149-event-roster-three-speakers.png`.

### Checkpoint 9 — content revisions, restoration, library, and publication-gate audit

- SESS-1 was edited twice. The first revision added a live-demo sentence; the second added `Attendees should bring a laptop.`. After reload, two attributed versions appeared.
- Restoring the earlier snapshot created a third attributed version while retaining history. The restored content kept the live-demo addition and removed the laptop sentence. The session title was then restored to its exact original and approved.
- Immediately after save, the header/submission answers updated while the session-content block and history stayed stale until reload. This is a cache/feedback defect, not data loss.
- The file library contained seven outstanding records: five session-speaker presentation assignments and two headshot assignments. The presentation requirement expanded dynamically as additional sessions were accepted; Marcus correctly has two distinct session assignments.
- The content dashboard lists four accepted sessions, but its visible status is only the submission decision `accepted`; it does not distinguish content approval, and all accepted sessions appeared publicly. Therefore the content-approval publication gate is not functioning as a meaningful gate.
- Evidence: `150-session-content-edit-1.png` through `156-content-dashboard.png`.

### Checkpoint 10 — file-upload automation boundary

- The product exposes a real `input[type=file]` and the correct file constraints. The in-app browser controller used for this run has no `setInputFiles` operation and its file-chooser wait repeatedly timed out. The fallback browser-automation CLI is not installed, and local full-computer control is unavailable in this environment.
- Consequently, speaker headshot upload, slide upload/version/comment, ZIP payload, review CSV payload, and ICS payload remain **unverified**, not automatically product failures. CSV import was later verified using ordinary Chrome plus the native macOS picker. No dependency installation, database edit, or invasive workaround was used.
- This matters for the real evaluation: the evaluator harness should use Playwright's `locator.setInputFiles(...)` directly. The product should keep a standard, reachable file input and give explicit success/failure feedback after every upload or export.

### Checkpoint 11 — native-picker retry in ordinary Chrome

- Computer control cannot target the Codex desktop app, so its attached native Open sheet is inaccessible even though it resembles Finder. The same production flow was opened in ordinary Chrome, where computer control is allowed.
- Chrome's native picker was operated with macOS **Go to Folder** and `/private/tmp/killmysaas-evals/fixtures/speakers.csv`. The importer mapped `name`, `email`, `title`, `company`, and `bio`; previewed Priya and Marcus as **Update**, Dana as **Create**; and reported `3 parsed · 2 matching · 0 errors`.
- Import completed with exact confirmation: **Created 1 · Updated 2 · Skipped 0**. The roster became three speakers and Dana showed Engineering Manager · Substrate with 1/4 readiness.
- Crucially, sparse CSV updates did **not** clear Priya's richer profile in this recheck: Bio remained Present, Dietary remained Vegetarian, T-shirt remained M, and profile approval remained Approved. This is a positive regression against the earlier sparse-profile concern and narrows V2-005 to the CFP participant-update path.
- The current production database visible in both Chrome and the in-app browser had been re-baselined by this retry: four submissions were Pending, zero sessions were accepted/scheduled, no speaker tasks existed, and the agenda was Draft. Treat screenshots 157–159 as a post-pass upload recheck, not continuation of the mutated state in screenshots 001–156.
- Evidence: `157-csv-import-complete.png`, `158-csv-import-roster.png`, `159-csv-preserves-priya-profile.png`.

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
| V2-013 | P3 | Evaluation tooling boundary | File inputs/exports | The in-app browser's chooser event times out and computer control cannot target its host app. Ordinary Chrome + macOS native picker works; CSV import is verified. Remaining uploads/downloads are still unverified rather than failed. | `076-slide-upload-constraints.png`, `155-file-library-no-uploads.png`, `157-csv-import-complete.png` | narrowed process limitation | workaround validated |
| V2-014 | P2 | UX friction | Speaker profile approval | Speaker profile edits create a pending version, but the speaker gets no strong `Saved — awaiting organizer approval` explanation and can see the old approved value after reload. | `075-priya-profile-bio-filled.png`, `082-priya-organizer-spotlight.png`, `083-priya-profile-approved.png` | new | confirmed |
| V2-015 | P3 | Product defect | Profile comparison rendering | Organizer's pending biography comparison displayed literal `<p>…</p>` markup instead of rendered or plain rich text. | `082-priya-organizer-spotlight.png` | same rendering class as V2-009 | confirmed |
| V2-016 | P2 | Fixture/cardinality risk | Session deliverables | One presentation requirement produced three assignments with SESS-1 + SESS-4, then five after SESS-2/3 were accepted. This is logically per session-speaker, but an eval agent expecting exactly two speaker tasks may misread the count. | `071-deliverables-dashboard.png`, `155-file-library-no-uploads.png` | new | confirmed behavior |
| V2-017 | P2 | UX prerequisite | Headshot deliverable | Creating a requested-file definition alone leaves `Not assigned to any task yet`; the organizer must separately click **Create task** before speakers receive it. | `070-headshot-request-form.png`, `071-deliverables-dashboard.png` | new | confirmed |
| V2-018 | P1 | Product/fixture mismatch | Agenda duration | Seeded 10-minute lightning sessions are incompatible with the agenda's 15-minute grid; duration is blank and save is blocked until the organizer overrides to 15 minutes. | `094-agenda-speaker-conflict.png`, `098-agenda-room-overlap-test.png` | new | confirmed |
| V2-019 | P2 | Product defect | Agenda detail cache | After scheduling or moving a session, the grid and conflict count update but the still-open session detail continues to show the prior time or `Unscheduled`. | `093-agenda-ci-room2a-10.png`, `097-agenda-conflict-resolved.png` | new | confirmed |
| V2-020 | P3 | Public presentation gap | Agenda day navigation | The event has three configured days, but the public agenda exposes only May 12 and May 13 because May 14 is empty. This is defensible but can look like a missing event day. | `122-public-agenda-day1.png`, `123-public-agenda-day2.png` | new | confirmed behavior |
| V2-021 | P2 | Product/eval uncertainty | Itinerary export | Export ICS has no visible success state and emitted no observable download event in this controller. | `125-public-itinerary.png`–`129-my-schedule-one-after-remove.png` | related to V2-011 | payload unverified |
| V2-022 | P1 | Data-model/default gap | CRM ↔ event speaker profile | Marcus has the canonical rich bio in organization CRM but the linked event/public speaker says **Bio not provided**. Event linkage does not hydrate a sparse event profile from richer CRM identity data. | `121-gallery-speaker-detail.png`, `134-crm-marcus-profile.png` | same sparse-data class as prior import issue | confirmed |
| V2-023 | P1 | Risky default | CRM campaign | **Also add recipients to event** is enabled by default; sending a broad CRM campaign could silently add all 28 recipients to the event unless the organizer notices and opts out. | `143-crm-campaign-preview.png` | new | confirmed |
| V2-024 | P0 | Product defect | Content approval/publication | Content dashboard conflates accepted decision with approved content, and every accepted session is public regardless of content approval. The approval state is not an effective publication gate. | `109-public-sessions-anonymous.png`, `156-content-dashboard.png` | prior content-gate weakness | confirmed |
| V2-025 | P2 | Product defect | Session content mutation cache | After save/approve/restore, header values update but content block and version history remain stale until reload. | `150-session-content-edit-1.png`–`154-session-title-restored-approved.png` | new | confirmed |
| V2-026 | P2 | Fixture/default gap | Dana speaker detail | Dana is absent from seeded CRM and supplied only by sparse CSV. Real import succeeds, but she has name/email/title/company/bio only and still yields 1/4 readiness because social/dietary/shirt/headshot are unspecified. | `148-crm-dana-contact-manual.png`, `149-event-roster-three-speakers.png`, `158-csv-import-roster.png` | known evaluator invention pressure | confirmed |
| V2-027 | P2 | Product defect | CRM event-link mutation feedback | Adding Dana to DevFlow disabled the action but gave no immediate success state; the event relationship appeared only after reload. | `148-crm-dana-contact-manual.png`, `149-event-roster-three-speakers.png` | same stale-cache family as V2-008/V2-025 | confirmed |
| V2-028 | P3 | Fixture gap handled well | Public speaker images | No tested event speaker had a usable headshot, so image-rich gallery scoring relies entirely on initials. List/gallery/detail degrade cleanly and remain usable. | `116-public-speakers-list.png`, `119-public-speaker-gallery.png`, `121-gallery-speaker-detail.png` | prior upload limitation | confirmed graceful fallback |
| V2-029 | P3 | Positive regression | Task reminders | Speaker bulk reminders now show an exact queued count and row state, unlike reviewer reminders. | `078-organizer-task-progress-sync.png`, `079-bulk-task-reminders.png` | improved | confirmed |
| V2-030 | P3 | Positive fallback | CRM campaign tokens | Contacts without a talk resolve `{talk_title}` to `your proposed topic`, preserving readable bulk email instead of leaking an empty token. | `143-crm-campaign-preview.png` | new | confirmed |

## Strict manual rubric scoring

This is intentionally conservative. Unverified file payloads receive no credit even where the product exposed the correct control. Partial credit is used only where the majority of a weighted criterion was directly observed. The official evaluator may score higher when Playwright can attach files and capture downloads.

| Area | Area weight | Items | Score |
|---|---:|---:|---:|
| Call for Papers | 20 | 18 | **15.0 / 20** (28.5 / 38 item weight) |
| Abstract Management | 20 | 14 | **18.1 / 20** (24.5 / 27) |
| Speaker Management | 15 | 16 | **13.4 / 15** (29.5 / 33) |
| Content Management | 15 | 14 | **8.8 / 15** (17 / 29) |
| AI Agenda | 10 | 8 | **10.0 / 10** (18 / 18) |
| Public Widgets | 20 | 16 | **19.7 / 20** (34.5 / 35) |
| **Required headline** | **100** | **86** | **85.0 / 100** |
| Speaker CRM (optional) | +10 | 12 | **9.7 / 10** (18.5 / 19) |

### Item-level disposition

- **CFP:** pass `01,03,06,08–15,17`; partial `05`; fail `02,07,18`; unverified `04,16`.
- **Abstracts:** pass `01–08,10–12`; partial `09`; unverified `13`; environment-disabled `14`.
- **Speakers:** pass `01–07,09,11–15`; partial `08,16`; unverified `10`.
- **Content:** pass `01,03,06,08–11`; partial `02,07,13`; fail `14`; unverified `04,05,12`.
- **AI Agenda:** pass `01–08`.
- **Public Widgets:** pass `01–03,05–12,14–16`; partial `04,13`.
- **Speaker CRM:** pass `01–05,07–12`; partial `06`.

## Fixture and default hardening plan

These changes reduce evaluator invention pressure without pre-solving the behaviors the rubric is intended to test.

1. **Make identity enrichment non-destructive.** Missing participant/CSV fields must mean “no update,” never “clear existing value.” On event linkage, copy canonical CRM values into only-empty event fields; never overwrite non-empty event overrides.
2. **Seed complete canonical identities.** Priya and Marcus should start with fixture bio/title/company and explicit optional-field defaults. Dana should be importable with name/email/title/company/bio. Use `dietary = None declared`, `shirt size = Not provided`, empty social links, and `headshot = null`; do not invent sensitive or personal facts.
3. **Default CFP participant questions safely.** Include Biography by default, or guarantee that absent speaker-profile questions cannot mutate profile data. Keep mobile, social, dietary and shirt optional and visibly optional.
4. **Normalize lightning durations.** Either support 10-minute agenda increments end-to-end or map a 10-minute lightning format to an explicit schedulable 15-minute slot. Never render a blank required duration for seeded data.
5. **Clarify assignment cardinality.** Label presentation work as `5 session-speaker assignments across 4 sessions / 2 speakers`, not merely a speaker task count. This prevents an evaluator from treating Marcus's two talks as duplicate tasks.
6. **Make requested files atomic.** Creating a headshot/presentation requirement should optionally create and assign its speaker task in the same flow, or state the remaining `Create task` step before completion.
7. **Expose pending profile state to the speaker.** After edit, show `Saved — awaiting organizer approval`, render the pending value, and link/explain the approval lifecycle. Render rich text, never literal HTML.
8. **Turn risky outreach defaults off.** Default **Also add recipients to event** to unchecked and summarize the impending side effect before send.
9. **Enforce a real content gate.** Track submission decision and content approval separately. Public APIs/widgets must return only approved published content; the dashboard needs a visible approval state and bulk approval action.
10. **Close all mutation feedback loops.** Assignment, event-link, agenda detail, and version history caches should update immediately. Every reminder/upload/export must show success/failure; exports should expose a detectable browser download.
11. **Add an evaluator upload smoke test.** Use Playwright `locator.setInputFiles(...)` against CSV, headshot and presentation inputs, then assert persisted filename/version/status and downloadable ZIP/CSV/ICS payloads. Keep the native input reachable even when visually wrapped.
12. **Preserve intentional empty states.** Do not seed headshots merely to make the gallery prettier; the rubric explicitly checks graceful missing-image behavior. Initials already pass that requirement.

## Priority order before the official evaluation

1. **P0:** Fix fresh submission ownership/draft creation (`V2-004`) and multi-event creator membership (`V2-001`).
2. **P0:** Separate content approval from acceptance and enforce it in every public feed (`V2-024`).
3. **P1:** Fix CFP hydration and conditional rendering (`V2-002`, `V2-003`).
4. **P1:** Preserve/enrich speaker identity across CFP, CRM, CSV and event profiles (`V2-005`, `V2-006`, `V2-022`, `V2-026`).
5. **P1:** Resolve 10-minute lightning scheduling and disable broad-event enrollment by default (`V2-018`, `V2-023`).
6. **P2:** Run the three upload paths and three download paths with Playwright, then fix any actual payload failures.
7. **P2:** Fix stale mutation surfaces and make the profile/file workflow self-explanatory (`V2-008`, `V2-014`, `V2-017`, `V2-019`, `V2-025`, `V2-027`).

## Evidence integrity and rerun protocol

- The bundle contains **158 screenshots** (`001`–`159`, with no `063`) and this narrative ledger. Screenshots are production UI evidence, not synthetic mockups.
- No production database, cookies, local storage, secrets, or server files were inspected. No contacts were merged or deleted. Fixture emails only were sent through demo-mode product flows.
- For a targeted rerun, reuse evaluator commit `2b0f7956ab0c6f4868d41356e495b3a225badaab`, create fresh uniquely named entities, and begin with the P0/P1 rows above.
- For upload reruns, use `setInputFiles` and capture: pre-action UI, chosen filename, network response/console, success state, persisted version after reload, and downloaded payload metadata.
