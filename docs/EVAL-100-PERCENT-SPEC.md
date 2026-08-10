# OpenSesh 100% Evaluation Specification

Status: execution contract  
Deadline: two-day stretch build  
Evaluator source: `killmysaas-evals` commit `54acf7a` cloned at `/private/tmp/killmysaas-evals`  
Product target: 100% of the six required areas and 100% of the optional Speaker CRM area

## 1. Objective

Build and verify every behavior judged by the SessionBoard Eval Kit. The finished product must achieve:

- 100/100 across the six required areas.
- 10/10 optional Speaker CRM score.
- A verdict on every rubric item, with no `cannot_judge` caused by authentication, navigation, missing fixture data, turn exhaustion, broken state, or unclear UI.
- Successful execution of all 20 scenarios in their documented order against one persistent deployment.
- Evidence for every verdict through visible UI, persisted reload state, cross-role round trips, downloads, email logs, screenshots, or the manual verification checklist.

This document supersedes conservative scope cuts in earlier planning documents whenever they conflict with an evaluator requirement. The fixed stack, flat-migration rule, tenancy rules, Effect rules, and UI rules in `AGENTS.md` remain binding.

## 2. Definition of done

The project is done only when all of the following are true:

1. All 98 rubric items in section 8 have an implemented, discoverable, persistent path.
2. All 20 scenario traces in section 7 complete without URL guessing or fixture substitution.
3. Organizer, reviewer, speaker, second speaker, and anonymous attendee flows work in one chained run.
4. `pnpm check`, `pnpm test`, `pnpm build`, `pnpm db:reset`, and all seed verification commands pass.
5. The current commit is deployed to the exact URL placed in the evaluator configuration.
6. Targeted evaluator runs for every area exceed 95% score and 95% coverage.
7. A clean full chained evaluator run reaches 100% required score after manual results are finalized.
8. A second full run with `--include-optional` reaches 100% on Speaker CRM.
9. Every manual or auto-partial item has supporting evidence and a completed manual verdict.
10. No defect reported by the judge is severity high or medium.

## 3. Evaluator contract

### 3.1 What the evaluator is

The SessionBoard Eval Kit is an implementation-agnostic browser evaluation. A Claude browser agent uses Playwright to execute natural-language scenarios, collect screenshots, observations, and action transcripts, then a fresh-context Claude judge assigns evidence-cited verdicts. Visual imitation of SessionBoard is not required. Observable behavior, filled-state clarity, persistence, role boundaries, and cross-module data integrity are required.

### 3.2 Evaluation inventory

| Area | Required weight | Scenarios | Rubric items | Internal item weight |
|---|---:|---:|---:|---:|
| Call for Papers | 20 | 4 | 18 | 38 |
| Abstract Management | 20 | 3 | 14 | 28 |
| Speaker Management | 15 | 3 | 16 | 33 |
| Content Management | 15 | 3 | 14 | 31 |
| AI Agenda | 10 | 2 | 8 | 18 |
| Public Widgets | 20 | 3 | 16 | 34 |
| Required total | 100 | 18 | 86 | 182 |
| Speaker CRM, optional | 10 | 2 | 12 | 19 |

### 3.3 Verdict and score rules

- `pass` earns the full item weight.
- `partial` earns half the item weight.
- `fail` and `not_found` earn zero.
- `cannot_judge` is excluded from the score denominator and sent to the manual checklist.
- Each area's item weights determine the percentage inside that area.
- Required overall score is the area-weighted mean of the six required areas.
- Coverage is area-weighted independently of score.
- Below 60% coverage, the evaluator withholds the headline score.
- A 100% result therefore requires full-credit verdicts on every judged item and manual completion of any browser-invisible behavior.

### 3.4 Evaluation types

| Type | Required weight | What OpenSesh must prove |
|---|---:|---|
| `crud` | 41 | Creation and editing persist after navigation and reload. |
| `roundtrip` | 33 | One role's write appears unchanged in another role's view. |
| `exists` | 28 | The screen and capability are visibly reachable. |
| `rule` | 22 | Deadlines, approval gates, filters, and conflicts are enforced rather than merely displayed. |
| `scoping` | 20 | Personas and events see exactly their authorized data and no other data. |
| `depth` | 13 | Score weights, history, recusal, personal schedules, and related differentiators work. |
| `bulk` | 11 | Imports, exports, mass assignment, mass email, and ZIP generation operate on selections. |
| `side-effect` | 8 | Emails, calendar files, and exports are generated and logged. |
| `handoff` | 6 | Data crosses CFP, session, agenda, public, CRM, and event boundaries without re-entry. |

### 3.5 Run semantics

- Areas run in this order: CFP, Abstract Management, Speaker Management, Content Management, AI Agenda, Public Widgets, then optional Speaker CRM.
- Earlier scenarios create state consumed by later scenarios. A database reset is forbidden between areas of a full run.
- A scenario persona is only the starting identity. The agent may sign out and use any configured persona during that scenario.
- Every scenario receives all configured credentials.
- The browser is contained to the target registrable domain and sibling subdomains.
- Native dialogs are automatically accepted, so destructive or irreversible actions must use in-app confirmation when evidence matters.
- Click targets may be semantic elements or elements with `cursor: pointer`, but all important actions should still be real buttons or links with visible labels.
- The agent distinguishes a missing feature from an unreachable feature. Both are unacceptable for this target.
- A failed scenario does not stop the run, but downstream state may be absent and cause cascading losses.
- The default maximum is 70 agent turns per scenario. Core paths must be short enough to finish comfortably.

### 3.6 Evidence contract

Every scored behavior must be evident through at least one of:

- A filled form before save.
- A success toast, dialog, sent count, generated-file state, or confirmation screen.
- A reloaded list or detail screen showing persisted state.
- Screens from two personas showing a cross-role round trip.
- A filtered or sorted state whose visible rows change.
- A visible denial, redirect, or absent capability during a scoping test.
- A file download control and browser download response.
- An email/activity log entry with recipient, subject, status, and timestamp.
- A manual verification result for real delivery or external file validity.

No important state may exist only in a transient toast. No capability may depend on hover-only controls. Empty states must name the action that creates data.

## 4. Canonical evaluator fixtures

### 4.1 Event

| Field | Required value |
|---|---|
| Name | DevFlow Conf 2027 |
| Tagline | The developer workflow conference |
| Dates | 2027-05-12 through 2027-05-14 |
| Location | Moscone West, San Francisco, CA |
| Tracks | AI Engineering; Platform & Infra; Developer Experience |
| Formats | Keynote (45 min); Talk (30 min); Lightning Talk (10 min); Workshop (120 min); Panel (45 min) |
| Rooms | Main Stage; Room 2A; Room 2B; Workshop Lab |

### 4.2 Identities

The evaluator repository contains placeholder addresses in `sample-data.json` and more specific `sbek-test.example.com` addresses in scenario text and the CSV fixture. OpenSesh must avoid ambiguity by supporting configured credentials and by seeding aliases for the scenario-address variants.

| Persona | Name | Primary evaluator email | Password |
|---|---|---|---|
| Organizer | Jordan Alvarez | jordan.organizer@sbek-test.example.com | SbekTest!2027-org |
| Speaker | Priya Raman | priya.speaker@sbek-test.example.com | SbekTest!2027-spk |
| Speaker 2 | Marcus Okafor | marcus.speaker@sbek-test.example.com | SbekTest!2027-spk2 |
| Reviewer | Sam Whitfield | sam.reviewer@sbek-test.example.com | SbekTest!2027-rev |
| Attendee, created during widget testing | Alex Attendee | alex.attendee@sbek-test.example.com | SbekTest!2027-att |

The deployed evaluator configuration must explicitly pass these credentials. The seed may also include the placeholder `sbek-organizer@example.com`, `sbek-speaker@example.com`, `sbek-speaker2@example.com`, and `sbek-reviewer@example.com` aliases, but aliases must not create duplicate visible contacts in the event.

### 4.3 Speaker records

Priya Raman:

- Principal Engineer at Latticework Systems.
- Full fixture bio about build tooling, CI reliability, and developer productivity.
- Twitter `@priyabuilds`.
- LinkedIn fixture URL.
- Vegetarian.
- T-shirt size M.

Marcus Okafor:

- Staff Developer Advocate at Cloudreach Labs.
- Fixture bio about production AI agents, Agents Weekly, and SF AI Tinkerers.

CSV import must accept Priya, Marcus, and Dana Kowalski from `fixtures/speakers.csv` without duplicating matching contacts.

### 4.4 Submissions

1. `Taming 40-Minute CI: Incremental Builds at Monorepo Scale`
   - Talk (30 min), Platform & Infra, Intermediate.
   - Priya primary, Marcus co-presenter with a visible role label.
   - Notes mention the earlier PlatformCon version.
2. `Your AI Pair Programmer Is Lying to You: Verification Patterns That Scale`
   - Talk (30 min), AI Engineering, Advanced.
   - Priya primary.
   - Notes mention an optional workshop format.
3. `Docs That Answer Back: Retrieval-Grounded Documentation Sites`
   - Lightning Talk (10 min), Developer Experience, Beginner.
   - Priya primary.
4. `Lightning: Agents in Production Q&A`
   - Lightning Talk (10 min), AI Engineering.
   - Marcus primary.
   - Used when Content Management or AI Agenda needs a distinct second speaker/session.

### 4.5 Review and communication fixtures

- Basic rating: 4.
- Basic comment: `Strong practical content and a clear narrative arc; abstract could name the specific tooling used. Recommend accept for the Platform track.`
- Decision: Accept.
- Acceptance subject: `Your talk has been accepted to DevFlow Conf 2027`.
- Acceptance body uses `{speaker_name}` and `{talk_title}`.

### 4.6 File fixtures

- `fixtures/headshot.png` must upload and render as an image.
- `fixtures/slides.pdf` must upload twice into one deliverable slot, producing two versions.
- `fixtures/speakers.csv` must import three rows with mapping or automatic header recognition.

## 5. Authentication, navigation, and evaluator ergonomics

### 5.1 Authentication

- Email/password login must work for all four seeded personas.
- Login errors must be inline and specific.
- Signing out must return to a screen with an obvious Sign in action.
- Organizer-created contacts must attach to an existing or later-created account by normalized email.
- Reviewer invite must either create usable credentials, expose a copyable invite link, or attach the seeded Sam account immediately.
- Speaker invite must expose a success state and a copyable portal link even if email delivery is unavailable.
- Demo-role switching may remain, but evaluator credentials must work independently of it.

### 5.2 Navigation

Organizer navigation must expose these labels without hidden routes:

- Overview
- Call for Papers
- Submissions
- Evaluation
- Speakers
- Tasks
- Deliverables
- Sessions
- Agenda
- Files
- Communications
- Widgets
- Speaker CRM
- Event Settings

Reviewer navigation must expose My Reviews and no organizer modules. Speaker navigation must expose Home, My Submissions, My Sessions, Tasks, and Profile. Public event navigation must expose Sessions, Speakers, Agenda, Itinerary, and Speaker Gallery.

### 5.3 Interaction requirements

- Lists must use visible row actions or clickable rows with accessible names.
- Save buttons must state Save, Publish, Send, Generate, Approve, Restore, or the exact action.
- Every list must have a filled-state heading and record count.
- Filters must show their active state and provide Clear filters.
- Sortable columns must expose the current direction.
- Modals and spotlights must preserve the originating list state on close.
- All writes use optimistic updates or immediate invalidation with no spinner-only dead time.
- Success toasts must include the affected count when the action is bulk.

## 6. Product data model required for 100%

The existing event, contact, submission, history, task, file, email, agenda, and embed tables remain the base. Apply all schema changes at once, regenerate the single flat init migration, reset the local database, and reseed. Do not create compatibility paths.

### 6.1 Review subsystem

- `review_rounds`: event, name, open time, close time, blind flag, position, status.
- `review_criteria`: round, label, type, numeric bounds, dropdown options, required flag, weight, position.
- `review_round_members`: round, reviewer event member, assignment cap.
- `review_assignments`: round, submission, reviewer, status, assigned time, completed time, recused time, recusal reason.
- `review_answers`: assignment/review, criterion, numeric value, text value, option value.
- `ai_review_results`: round, submission, score, reasoning, model/provider, overridden score, override reason, overridden by, timestamps.

### 6.2 Speaker and communication additions

- Speaker workflow status enum: invited, onboarding, confirmed, ready, declined.
- Contact custom logistics remain in `contacts.custom` and must be editable from admin.
- Email templates: event, name, subject template, body template, supported merge fields.
- Communication campaigns: event, template, subject/body snapshot, recipient filter snapshot, status, created by, sent time.
- Campaign recipients: campaign, contact, resolved subject/body, delivery status, email-log relation.
- Reminder rules: event, task type/scope, days before due, enabled, last-run timestamp.

### 6.3 Content additions

Existing `submission_edit_history` and `contact_edit_history` must support organizer-authored edits and restoration. Add only fields actually missing for reliable restore. Approval status remains explicit on submissions and contacts. Central files and bulk export should be read models over existing file uploads and versions rather than duplicate storage.

### 6.4 CRM subsystem

- `organization_contacts`: organization-scoped canonical profile independent of one event.
- `organization_contact_events`: organization contact, event contact, event, role/status.
- `organization_contact_notes`: contact, body, author event member, timestamp.
- `organization_contact_tags` and tag definitions.
- `crm_pipeline_stages`: organization, name, semantic status, position.
- `crm_pipeline_cards`: organization contact, stage, owner, current note, timestamps.
- `crm_stage_history`: card, previous stage, new stage, actor, timestamp.
- `crm_segments`: organization, name, saved filter JSON.
- `crm_segment_members` only if a frozen segment is offered; dynamic segments should resolve filters at read time.
- CRM contacts must never directly reference identity-plane users.

## 7. The 20 evaluator scenarios

These traces are implementation acceptance flows. Each must be rehearsed against a clean seed and then as part of the full chained run.

### CFP-S1 — Organizer builds and publishes the CFP

1. Sign in as Jordan and create or open DevFlow Conf 2027.
2. Configure event dates, location, tracks, formats, and branding.
3. Create a public CFP form with short text, long text, dropdown, required flags, and a conditional field.
4. Configure open and close dates.
5. Publish the form.
6. Open the public URL logged out and verify branding, deadline, track/format choices, and conditional behavior.
7. Capture the form builder, published state, and anonymous form.

### CFP-S2 — Speaker drafts, submits, and edits proposals

1. Sign in or sign up as Priya from the public portal.
2. Start Taming 40-Minute CI, save it with minimal data as a draft, leave, and resume it.
3. Complete all standard and custom fields and submit.
4. Verify the on-screen confirmation and submission-confirmation email log.
5. Submit Your AI Pair Programmer Is Lying to You.
6. Edit an existing submitted proposal while the CFP remains open.
7. Verify the speaker dashboard status and the organizer's exact updated data.

### CFP-S3 — Organizer provisions a reviewer; reviewer scores

1. Jordan adds or invites Sam as a reviewer.
2. Assign Taming 40-Minute CI to Sam.
3. Sign out and sign in as Sam using known credentials or the visible invite path.
4. Verify reviewer-only navigation and absence of admin capability.
5. Enter rating 4, the fixture comment, and a review decision.
6. Reopen the review and verify persistence.
7. Return as Jordan and verify the review values and completion state.

### CFP-S4 — Organizer decides, notifies, hands off, and closes

1. Accept Taming 40-Minute CI and reject Your AI Pair Programmer Is Lying to You.
2. Send or queue distinct decision notifications and verify logs.
3. Verify Priya sees Accepted and Rejected in her portal.
4. Verify the accepted submission is now a session with title, speaker, track, and format intact.
5. Set the CFP close time in the past.
6. Verify anonymous submission is blocked and speaker editing is locked.
7. Create a second event and prove event-level isolation of submissions, sessions, and speakers.

### ABS-S1 — Speaker seeds three proposals with a co-presenter

1. Reopen the CFP if CFP-S4 closed it.
2. Sign in as Priya.
3. Reuse Taming 40-Minute CI and add Marcus as co-presenter with an explicit role.
4. Reuse or create the AI Pair Programmer proposal.
5. Create Docs That Answer Back.
6. Verify all three rows and statuses in Priya's dashboard.
7. Verify Priya and Marcus with role labels on the first proposal detail.

### ABS-S2 — Organizer configures rounds, pools, assignments, and reminders

1. Create Initial Review from 2026-08-01 through 2026-10-15 with blind review enabled.
2. Add Originality 1–5 weight 2, Relevance 1–5 weight 1, Recommendation dropdown, and Comments long text.
3. Create Final Review from 2026-10-16 through 2026-11-30 with Final Score 1–10 and Comments.
4. Reload and verify both distinct configurations.
5. Add Sam only to the Initial Review reviewer pool.
6. Assign exactly Taming 40-Minute CI and AI Pair Programmer to Sam, leaving Docs That Answer Back unassigned.
7. Exercise assignment cap 5, track-filtered assignment, or auto-distribution.
8. Verify progress shows Sam at 0 of 2.
9. Send Sam a pending-review reminder and verify confirmation/log.
10. Run AI first-pass evaluation for Taming 40-Minute CI and capture score, reasoning, and override control.

### ABS-S3 — Reviewer scores blind; organizer checks results

1. Sign in as Sam and verify the queue contains exactly the two assigned proposals.
2. Open the blinded first proposal and verify Priya, Marcus, and Latticework Systems are absent.
3. Verify a recusal control exists without activating it on the target submission.
4. Submit Originality 4, Relevance 2, Recommendation Accept, and the fixture comment.
5. Reopen it and verify every value.
6. Submit Originality 5, Relevance 5, Recommendation Accept, and the specified brief comment on the second proposal.
7. Verify the queue shows 2 of 2 complete.
8. Sign in as Jordan and verify weighted aggregates, including approximately 3.33 for the first review when isolated.
9. Sort aggregate descending and ascending.
10. Verify organizer-visible author and co-presenter identity.
11. Verify progress is 2 of 2.
12. Export results to CSV or XLSX.
13. Verify AI and human scores are visually distinct, override the AI score, reload, and verify persistence.

### SPK-S1 — Organizer builds the roster and tasks

1. Add Priya manually with full profile data.
2. Add Marcus manually.
3. Import the evaluator CSV and resolve matching rows without duplicates.
4. Search for Priya, clear search, set her status to Confirmed, reload, and filter Confirmed.
5. Append `SBEK-ORG-EDIT-01` to Priya's bio and verify persistence.
6. Link Priya to Taming 40-Minute CI and show the session on her record.
7. Create Confirm participation, Complete bio and profile, and Sign speaker release form with documented due dates for Priya and Marcus.
8. Send Priya a portal invitation and verify success and communication history.

### SPK-S2 — Speaker completes onboarding

1. Sign in as Priya and verify the portal shows her identity only.
2. Verify Marcus and Dana data are absent.
3. Verify Taming 40-Minute CI appears under My Sessions.
4. Append `SBEK-PORTAL-BIO-01`, update social links, and upload the fixture headshot.
5. Reload and verify the profile round trip.
6. Verify all three tasks and due dates.
7. Complete Confirm participation and Complete bio and profile.
8. Leave Sign speaker release form incomplete.
9. Reload and verify two complete and one incomplete.

### SPK-S3 — Organizer tracks and communicates

1. Verify Priya's portal-edited bio and headshot in the organizer record.
2. Verify task progress at list level for Priya and Marcus.
3. Filter completed and incomplete states.
4. Verify the uploaded headshot filename, metadata, and download control.
5. Compose a general welcome email to all speakers.
6. Use merge fields and capture tokenized and per-recipient resolved previews.
7. Send and verify campaign and recipient history.
8. Save and reload Priya's travel/logistics value.
9. Verify an automated reminder rule exists for incomplete tasks based on due dates.

### CNT-S1 — Organizer sets up deliverable collection

1. Ensure accepted sessions for Priya and Marcus exist.
2. Enable file uploads if the product exposes a global control.
3. Create Upload Session Presentation with instructions, PDF/16:9 guidance, due 2027-05-01, assigned to all speakers.
4. Create Upload Final Headshot (print quality), due 2027-04-14, assigned to all speakers.
5. Verify a 2-speaker by 2-task incomplete matrix with due dates.

### CNT-S2 — Speaker uploads and versions a deliverable

1. Sign in as Priya and verify both deliverable tasks.
2. Open the presentation task and verify visible file type and size constraints.
3. Upload `slides.pdf` and verify filename and completed/uploaded state.
4. Comment `Draft deck - final version coming Friday.` and verify author and timestamp.
5. Upload `slides.pdf` again and verify version 1, version 2, timestamps, and latest marker.
6. Leave the final-headshot task incomplete.
7. Verify Marcus's tasks and sessions are absent.
8. Attempt organizer routes and verify denial or redirect.

### CNT-S3 — Organizer tracks, edits, approves, and exports

1. Verify the exact mixed deliverable state from CNT-S2.
2. Filter incomplete rows and send bulk reminders.
3. Open the central files library and verify slides, session, speaker, date, and version count 2.
4. Open the file, see Priya's comment, reply with the specified organizer message, and verify both versions remain accessible.
5. Prefix the session title with `UPDATED: ` and append the live-demo sentence to the abstract.
6. Reload and verify, then append the laptop sentence as a second edit.
7. Verify two Jordan-attributed history entries and restore the version before the second edit.
8. Edit Priya's bio with the fixture sentence and replace her headshot.
9. Approve Priya's session content and leave Marcus's session unapproved.
10. Verify only the approved session appears publicly with the current approved content.
11. Multi-select uploads, select grouping, generate a ZIP, and verify ready state.
12. Restore the exact original session title for downstream scenarios.

### AIA-S1 — Build agenda structure and resolve conflicts

1. Configure all fixture rooms and tracks, including a newly added room/track during the scenario.
2. Open a three-day time-and-room agenda builder.
3. Schedule sessions into exact day, start, end, and room slots.
4. Reload and verify persistence.
5. Create a speaker overlap and verify a visible double-booking warning.
6. Create a same-room overlap and verify blocking or a visible conflict.
7. Move a conflicting session to a valid slot and verify both conflict warnings clear.

### AIA-S2 — Auto-schedule and publish

1. Leave at least one accepted session unscheduled.
2. Invoke Auto-schedule or AI scheduling once.
3. Verify the session receives a valid slot and room without a hard conflict.
4. Review and publish the agenda.
5. Verify publish confirmation and public availability of the scheduled data.

### EMB-S1 — Anonymous tour of four public views

1. Sign out and open the event publicly.
2. Verify Sessions List card density, search by title, search by speaker, and filters.
3. Expand a session description.
4. Verify surname-ordered Speakers List with search and speaker detail.
5. Verify the multi-day Agenda, switch days, open a session detail, and return.
6. Verify surname-ordered Speaker Gallery with search, photo fallbacks, and speaker detail.

### EMB-S2 — Itinerary and personal schedule

1. Open Itinerary anonymously; attendee authentication is optional but must be supported if required.
2. Verify chronological day grouping and full session metadata.
3. Add a known subset of sessions to My Schedule.
4. Verify My Schedule contains exactly the selected subset.
5. Reload the page and verify the subset persists.
6. Export or add the selected subset to a calendar.

### EMB-S3 — Organizer generates embeds and checks consistency

1. Sign in as Jordan and open Widgets.
2. Generate public URLs and embed snippets for all five widget types.
3. Change branding/color, content filters, and field visibility and verify preview changes.
4. Open generated outputs anonymously.
5. Compare one session's title, full time, room, track, speakers, and description across organizer session, Sessions List, Agenda, Itinerary, and speaker details.
6. Edit source data and verify every public surface updates without republishing the widget configuration.

### CRM-S1 — Build and organize the speaker database

1. Open organization-level Speaker CRM outside an individual event.
2. Import the speaker CSV and verify contacts appear.
3. Search and filter by company, title, and tags; clear the filters.
4. Open Priya and verify identity, notes, event/session history, tags, and custom metadata.
5. Create a near-duplicate Priya with a different email, detect it, choose a primary, merge it, and verify one canonical record remains.
6. Save a filtered view as a named segment and reopen it.
7. Verify CRM overview metrics and at least one populated analytic widget.

### CRM-S2 — Source a speaker and reuse them across events

1. Configure pipeline stages spanning open, won, and lost outcomes.
2. Add a CRM contact to the first stage.
3. Move the card through at least two stages and reload.
4. Open the card and verify notes plus timestamped stage history.
5. Add the contact to DevFlow Conf 2027 and verify the event speaker record preserves profile data.
6. Select multiple CRM contacts, compose a merge-tag email, preview, send, and verify history.

## 8. Complete 98-item implementation and acceptance matrix

Every row is mandatory for the 100% target. The Evidence column specifies what the browser agent and judge must be able to capture.

### 8.1 Call for Papers — 18 items, 20% required score

| ID | W | Type | Implementation requirement | Required evidence |
|---|---:|---|---|---|
| CFP-01 | 3 | crud | Form builder creates short-text, long-text, and dropdown fields; fields support required/optional state; public rendering enforces required fields. | Builder with three types; public form; blocked invalid submission; successful valid submission. |
| CFP-02 | 1 | depth | Conditional rule shows a field only for a chosen format or track and recomputes immediately when the controlling answer changes. | Same public form with condition false and true. |
| CFP-03 | 3 | exists | Anonymous CFP URL displays event name/branding, deadline, tracks, and formats without login. | Logged-out screenshot with all required context. |
| CFP-04 | 2 | rule | Public submission is allowed only inside the configured window; a past close time produces a clear closed state and blocks creation. | Open state followed by closed state after organizer change. |
| CFP-05 | 3 | crud | Speaker can create/access an account, submit a complete proposal, receive confirmation, and see a status-labelled dashboard row. | Filled form, confirmation, and dashboard row. |
| CFP-06 | 3 | roundtrip | Organizer sees the exact submitted title, abstract, track, format, and custom answers. | Speaker submission and organizer detail with matching values. |
| CFP-07 | 1 | depth | Speaker can save a title-only draft, leave, return, and resume the same record. | Draft status before and after returning. |
| CFP-08 | 1 | side-effect | Submission creates a confirmation email for the submitter and records it in the outbound log. | UI confirmation and matching log entry; manual delivery result. |
| CFP-09 | 2 | roundtrip | Submitted proposal remains editable while CFP is open; organizer sees the edited value after reload. | Before/after speaker edit and organizer value. |
| CFP-10 | 2 | scoping | Organizer provisions Sam with usable reviewer access; Sam lands in reviewer UI with no admin navigation or mutation capability. | Invite/add state, successful reviewer login, reviewer-only shell, denied admin route. |
| CFP-11 | 2 | roundtrip | Assigned reviewer records a numeric rating and text comment; organizer sees both and reviewer completion changes. | Reviewer filled/stored review plus organizer view and completion. |
| CFP-12 | 3 | crud | Organizer records distinct Accepted and Rejected decisions and list/detail statuses persist. | Two proposals with distinct decisions after reload. |
| CFP-13 | 2 | roundtrip | Speaker dashboard reflects organizer decisions on the matching proposals. | Organizer decision view and speaker dashboard. |
| CFP-14 | 2 | side-effect | Organizer sends or queues acceptance and rejection messages with a visible success state and email logs. | Send confirmation, acceptance log, rejection log, manual delivery results. |
| CFP-15 | 2 | handoff | Accepted abstract becomes a session using the same record or a linked record without re-entry; title, speaker, track, and format remain intact. | Accepted abstract and session view with identical metadata. |
| CFP-16 | 2 | rule | Speaker editing is disabled and server-rejected after CFP close even if the route is opened directly. | Closed dashboard/detail and failed direct mutation attempt. |
| CFP-17 | 2 | exists | Organizer creates a second event and can switch between both events. | Event switcher/list containing both. |
| CFP-18 | 2 | scoping | Event two never displays event one's submissions, sessions, or speakers, and direct cross-event identifiers are rejected. | Empty/independent event-two lists and denied cross-event detail. |

### 8.2 Abstract Management — 14 items, 20% required score

| ID | W | Type | Implementation requirement | Required evidence |
|---|---:|---|---|---|
| ABS-01 | 3 | crud | Evaluation plan persists Initial Review and Final Review with independent names, dates, order, and distinct scorecards. | Reloaded plan showing both rounds and their criteria. |
| ABS-02 | 2 | scoping | Reviewer pools belong to rounds; adding Sam to Initial Review does not add him to Final Review. | Side-by-side or round-specific pool views. |
| ABS-03 | 3 | crud | Scorecard builder and reviewer form support numeric, dropdown, and free-text fields; all stored values reopen. | Builder, filled reviewer form, and reopened stored values. |
| ABS-04 | 1 | depth | Numeric criteria support weights; aggregate labels and arithmetic use configured weights. | Weight 2/1 configuration and aggregate near 3.33 for scores 4/2. |
| ABS-05 | 3 | scoping | Organizer assigns exact submissions to Sam; his queue contains the two assigned records and excludes the third. | Assignment matrix and exact two-row reviewer queue. |
| ABS-06 | 2 | bulk | At least one scalable assignment tool works. Implement all three for certainty: reviewer caps, auto-distribution, and track-filtered bulk assignment. | Cap value, selected track, auto-distribution result, persisted assignments. |
| ABS-07 | 2 | scoping | Blind round suppresses primary/co-presenter names and company for reviewer while organizer retains identity. | Same submission in blinded reviewer view and identified organizer view. |
| ABS-08 | 2 | roundtrip | Progress table shows assigned/completed counts and percentage per reviewer and updates from 0/2 to 2/2 after reviews. | Baseline and completed progress screens. |
| ABS-09 | 1 | bulk | Organizer selects lagging reviewers, sends a reminder, receives sent count, and gets a log entry. | Selection, confirmation, and reminder log; manual delivery result. |
| ABS-10 | 3 | roundtrip | Results table shows per-submission weighted aggregate and sorts correctly in both directions. | Ascending and descending tables with recorded row order. |
| ABS-11 | 2 | crud | Co-presenters persist with explicit role labels and display in submission form, speaker detail, organizer review, and results context. | Marcus labelled as co-presenter across all relevant screens. |
| ABS-12 | 1 | depth | Reviewer can recuse from one assignment, optionally record a reason, and the organizer sees recused status without exposing other reviewer data. | Reversible test assignment recusal and organizer status. |
| ABS-13 | 2 | side-effect | Organizer exports a real CSV/XLSX containing submission, round, reviewers, criteria values, aggregate, and status. | Export control, browser download, filename, and manual file-content check. |
| ABS-14 | 1 | depth | AI first-pass review produces numeric score and written reasoning, is labelled AI, remains distinct from human reviews, and supports an attributed persistent override. | AI result, override form, and reloaded overridden result. |

### 8.3 Speaker Management — 16 items, 15% required score

| ID | W | Type | Implementation requirement | Required evidence |
|---|---:|---|---|---|
| SPK-01 | 3 | exists | Event speaker roster shows identity, title, company, profile readiness, workflow status, and search/filter controls. | Filled roster, narrowed Priya result, restored list. |
| SPK-02 | 3 | crud | Organizer manually adds a speaker with full profile and edits name, bio, title, company, social, headshot, and logistics. | Filled create form, saved detail, edited value after reload. |
| SPK-03 | 2 | bulk | CSV import uploads the fixture, maps headers when needed, previews rows, deduplicates by event/email, and reports created/updated/skipped counts. | Import steps and roster containing expected contacts without duplicates. |
| SPK-04 | 2 | crud | Speaker workflow status is editable, persists, displays as a badge, and filters the roster. | Priya Confirmed after reload and Confirmed-filtered roster. |
| SPK-05 | 2 | crud | Organizer creates general tasks with instructions and due dates and assigns each to multiple selected speakers. | Filled task form and six resulting assignments for three tasks/two speakers. |
| SPK-06 | 2 | side-effect | Per-speaker or bulk portal invitation sends/logs a welcome message and exposes a usable portal path. | Invite control, success state, log, copyable path, manual delivery result. |
| SPK-07 | 3 | scoping | Speaker portal shows only the signed-in contact's profile, sessions, tasks, forms, and files; organizer routes are blocked. | Priya-only portal and denied organizer route. |
| SPK-08 | 3 | roundtrip | Speaker updates bio, social links, and headshot; organizer sees approved/current values and downloadable headshot metadata. | Portal filled/reloaded profile and organizer record. |
| SPK-09 | 2 | crud | General tasks show due dates and persistent todo/done states; speaker can mark complete and reload. | Two completed and one incomplete after reload. |
| SPK-10 | 2 | roundtrip | Organizer sees and downloads the speaker-uploaded headshot/deliverable with filename, uploader, size, and timestamp. | File row and successful response. |
| SPK-11 | 2 | roundtrip | Session assignments are visible from the organizer speaker record and the speaker portal with consistent metadata. | Same session on both sides. |
| SPK-12 | 2 | roundtrip | List-level progress shows each speaker's general-task completion and supports complete/incomplete filters. | Mixed progress, complete filter, incomplete filter. |
| SPK-13 | 2 | bulk | Organizer selects or filters speakers, composes a general campaign, sends it, and sees campaign plus per-recipient history. | Recipient selection, confirmation count, campaign log. |
| SPK-14 | 1 | depth | Templates support merge tokens and a per-recipient preview resolves them to real values before sending. | Tokenized template and resolved Priya preview. |
| SPK-15 | 1 | depth | Admin can store arbitrary travel/logistics data, including the exact arrival/seat/dietary fixture text, and reload it. | Saved custom field after reload. |
| SPK-16 | 1 | side-effect | Enabled reminder rules send task reminders based on due dates, skip completed assignments, and log each recipient. | Rule configuration, run result, logs, manual delivery result. |

### 8.4 Content Management — 14 items, 15% required score

| ID | W | Type | Implementation requirement | Required evidence |
|---|---:|---|---|---|
| CNT-01 | 3 | crud | Organizer creates file-request tasks with title, instructions, due date, accepted types, max size, and bulk speaker assignment. | Two fixture requests and 2-by-2 pending dashboard. |
| CNT-02 | 3 | crud | Speaker sees assigned requests with deadlines, uploads a file against the correct task/session, and status updates. | Portal before/after upload with filename. |
| CNT-03 | 3 | scoping | Priya cannot see Marcus deliverables or access organizer routes; server-side queries and writes enforce contact/event ownership. | Priya-only data and denied route/API attempt. |
| CNT-04 | 2 | rule | Re-upload creates version 2, retains version 1 with individual access, and clearly marks latest. | Two-version list from speaker and organizer views. |
| CNT-05 | 2 | roundtrip | File comments show author and timestamp across roles; organizer reply joins the same thread. | Priya comment and organizer reply visible together. |
| CNT-06 | 1 | depth | Upload control visibly states accepted types and maximum size before selection and enforces both server-side. | Constraint copy and rejected invalid test file. |
| CNT-07 | 3 | roundtrip | Deliverables dashboard shows one row per speaker/task with due date and accurate status; filters visibly change rows. | Initial matrix, post-upload matrix, and filtered state. |
| CNT-08 | 2 | bulk | Organizer filters/selects outstanding assignments, sends reminders, receives count, and gets logs. | Filter, selection, confirmation, and logs; manual delivery result. |
| CNT-09 | 2 | crud | Organizer edits session title and abstract centrally; list and detail persist after reload. | Updated list/detail and restored original title. |
| CNT-10 | 2 | crud | Organizer edits speaker bio and headshot centrally; rendered record persists after reload. | Filled editor and reloaded profile. |
| CNT-11 | 2 | depth | Session/contact edits create timestamped, attributed versions with diffs; restoring a selected version changes current content correctly. | Two Jordan history entries, restore action, restored abstract. |
| CNT-12 | 3 | rule | Explicit content approval gates public queries; approved content appears and unapproved content is absent, including direct public detail URLs. | Two admin statuses and public output containing only approved session. |
| CNT-13 | 1 | exists | Central files library aggregates every upload with session, speaker, date, kind, status, and version count and links to detail. | Library row for slides with count 2 plus per-session files view. |
| CNT-14 | 2 | bulk | Multi-select latest uploads generates a real ZIP; user can choose grouping by session or speaker and receives queued/ready/download states. | Selection, grouping dialog, ready state, browser download, manual ZIP inspection. |

### 8.5 AI Agenda — 8 items, 10% required score

| ID | W | Type | Implementation requirement | Required evidence |
|---|---:|---|---|---|
| AIA-01 | 3 | exists | Multi-day agenda builder displays time plus rooms/tracks with day navigation and unscheduled sessions. | Filled builder for at least two days and rooms. |
| AIA-02 | 2 | crud | Organizer creates/edits rooms and tracks and immediately uses new values in scheduling. | New room/track in settings and slot controls. |
| AIA-03 | 3 | crud | Organizer places an unscheduled session at a specific day/start/end/room and reload preserves it. | Before/after placement and reloaded slot. |
| AIA-04 | 3 | rule | Overlapping sessions sharing a speaker produce a visible warning naming the conflict. | Conflicting placements and warning. |
| AIA-05 | 2 | rule | Same-room overlap is blocked or visibly flagged with both sessions identified. | Attempted conflict and blocked/warning state. |
| AIA-06 | 2 | rule | Moving a session updates schedule and clears stale room/speaker conflicts immediately and after reload. | Conflict before and clean state after move. |
| AIA-07 | 2 | handoff | Publish action reports success, records published state, and makes scheduled data publicly available. | Publish confirmation and matching anonymous agenda. |
| AIA-08 | 1 | depth | One auto-schedule action places unscheduled sessions into valid slots while respecting duration, rooms, event hours, and hard conflicts. | Unscheduled list before and valid placed sessions after. |

### 8.6 Public Widgets — 16 items, 20% required score

| ID | W | Type | Implementation requirement | Required evidence |
|---|---:|---|---|---|
| EMB-01 | 3 | exists | Session cards show title, truncated description/Show more, full date/time, room, complete speaker names with title/company, format, and track. | Filled card collapsed and expanded. |
| EMB-02 | 2 | rule | Keyword search matches session title and speaker name and updates result count. | Two different searches and narrowed results. |
| EMB-03 | 2 | rule | Faceted Track, Format, and Location/Room filters combine correctly and clear cleanly. | Active filters, matching rows, cleared state. |
| EMB-04 | 3 | exists | Speaker List is sorted by surname and shows headshot, name, title, and company with graceful fallbacks. | Filled ordered directory. |
| EMB-05 | 2 | roundtrip | Speaker List supports name search and each entry opens bio plus sessions with title/date/time/room. | Search and speaker detail. |
| EMB-06 | 3 | exists | Public Agenda shows per-day time structure, rooms/locations, correctly placed sessions, and title plus track/format. | Multi-room day view with known sessions. |
| EMB-07 | 2 | rule | Day controls switch dates and replace the displayed day's sessions. | Two distinct day states. |
| EMB-08 | 2 | exists | Agenda session opens detail with full time range, room, description, format, track, and back/close restoration. | Detail and restored agenda state. |
| EMB-09 | 2 | exists | Itinerary is chronological within days and shows track, title, description, full date/time, room, and complete speakers with title/company. | Filled itinerary day. |
| EMB-10 | 1 | depth | Attendee stars/adds sessions and My Schedule contains exactly the selected set. | Selected buttons and exact personal list. |
| EMB-11 | 1 | depth | Personal selection survives full reload and exports through ICS/add-to-calendar. | Same selection after reload and calendar download control. |
| EMB-12 | 2 | exists | Speaker Gallery is a surname-ordered photo grid with name search and robust missing-photo/title fallbacks. | Full gallery, search, and fallback card. |
| EMB-13 | 1 | exists | Gallery card opens photo/name/title/company, expandable bio, and sessions with title/date/time/room; close restores the grid. | Open detail and restored filtered grid. |
| EMB-14 | 3 | scoping | Sessions, Speakers, Agenda, Itinerary, and Gallery are fully readable without authentication. | Five logged-out URLs with content. |
| EMB-15 | 2 | handoff | Organizer creates share URL and iframe snippet for each widget with theme/color, filters, and field visibility, with a live preview. | Five configured outputs and anonymous render. |
| EMB-16 | 3 | roundtrip | Title, description, full time, room, track, format, and speakers match organizer source across every public view and source edits propagate without rebuilding embeds. | Cross-surface comparison before and after a source edit. |

### 8.7 Speaker CRM — 12 optional items, 10% extra score

| ID | W | Type | Implementation requirement | Required evidence |
|---|---:|---|---|---|
| CRM-01 | 3 | exists | Organization-level speaker directory sits outside events, groups contacts across events, and supports search. | CRM route, multiple-event contacts, search result. |
| CRM-02 | 2 | rule | Company, title, and tags filters combine, visibly narrow rows, and clear. | Multi-filtered and cleared directory. |
| CRM-03 | 2 | roundtrip | Contact detail has canonical identity, persistent internal notes, linked events/sessions, and activity. | Added note after reload and populated cross-event history. |
| CRM-04 | 1 | depth | Organizer-defined tags or custom fields persist and filter. Implement both tags and typed custom metadata for certainty. | Saved tag/custom value and matching filter. |
| CRM-05 | 2 | bulk | Organization-level CSV import maps fields, previews, deduplicates, and reports row outcomes. | Fixture import and resulting CRM rows. |
| CRM-06 | 1 | depth | Near-duplicate candidates are surfaced; organizer selects a primary; merge preserves combined history and removes duplicate. | Candidate pair, merge confirmation, canonical result. |
| CRM-07 | 2 | crud | Kanban sourcing pipeline has configurable open/won/lost stages; cards move and persist after reload. | Card in multiple stages and final reloaded state. |
| CRM-08 | 1 | depth | Pipeline card detail contains notes and timestamped actor-attributed stage transitions. | Detail with at least two transitions. |
| CRM-09 | 1 | depth | Active directory filters save as a named segment and reopening reproduces its membership. | Saved segment and reopened filtered rows. |
| CRM-10 | 2 | handoff | Add to Event copies/links canonical profile into a selected event and it appears in that event roster without re-entry. | CRM source and event speaker record with matching fields. |
| CRM-11 | 1 | bulk | Selected CRM contacts receive a bulk email with merge preview, send confirmation, and communication history. | Selection, resolved preview, send count, log. |
| CRM-12 | 1 | depth | CRM overview shows total contacts, event reach, pipeline counts, profile completeness, and at least one populated chart/table. | Populated metric rail and analytics widget. |

## 9. Two-day stretch implementation plan

This plan is deliberately aggressive. It prioritizes evaluator dependency chains and weighted points, batches schema work into one flat migration reset, reuses current primitives, and defers no rubric requirement. Time boxes are execution targets, not permission to omit acceptance criteria.

### Step 0 — Freeze baseline and make checks green — 30 minutes

Actions:

1. Record current commit and `git status` without altering untracked user files.
2. Run `pnpm check`, `pnpm test`, and `pnpm build`.
3. Fix the existing formatting failure in `packages/domain/src/seed/seed.ts`.
4. Confirm local Postgres is running and `.dev.vars` targets only local Postgres.
5. Run `pnpm db:reset` and the existing seed verification commands.
6. Create a score ledger containing IDs CFP-01 through CRM-12 and link it to this document rather than maintaining another narrative plan.

Exit gate:

- All project checks green before feature work.
- Existing accepted-submission-to-session identity and reversal behaviors still pass.

Commit: `chore: restore green baseline for eval sprint`

### Step 1 — Apply the complete schema expansion once — 2 hours

Actions:

1. Add review round, criterion, membership, assignment, answer, and AI result tables.
2. Add speaker workflow status.
3. Add email template, campaign, recipient, and reminder-rule tables.
4. Add organization-contact, CRM note/tag, pipeline, stage-history, and segment tables.
5. Confirm existing edit-history tables can restore organizer-authored session and contact edits; add only required snapshot fields.
6. Add Effect Schema domain models and typed errors for closed rounds, assignment caps, recusal, invalid score values, blind-data access, merge conflicts, and invalid pipeline moves.
7. Export new schema modules from the domain package.
8. Delete the migrations directory, regenerate exactly one init migration, reset Postgres, and seed.

Hard requirements:

- Every event-plane table scopes through event, event member, contact, or submission according to the plane-separation rule.
- No server or repo code sees driver or Hyperdrive details.
- No `any`, thrown domain errors, duplicate handwritten validation types, raw SQL, or compatibility fields.

Exit gate:

- Exactly one migration exists.
- `pnpm db:reset`, domain typecheck, and seed verification pass.
- Seed creates both review rounds, CRM stages, templates, and reminder rules without duplicate records.

Commit: `feat(domain): add complete evaluation and crm model`

### Step 2 — Make evaluator personas and fixtures deterministic — 1 hour

Actions:

1. Seed Jordan, Priya, Marcus, and Sam with the canonical credentials.
2. Link users to event members or contacts through sanctioned crossings only.
3. Seed the canonical event, libraries, submissions, co-presenter role, sessions, agenda slots, tasks, deliverables, and public widget data.
4. Preserve create-from-empty flows even when seed data exists.
5. Make create/import actions idempotent by showing matching records and offering Update/Skip rather than silently duplicating.
6. Add a visible copyable portal path to speaker and reviewer invitation success states.
7. Verify direct login and logout for all personas.

Exit gate:

- Four password logins succeed.
- Each persona lands in the correct shell.
- Priya, Marcus, Sam, and Jordan resolve to one visible domain identity each.
- Evaluator CSV does not duplicate Priya or Marcus.

Commit: `feat(seed): add deterministic eval personas and fixtures`

### Step 3 — Implement evaluation plans and scorecards — 3 hours

Primary files:

- `packages/domain/src/server/schema/reviews.ts`
- `packages/domain/src/server/repos/reviews.ts`
- `apps/web/src/server-fns/reviews.ts`
- `apps/web/src/routes/admin.evaluation.tsx`
- focused components under `apps/web/src/components/evaluation/`

Actions:

1. Replace the current evaluation placeholder/simple configuration with a rounds list.
2. Add Create round and Edit round on a dedicated page or large inline workspace.
3. Implement name, open/close, blind flag, and position.
4. Implement scorecard criteria for numeric, dropdown, and long text.
5. Add numeric minimum/maximum and weight.
6. Add dropdown option editing and reordering.
7. Display a live reviewer-form preview.
8. Save through one validated Effect program and reload the authoritative plan.
9. Seed Initial Review and Final Review exactly as the evaluator will create them, while allowing the evaluator to reuse or recreate them.

Exit gate:

- ABS-01, ABS-03, and ABS-04 pass by manual browser rehearsal.
- Both rounds and all criteria survive a full reload.

Commit: `feat(evaluation): add review rounds and scorecards`

### Step 4 — Implement reviewer pools and assignment operations — 2.5 hours

Actions:

1. Add a Reviewers tab inside each round.
2. Add/invite Sam by email and attach him only to Initial Review.
3. Add assignment-cap editing.
4. Add an assignment table with submission selection, reviewer selection, track filter, assigned state, and unassigned state.
5. Add Assign selected.
6. Add Auto-distribute that honors reviewer pool, cap, track, and existing assignments.
7. Make every operation idempotent and event/round scoped.
8. Add a reviewer invite/welcome action with copyable access path and email log.

Exit gate:

- Initial Review has Sam; Final Review does not.
- Exactly two specified submissions are assigned to Sam.
- Docs That Answer Back stays unassigned.
- Cap, track bulk assignment, and auto-distribution each work on a safe test set.
- CFP-10 and ABS-02, ABS-05, ABS-06 pass.

Commit: `feat(evaluation): add reviewer pools and bulk assignment`

### Step 5 — Replace reviewer queue with round-aware blind scoring — 2.5 hours

Actions:

1. Query only assignments belonging to the signed-in reviewer.
2. Group queue by round and show deadline, pending/completed/recused status, and counts.
3. Render scorecards dynamically.
4. Validate numeric bounds, required text, and dropdown membership on the server.
5. Hide all contact identity, participant names, company, headshots, email, social links, and identifying custom answers when blind.
6. Do not leak blinded identity through page title, breadcrumbs, HTML attributes, query cache, or accessible labels.
7. Add recusal with optional reason and a clear confirmation.
8. Allow completed reviews to reopen and display stored values.
9. Keep reviewer shell free of organizer capabilities and enforce server-side role checks.

Exit gate:

- Sam sees exactly two assignments.
- Scores 4/2/Accept/comment and 5/5/Accept/comment persist.
- Reviewer identity scan finds none of the forbidden author strings.
- Admin routes and mutations are denied for Sam.
- CFP-11 and ABS-03, ABS-05, ABS-07, ABS-12 pass.

Commit: `feat(reviewer): add blind round-aware scoring`

### Step 6 — Build review progress, results, reminders, export, and AI pass — 3 hours

Actions:

1. Add progress rows per round/reviewer with assigned, completed, recused, remaining, and percentage.
2. Add pending-reviewer selection and bulk reminders.
3. Log each reminder recipient and show sent counts.
4. Add results rows with human answers, weighted aggregate, recommendation, review count, and completion.
5. Add stable ascending/descending aggregate sorting.
6. Add CSV export with round, submission, participants, reviewer, each criterion, weighted total, recommendation, recusal, and status.
7. Add AI first-pass action using a real configured model binding or native HTTP provider call with typed configuration failure.
8. Store numeric score, written reasoning, provider/model, generation time, and inputs version.
9. Display AI results separately from human reviews.
10. Add human override with reason, actor, and persistence.

Exit gate:

- Progress moves from 0/2 to 2/2 without stale data.
- Weighted arithmetic is correct and labelled.
- Both sort directions visibly reorder fixture rows.
- CSV downloads and passes manual content inspection.
- AI score, reasoning, and override survive reload.
- ABS-08, ABS-09, ABS-10, ABS-13, and ABS-14 pass.

Commit: `feat(evaluation): add progress results export and ai triage`

### Step 7 — Complete speaker roster administration — 2.5 hours

Actions:

1. Add manual Add Speaker with all public profile and logistics fields.
2. Add organizer Edit Speaker using the same schema.
3. Add workflow status mutation and status filter.
4. Harden CSV mapping, preview, deduplication, and outcome counts.
5. Complete the speaker spotlight with profile readiness, sessions, tasks, files, emails, history, and profile approval.
6. Add organizer headshot upload and download metadata.
7. Add free-form travel/logistics value editing.

Exit gate:

- Priya and Marcus can be created from empty state.
- Priya's organizer bio sentinel and Confirmed status persist.
- CSV import creates Dana and does not duplicate Priya/Marcus.
- Search and status filters pass.
- SPK-01 through SPK-04, SPK-10, SPK-11, and SPK-15 pass.

Commit: `feat(speakers): complete roster and speaker workspace`

### Step 8 — Complete tasks, invitations, campaigns, and reminders — 3 hours

Actions:

1. Ensure general task templates support instructions, due dates, and multi-speaker assignment.
2. Keep general tasks distinct from file requests in UI and data.
3. Add speaker invitation from record and bulk selection.
4. Add Communications composer with recipient selection/filter.
5. Add reusable templates and documented merge tokens.
6. Add per-recipient resolved preview before send.
7. Persist campaign snapshot and individual email logs.
8. Add reminder-rule UI with days-before-due and enable/disable.
9. Implement scheduled handler and a Run now admin action for deterministic verification.
10. Exclude completed and waived assignments from reminders.

Exit gate:

- Three tasks create six assignments.
- Priya completes two and the admin progress reflects it.
- Portal invite logs successfully.
- Welcome campaign resolves Priya/Marcus values and logs recipients.
- Reminder rule run targets only incomplete tasks.
- SPK-05 through SPK-09, SPK-12 through SPK-14, and SPK-16 pass.

Commit: `feat(communications): add campaigns invites and task automation`

### Step 9 — Complete organizer content editing and central files — 3 hours

Actions:

1. Add organizer session editor for title and abstract.
2. Write edit history on every changed save with actor, timestamp, previous/new values, and approval status.
3. Add history display with field-level diff and Restore.
4. Add organizer speaker bio/headshot editor using contact history.
5. Make Approved, Pending review, and Draft explicit and filterable.
6. Change every public session query and direct detail loader to return only approved content.
7. Build central files library over all event uploads and latest versions.
8. Add version count, file metadata, session/speaker association, filters, detail, comments, and download.
9. Add multi-select and grouping dialog.
10. Generate an uncompressed standards-compliant ZIP without adding a dependency; include latest selected versions in session/speaker folders.

Exit gate:

- Two organizer edits produce two attributed history entries.
- Restore removes only the second appended sentence.
- Organizer speaker edit and headshot persist.
- Unapproved session is absent from all public surfaces and direct detail.
- Files library and ZIP pass manual inspection.
- CNT-09 through CNT-14 pass without regressing CNT-01 through CNT-08.

Commit: `feat(content): add admin editing history library and export`

### Step 10 — Make all public views evaluator-complete — 3.5 hours

Actions:

1. Create a shared approved public-program read model so all views consume identical values.
2. Enrich Session cards with complete metadata and expandable descriptions.
3. Add combined title/speaker search, result count, and Track/Format/Room facets.
4. Add speaker search to List and Gallery.
5. Build one reusable speaker-detail modal/panel for both views.
6. Ensure every linked session shows title, full time, and room.
7. Enrich Itinerary with track, description, full date/time, room, and complete speaker title/company values.
8. Add personal selection with event-scoped localStorage key.
9. Add My Schedule and generate a valid multi-event ICS download for the selected subset.
10. Verify Agenda details and state-preserving Back/close behavior.
11. Complete field-visibility and filter controls in Widget Builder and preserve theme/color choices in generated URLs/snippets.

Exit gate:

- EMB-S1, EMB-S2, and EMB-S3 complete inside their turn limits.
- All 16 EMB items pass.
- All five logged-out surfaces show identical source data.

Commit: `feat(public): complete widgets details and personal schedule`

### Step 11 — Build the complete organization Speaker CRM — 4 hours

Actions:

1. Add organization-level CRM route outside event navigation context.
2. Aggregate/link event contacts into canonical organization contacts by normalized email with explicit merge behavior.
3. Add search, company/title/tag filters, clear filters, and saved dynamic segments.
4. Add contact detail with notes, tags, custom metadata, event/session history, and activity.
5. Add CSV import with mapping, preview, dedupe, and outcome counts.
6. Add duplicate-candidate detection by normalized name/email/company similarity.
7. Add merge preview and primary selection; preserve all history and event links.
8. Add configurable pipeline stage board and drag/drop or explicit Move to stage action.
9. Record every transition with actor and timestamp.
10. Add Add to Event and copy canonical values into an event contact without duplicating by email.
11. Reuse campaign composer for selected CRM contacts.
12. Add overview metrics and populated pipeline/profile-completeness visualization.

Exit gate:

- CRM-S1 and CRM-S2 complete from a clean seed.
- All 12 CRM items pass.

Commit: `feat(crm): add cross-event speaker sourcing workspace`

### Step 12 — Audit scoping, round trips, and direct URLs — 2 hours

Actions:

1. For every server function, confirm event ID comes from authorized context rather than trusted client input.
2. Test reviewer attempts against admin routes, other reviewers' assignments, other rounds, and other events.
3. Test speaker attempts against Marcus's contacts, sessions, tasks, files, and organizer routes.
4. Test anonymous access to public views and denial on private routes.
5. Test unapproved session direct URL.
6. Test event-two identifiers inside event-one routes and mutations.
7. Verify blind review response payload and rendered HTML contain no author identity.
8. Verify optimistic cache updates cannot leak one persona's prior cached data after role switch.

Exit gate:

- Every `scoping` and `rule` rubric item has a negative-path test.
- No browser-visible authorization defect remains.

Commit: `fix(authz): harden eval scoping and approval rules`

### Step 13 — Run project verification and scenario smoke tests — 2 hours

Actions:

1. Run format, lint, typecheck, unit tests, and build.
2. Reset database once.
3. Run CFP, review-desk, mail, and seed verification scripts.
4. Manually execute all 20 scenario traces in order using the fixture values.
5. Capture any missing label, state, or route as a failing spec row and fix it immediately.
6. Verify CSV, ICS, ZIP, and file download responses.
7. Verify email logs for submission, decision, invitation, review reminder, task reminder, and campaign sends.

Exit gate:

- Local score ledger shows 98 implemented and locally evidenced rows.
- No check or build warning indicates missing assets or broken routes.

Commit: `test: verify complete SessionBoard eval flows`

### Step 14 — Deploy, run targeted evaluator passes, and repair — 3 hours

Actions:

1. Deploy the exact verified commit.
2. Confirm production bindings, database, mail, file storage, AI provider, and scheduled handler.
3. Run evaluator smoke and dry-run.
4. Run targeted high-risk areas headed: Abstract Management, Content Management, Public Widgets, Speaker CRM.
5. Open each report and inspect every `partial`, `not_found`, `cannot_judge`, and defect.
6. Fix the product rather than editing evaluator specs.
7. Resume interrupted runs rather than restarting completed scenarios.

Exit gate:

- Each targeted area returns 100% or has only manual-pending items with evidence ready.
- Coverage exceeds 95% in every targeted area.

Commit after each coherent repair, using `fix(<area>): <observable evaluator defect>`.

### Step 15 — Run the clean full evaluation and finalize — 2 hours plus evaluator runtime

Actions:

1. Reset the deployed evaluator database exactly once to the canonical seed.
2. Run all six required areas in default order with the strong judge configuration.
3. Complete `manual-results.json` using real inbox/log/download verification.
4. Finalize and inspect the report.
5. Run optional CRM from the same compatible deployment or a new clean full run with `--include-optional`.
6. Repeat only failed scenarios or resume the run after any repair.
7. Archive `report.html`, `report.json`, manual results, and evidence bundles with the release commit.

Exit gate:

- Required report: 100% score, 100% resolved coverage.
- Optional CRM report: 100%.
- No open high/medium defects.

Commit: `chore: record 100 percent eval evidence`

## 10. Execution schedule

The schedule assumes continuous implementation and immediate verification after each coherent slice.

### Day 1 — Required review engine and persona reliability

| Clock block | Work |
|---|---|
| Hour 0–0.5 | Step 0 baseline |
| Hour 0.5–2.5 | Step 1 schema expansion |
| Hour 2.5–3.5 | Step 2 personas and fixtures |
| Hour 3.5–6.5 | Step 3 rounds and scorecards |
| Hour 6.5–9 | Step 4 pools and assignments |
| Hour 9–11.5 | Step 5 reviewer queue and blind scoring |
| Hour 11.5–14.5 | Step 6 progress, results, export, AI pass |
| Hour 14.5–17 | Step 7 speaker roster |
| Hour 17–20 | Step 8 communications and reminders |
| Hour 20–22 | Review and speaker scenario rehearsal plus repairs |

Day 1 score target: CFP 100%, Abstract Management 100%, Speaker Management 100% locally.

### Day 2 — Content, public, CRM, adversarial verification, evaluator runs

| Clock block | Work |
|---|---|
| Hour 0–3 | Step 9 content admin and files |
| Hour 3–6.5 | Step 10 public views |
| Hour 6.5–10.5 | Step 11 Speaker CRM |
| Hour 10.5–12.5 | Step 12 scoping audit |
| Hour 12.5–14.5 | Step 13 complete local scenario pass |
| Hour 14.5–17.5 | Step 14 targeted deployed evaluator runs and repairs |
| Hour 17.5 onward | Step 15 full chained run, manual verification, final repairs, rerun/resume |

Day 2 score target: all seven areas 100%, all manual results complete.

## 11. Required automated tests

Tests are not substitutes for evaluator evidence, but they protect the rule and scoping behaviors most likely to regress during the sprint.

### 11.1 Review-domain tests

- Weighted aggregate returns 3.33 for Originality 4 weight 2 and Relevance 2 weight 1.
- Dropdown values outside configured options are rejected.
- Numeric values outside criterion bounds are rejected.
- Reviewer cannot submit an unassigned review.
- Reviewer cannot access another round's assignment.
- Reviewer cap is honored by auto-distribution.
- Track-filtered bulk assignment assigns only matching submissions.
- Auto-distribution is deterministic for a fixed input and never duplicates an assignment.
- Blind read model contains no contact identity or identifying participant fields.
- Completed assignment updates progress counts.
- Recusal updates assignment state and excludes it from required-completion denominator according to the displayed label.
- AI override preserves original AI score and stores actor/reason.

### 11.2 Speaker and communication tests

- CSV import creates Dana and updates/skips matching Priya and Marcus without duplication.
- Status mutation remains event scoped.
- Speaker portal query returns only the authenticated contact's records.
- Speaker cannot call organizer mutations.
- Merge tokens resolve separately for Priya and Marcus.
- Campaign log contains one recipient row per selected contact.
- Reminder run skips done and waived assignments.
- Reminder run is idempotent within its configured delivery window.

### 11.3 Content tests

- Second upload produces a second version and preserves access to the first.
- File comment thread returns both speaker and organizer authors in timestamp order.
- Organizer edit creates an attributed submission history entry.
- Restore writes a new history entry and restores the selected snapshot.
- Public query excludes unapproved sessions.
- Direct public session lookup returns NotFound for unapproved content.
- ZIP contains only selected latest versions and uses chosen grouping paths.

### 11.4 Agenda and public tests

- Speaker and room conflict tests remain green.
- Moving a session clears derived conflicts.
- Auto-scheduler never creates hard room or speaker conflicts.
- Public read model returns identical metadata to every view serializer.
- Search matches title and speaker name case-insensitively.
- Combined filters use intersection semantics.
- Personal schedule serialization restores the exact selected identifiers.
- ICS includes one VEVENT per selected session with correct UTC/local conversion and unique UID.

### 11.5 CRM tests

- Organization directory groups event contacts by canonical organization contact.
- Multi-filter intersection and Clear filters are correct.
- Notes persist and event history is ordered.
- Duplicate detection surfaces the alternate Priya.
- Merge preserves notes, tags, event links, and stage history.
- Pipeline transition persists and records actor/time.
- Dynamic saved segment reproduces current filter membership.
- Add to Event deduplicates by normalized email and preserves profile data.

## 12. Evaluator configuration

Create `/private/tmp/killmysaas-evals/evalconfig.json` with the deployed URL and explicit credentials. Do not commit this file to OpenSesh.

```json
{
  "url": "https://opensesh.d4mr.workers.dev",
  "areas": [],
  "includeOptional": true,
  "personaEmails": {
    "organizer": "jordan.organizer@sbek-test.example.com",
    "speaker": "priya.speaker@sbek-test.example.com",
    "speaker2": "marcus.speaker@sbek-test.example.com",
    "reviewer": "sam.reviewer@sbek-test.example.com"
  },
  "credentials": {
    "organizer": {
      "email": "jordan.organizer@sbek-test.example.com",
      "password": "SbekTest!2027-org",
      "notes": "Organizer for DevFlow Conf 2027. Use the visible event switcher if another event is initially selected."
    },
    "speaker": {
      "email": "priya.speaker@sbek-test.example.com",
      "password": "SbekTest!2027-spk",
      "notes": "Speaker portal account linked by email to Priya Raman."
    },
    "speaker2": {
      "email": "marcus.speaker@sbek-test.example.com",
      "password": "SbekTest!2027-spk2",
      "notes": "Second speaker account linked by email to Marcus Okafor."
    },
    "reviewer": {
      "email": "sam.reviewer@sbek-test.example.com",
      "password": "SbekTest!2027-rev",
      "notes": "Reviewer account. Initial Review assignments are visible under My Reviews."
    }
  },
  "agentModel": "claude-sonnet-5",
  "judgeModel": "claude-opus-5",
  "maxTurnsPerScenario": 100,
  "headless": true,
  "submissionNotes": "OpenSesh provides password access for every persona and also a Demo roles switcher. Organizer modules are in the left sidebar. Reviewer and speaker accounts land in role-scoped portals. All five anonymous program views are linked from the public event header. DevFlow Conf 2027 may already contain evaluator fixtures; reuse matching records instead of creating duplicates."
}
```

Use 100 turns for the final run to maximize coverage. Targeted development runs may use 70 turns.

## 13. Verification commands

### 13.1 Project verification

Run from `/Users/prithvishbaidya/work/personal/sessionboard-clone`:

```bash
pnpm check
pnpm test
pnpm build
pnpm db:reset
pnpm cfp:verify
pnpm review-desk:verify
pnpm mail:verify
```

If script names differ, use the package scripts actually defined in `package.json`; do not silently omit an equivalent verification.

### 13.2 Evaluator setup and offline validation

Run from `/private/tmp/killmysaas-evals`:

```bash
pnpm install
pnpm run list
pnpm run smoke
pnpm run eval -- --url https://opensesh.d4mr.workers.dev --dry-run
```

### 13.3 Targeted high-risk runs

```bash
pnpm run eval -- --url https://opensesh.d4mr.workers.dev --areas abstract-management --headed --max-turns 100 --agent-model claude-sonnet-5 --judge-model claude-opus-5
pnpm run eval -- --url https://opensesh.d4mr.workers.dev --areas speaker-management,content-management --headed --max-turns 100 --agent-model claude-sonnet-5 --judge-model claude-opus-5
pnpm run eval -- --url https://opensesh.d4mr.workers.dev --areas public-widgets --headed --max-turns 100 --agent-model claude-sonnet-5 --judge-model claude-opus-5
pnpm run eval -- --url https://opensesh.d4mr.workers.dev --areas speaker-crm --include-optional --headed --max-turns 100 --agent-model claude-sonnet-5 --judge-model claude-opus-5
```

### 13.4 Full run

```bash
pnpm run eval -- --url https://opensesh.d4mr.workers.dev --include-optional --max-turns 100 --agent-model claude-sonnet-5 --judge-model claude-opus-5
```

Follow progress through the run's `run.log`. If interrupted, use the exact resume command printed by the evaluator. After completing manual results:

After the evaluator prints its concrete run directory, assign that path and finalize it:

```bash
OPENSESH_EVAL_RUN=runs/2026-08-10T000000
pnpm run finalize -- --run "$OPENSESH_EVAL_RUN"
```

The timestamp in the assignment must match the directory created by the evaluator.

## 14. Manual verification checklist

The following rubric items are manual or auto-partial in the canonical evaluator and require explicit follow-through.

| ID | Manual verification |
|---|---|
| CFP-08 | Submit with a controlled inbox and confirm the proposal confirmation arrives with event/submission context. |
| CFP-14 | Confirm acceptance and rejection emails arrive, use resolved speaker/session values, and link to the correct portal. |
| ABS-07 | Inspect reviewer browser/network-visible content and confirm blinded identity is absent; inspect organizer view for identity presence. |
| ABS-09 | Confirm Sam's reminder arrives or the outbound mail catcher records the correct recipient, round, pending count, and deadline. |
| ABS-13 | Open the downloaded export and verify headers, fixture rows, criterion values, weighted aggregate, and status. |
| ABS-14 | Verify AI generation calls the configured provider, reasoning is not a hardcoded fixture, and override persists. |
| SPK-06 | Confirm portal invitation arrives and its link opens the correct speaker portal/password flow. |
| SPK-07 | Attempt direct organizer URLs and server mutations while signed in as Priya and confirm denial. |
| SPK-10 | Download the uploaded headshot and verify it opens as the expected image. |
| SPK-13 | Confirm general campaign delivery to controlled recipient aliases and compare resolved merge values. |
| SPK-16 | Trigger scheduled or Run now reminders and confirm only incomplete-task speakers receive them. |
| CNT-08 | Confirm outstanding-task reminders name the correct tasks and deadlines per recipient. |
| CNT-14 | Download and open the ZIP; verify selected latest versions, paths, grouping, and absence of deselected files. |
| EMB-11 | Download/open ICS and verify only selected sessions with correct local times appear. |
| EMB-15 | Paste every iframe snippet into a plain local HTML host and verify anonymous rendering/configuration. |
| EMB-16 | Compare exact metadata across organizer and all public surfaces before and after a source edit. |
| CRM-11 | Confirm selected CRM recipients, merge personalization, delivery logs, and absence of unselected recipients. |

Populate every corresponding entry in `manual-results.json` with `pass` plus concise evidence. Never mark an unverified side effect as pass.

## 15. Evaluator-specific product quality rules

These rules do not add rubric IDs, but they prevent coverage and defect losses.

1. Prefer obvious domain labels used in scenario text: Evaluation, Reviewers, Assignments, Progress, Results, Deliverables, Files, Communications, Widgets, Speaker CRM.
2. Do not make the agent infer that Abstracts means Sessions or that Tasks means File Requests; expose explicit tabs when concepts differ.
3. Keep primary actions above the fold on common desktop viewport sizes.
4. Persist filters in URL search parameters where practical so screenshots and Back behavior are stable.
5. Do not open core editors in narrow sheets. Use a dedicated page or sufficiently wide workspace.
6. Keep destructive merge/restore actions reversible or explicitly confirmed.
7. Make accepted, rejected, pending, completed, recused, approved, and unapproved states text-labelled; color alone is insufficient.
8. Show record counts on queues, results, progress, tasks, files, and CRM.
9. Never require an off-site link or inbox to reach a persona during automated scenarios.
10. Keep exports and downloads on the target origin.
11. Public links must not redirect to login.
12. Avoid virtualizing small evaluator fixture lists because screenshots need complete visible context.
13. Use compact layouts, but do not hide required evidence in collapsed sections by default.
14. Every form must preserve evaluator-entered values when validation fails.
15. Every side-effect action must be idempotent or clearly show that it was already sent.

## 16. Deliberate implementation choices

These choices maximize score while respecting the project's simplicity contract.

- Use one dynamic scorecard engine for organizer preview and reviewer entry.
- Use one shared speaker-detail surface for Speaker List and Speaker Gallery.
- Use one canonical public-program read model for all five public views.
- Use existing task/file primitives; distinguish general tasks from file requests through explicit type and UI, not duplicate systems.
- Use existing submission/contact history tables rather than a second content-version system.
- Use one campaign engine for event-speaker and CRM bulk email.
- Use dynamic CRM segments stored as filter JSON rather than materialized member tables unless frozen lists become necessary.
- Use explicit Move to stage actions if robust drag-and-drop would exceed the time box; the rubric requires persistent movement, not a particular gesture.
- Use a small internal ZIP encoder to avoid a dependency while producing a real standards-compliant artifact.
- Implement AI abstract review only after human review flow is complete; provider failure must be typed and visible, never silently replaced with fabricated output.

## 17. Release blockers

Any one of these blocks the 100% release:

- A persona cannot log in with configured credentials.
- Reviewer or speaker can see organizer navigation or data.
- Blind reviewer content contains author/co-presenter identity.
- Event switching leaks records.
- Review round, scorecard, assignment, or submitted answers fail to survive reload.
- Weighted aggregates are wrong or unsortable.
- Accepted submission metadata must be re-entered as a session.
- Unapproved content appears publicly.
- File re-upload overwrites the prior version.
- Public views disagree about session metadata.
- Personal schedule disappears on reload.
- Any of five public views requires login.
- CSV, review export, ZIP, headshot, slides, or ICS download is nonfunctional.
- Bulk actions lack selection scoping or sent/generated counts.
- CRM merge loses event, note, tag, or pipeline history.
- An evaluator report contains `not_found`, unresolved `cannot_judge`, or high/medium defects.
- Required coverage is below 100% after manual finalization.

## 18. Final 100% sign-off ledger

Before declaring completion, record a concrete evidence location for every line:

- [ ] CFP: 18 of 18 pass; 38 of 38 internal weight.
- [ ] Abstract Management: 14 of 14 pass; 28 of 28 internal weight.
- [ ] Speaker Management: 16 of 16 pass; 33 of 33 internal weight.
- [ ] Content Management: 14 of 14 pass; 31 of 31 internal weight.
- [ ] AI Agenda: 8 of 8 pass; 18 of 18 internal weight.
- [ ] Public Widgets: 16 of 16 pass; 34 of 34 internal weight.
- [ ] Required total: 86 of 86 items, 182 of 182 internal weight, 100/100 area-weighted score.
- [ ] Speaker CRM: 12 of 12 pass; 19 of 19 internal weight; 10/10 optional score.
- [ ] All 20 scenarios completed.
- [ ] All 17 manual/auto-partial items finalized with evidence.
- [ ] `pnpm check` passed.
- [ ] `pnpm test` passed.
- [ ] `pnpm build` passed.
- [ ] `pnpm db:reset` passed against local Postgres.
- [ ] Exactly one flat init migration exists.
- [ ] Current commit is deployed at the configured URL.
- [ ] Full evaluator report and evidence are archived.
- [ ] No high/medium defects remain.

## 19. Reporting format for each completed step

Each implementation step must end with:

1. What was built.
2. Rubric IDs now satisfied.
3. Schema and UX decisions, including the rejected tradeoff.
4. Automated checks executed and their result.
5. Manual scenario evidence captured.
6. Anything still open within that step.
7. Exact commands and URLs to verify.
8. A coherent conventional commit before starting the next step.

The sprint ends only at the sign-off ledger, not when the feature code exists.
