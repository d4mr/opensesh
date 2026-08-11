# OpenSesh Production Eval — Exhaustive Issue Register

Date: 2026-08-11  
Production target: <https://app.opensesh.io>  
Evidence source: [Production Manual Eval Run](./EVAL-PROD-MANUAL-RUN-2026-08-11.md)  
Evaluator source: `/private/tmp/killmysaas-evals` at `2b0f7956ab0c6f4868d41356e495b3a225badaab`

## Purpose and interpretation

This is the single, deduplicated register of everything that hurt during the production evaluation.
It includes confirmed product defects, missing depth, confusing behavior, observability failures,
minor polish problems, and evaluation-process limitations. An item is included even when the
formal rubric still passed.

This document does not claim that every item is equally severe. Use the following labels:

- **P0 — walkthrough blocker:** can prevent a clean evaluator from reaching or completing the core
  organizer → speaker → reviewer → publish loop.
- **P1 — major correctness defect:** permits access but breaks data integrity, workflow truth, or a
  heavily weighted evaluator rule.
- **P2 — material workflow/UX defect:** the workflow remains possible, but misleading state,
  missing depth, or friction damages confidence and score.
- **P3 — polish or completeness:** visible quality issue or non-core capability gap.
- **Eval limitation:** uncertainty or friction in the evaluation process, not established as a
  product defect.

Confidence is **confirmed** when reproduced in production, **source-confirmed** when production
behavior and the implementation agreed, and **needs reproduction** when the observation could have
been affected by automation or run state.

## Executive index

| ID | Severity | Area | Short description | Confidence |
|---|---|---|---|---|
| OS-001 | P0 | Authentication | New signup lands in an unauthorized seeded portal | confirmed |
| OS-002 | P0 | Organizations | Create organization is a no-op | confirmed |
| OS-003 | P0 | CFP | Participant-role mismatch blocks every complete submission | source-confirmed |
| OS-004 | P0 | CFP | Fresh CFP saves are non-atomic and can partially persist | source-confirmed |
| OS-005 | P1 | CFP | Fresh forms start with two Title fields | confirmed |
| OS-006 | P1 | CFP | Question type changes do not reliably apply | confirmed |
| OS-007 | P1 | CFP | Seeded participant collection can be enabled with no usable questions | confirmed |
| OS-008 | P2 | CFP | Seeded description limit rejects the canonical fixture | confirmed |
| OS-009 | P1 | Observability | Application failures are returned inside HTTP 200 responses | source-confirmed |
| OS-010 | P1 | Observability | Database failure detail is swallowed and absent from Worker logs | source-confirmed |
| OS-011 | P2 | Runtime | Production emits React hydration error #418 | confirmed |
| OS-012 | P2 | Evaluation | Reviewer assignment appears unsuccessful until reload | confirmed |
| OS-013 | P2 | Evaluation | Generic submission Spotlight reports Reviews 0 after completed review | confirmed |
| OS-014 | P1 | Evaluation | Accepted submissions disappear from Results and review export | confirmed |
| OS-015 | P2 | Evaluation | Bulk reviewer reminder has no success confirmation | confirmed |
| OS-016 | P2 | Decisions | Notification preview chooses first participant instead of primary speaker | confirmed |
| OS-017 | P2 | AI review | AI triage is exposed but unusable without a production key | confirmed |
| OS-018 | P1 | Speakers | Sparse CSV updates erase profile data absent from the file | confirmed |
| OS-019 | P1 | Speakers | Blank organizer contact is treated as a speaker | confirmed |
| OS-020 | P1 | Dates | Speaker task deadlines render one calendar day late | confirmed |
| OS-021 | P2 | Speakers | No editable travel/logistics or event custom field | confirmed gap |
| OS-022 | P2 | Tasks | List-level completion controls are too coarse | confirmed gap |
| OS-023 | P2 | Sessions | No direct Add session workflow | confirmed gap |
| OS-024 | P2 | Deliverables | File requests are buried in submission Spotlight, not Tasks | confirmed |
| OS-025 | P1 | Deliverables | Upload tracking is per session slot, not per speaker | confirmed |
| OS-026 | P1 | Deliverables | Dashboard completion counts misrepresent multi-speaker requirements | confirmed |
| OS-027 | P1 | Deliverables | No outstanding-deliverable bulk reminder workflow | confirmed gap |
| OS-028 | P0 | Publishing | Content approval does not gate public publication | confirmed |
| OS-029 | P1 | Agenda | Ten-minute Lightning Talks are illegal on the 15-minute grid | confirmed |
| OS-030 | P2 | Agenda | Auto-schedule error obscures the real duration incompatibility | confirmed |
| OS-031 | P1 | Widgets | Demo Roles button covers Get Code | confirmed |
| OS-032 | P2 | Widgets | Embed outputs are limited to URL and iframe | confirmed gap |
| OS-033 | P2 | Widgets | “Live” preview can remain stale until reload | confirmed |
| OS-034 | P3 | Widgets | Primary color appeared to revert after reload | needs reproduction |
| OS-035 | P3 | Widgets | Singular result reads “1 sessions” | confirmed |
| OS-036 | P3 | Itinerary | Removing a selection temporarily returns to All sessions | confirmed |
| OS-037 | P2 | CRM | Pipeline enrollment appears stale until reload | confirmed |
| OS-038 | P1 | CRM | Move dropdown resets before the Move action can execute | confirmed |
| OS-039 | P2 | CRM | Bulk-email dialog declares an implicit add-to-event side effect | needs verification |
| OS-040 | P3 | CRM | Pipeline enrollment omits score/rationale depth | confirmed gap |
| OS-049 | P3 | Widgets | Builder has no custom-CSS configuration | confirmed gap |
| OS-050 | P3 | Widgets | Saved-widget list lacks search, filtering, and format grouping | confirmed gap |
| OS-051 | P3 | CRM | CRM overview analytics are limited to pipeline/profile summaries | confirmed gap |
| OS-052 | P2 | Speaker tasks | General tasks target all speakers rather than an explicit subset | confirmed gap |
| OS-041 | Eval limitation | Email | Real delivery was not verified | unresolved manual evidence |
| OS-042 | Eval limitation | Exports | Downloaded CSV/ZIP/ICS payload contents were not opened | unresolved manual evidence |
| OS-043 | Eval limitation | Browser | Native picker fallback through Computer Use was not attempted | evaluation-process miss |
| OS-044 | Eval limitation | Evidence | Screenshots were not saved as a durable evidence bundle | process limitation |
| OS-045 | Eval limitation | Harness | LLM evaluator requires unavailable API credentials | harness limitation |
| OS-046 | Eval limitation | Harness | Evaluator README totals are stale relative to YAML | confirmed harness issue |
| OS-047 | Eval limitation | Fixture | Accidental headshot upload removed the intended mixed state | run deviation |
| OS-048 | Eval limitation | Codex browser | Production tabs closed when the task turn ended | host-tool limitation |

## Detailed issues

### OS-001 — New signup lands in an unauthorized seeded portal

**Severity:** P0 · **Area:** Authentication/onboarding · **Confidence:** confirmed  
**Formal rubric impact:** not directly scored, but can prevent all 98 items from being reached.

**Observed behavior:** A brand-new organizer signed up successfully and received a demo magic link
whose callback was `/onboarding`. Opening it authenticated the account but redirected to `/portal`
for **AI.Engineer Sandbox — NYC 2026**, where the page said **You do not have access**. Navigating
directly to `/onboarding` returned to the same inaccessible portal.

**Why it matters:** This is the most dangerous competition defect. A clean judge can reasonably
stop here and conclude that the product is unusable, even though the seeded organizer experience
is strong. It also leaks the existence/name of an unrelated seeded tenant into a new user's first
session.

**Likely fault line:** Post-auth routing selects a default event/portal before checking organization
membership or onboarding completion.

**Required fix:** Route authenticated users with no organization membership to onboarding before
resolving any event. Never choose a seeded event as a fallback.

**Acceptance:** A new email completes signup, lands on Create workspace, creates an organization,
and reaches an empty organization dashboard without seeing any seeded organization or event.

### OS-002 — Create organization is a no-op

**Severity:** P0 · **Area:** Organizations · **Confidence:** confirmed  
**Formal rubric impact:** outside the feature rubric, but blocks clean isolation and first use.

**Observed behavior:** The seeded organizer's organization menu exposes **Create organization**.
Activating it returns to `/admin`; no dialog, form, or onboarding route appears. The same failure
means neither a new user nor an existing organizer has a working path to a new workspace.

**Why it matters:** The evaluator had to mutate a uniquely named event inside the existing seeded
organization. That is a fallback, not a successful onboarding path. It weakens tenant-isolation
confidence and makes the product look like a fixed demo.

**Required fix:** Wire the action to a real create-workspace flow, create membership atomically,
select the new organization, and route to its empty dashboard.

**Acceptance:** An existing organizer creates a second organization, switches between both, and
sees no cross-organization events, contacts, or settings.

### OS-003 — Participant-role mismatch blocks every complete CFP submission

**Severity:** P0 · **Area:** CFP · **Confidence:** source-confirmed  
**Formal rubric impact:** CFP-05 fail; CFP-08 fail; CFP-09 partial; ABS-S1 fresh chain blocked.

**Observed behavior:** The public form displayed and accepted all required submission and speaker
fields, and the final review step showed the fixture data. Submit still rejected with **Primary
speaker requires between 1 and 1 participants**.

**Technical cause:** `participantForEmail` in
`apps/web/src/routes/submit.$eventSlug.$formId.tsx` hardcodes the participant role as `speaker`,
while the seeded form requires `Primary speaker` and also defines `Co-presenter`. The organizer
editor exposes enabled/min/max but not a repairable role mapping.

**Why it matters:** The core product loop—CFP → proposal → confirmation → review—cannot start from
a fresh speaker action. Seeded records conceal the breakage but do not mitigate it.

**Required fix:** Submit the selected participant definition's stable role ID, not a display label
or hardcoded string. Validate the form definition when publishing and refuse configurations the
public renderer cannot produce.

**Acceptance:** Priya submits the canonical proposal with one Primary speaker and one optional
Co-presenter; confirmation appears, the submission enters her portal, and identical data appears
for the organizer.

### OS-004 — Fresh CFP saves are non-atomic and can partially persist

**Severity:** P0 · **Area:** CFP/data integrity · **Confidence:** source-confirmed  
**Formal rubric impact:** CFP-01 partial; damages all fresh-start CFP evidence.

**Observed behavior:** The editor permanently reported **Save failed — retry** and toasted **Could
not save form fields**, yet changes to the form row—such as collection type, welcome copy, or
title—could survive reload.

**Technical cause:** The save path runs the form update and `forms.replaceFields(...)`
concurrently without a transaction. The form row can commit while field replacement fails.

**Why it matters:** The user cannot know which half of the configuration is authoritative. Retrying
can produce further divergence, and a published public form may not match the builder.

**Required fix:** Persist the form and complete ordered field set in one database transaction.
Return one revision/version and update the client cache only after commit.

**Acceptance:** Deliberately force field persistence to fail; neither form metadata nor fields
change. On success, both change together and reload to the exact saved revision.

### OS-005 — Fresh forms start with two Title fields

**Severity:** P1 · **Area:** CFP builder · **Confidence:** confirmed  
**Formal rubric impact:** contributes to CFP-01 partial.

**Observed behavior:** A newly created abstract form rendered two locked, required **Title** fields
instead of the expected Title plus Abstract/Description foundation.

**Why it matters:** This makes the generated public form semantically invalid before the organizer
does anything and suggests field seeding is using the wrong default definition twice.

**Required fix:** Define one canonical initial field set per collection type and cover it with an
integration test at both builder and public-renderer boundaries.

**Acceptance:** A new abstract CFP starts with one Title and one Abstract/Description field, unique
stable IDs, correct types, and no duplicate labels.

### OS-006 — Question type changes do not reliably apply

**Severity:** P1 · **Area:** CFP builder · **Confidence:** confirmed  
**Formal rubric impact:** contributes to CFP-01 partial.

**Observed behavior:** After adding an Abstract question and choosing **Long text**, the field still
presented as **Short text**. Required-toggle interaction also surfaced an unexpected conditional
editor, increasing doubt about which control state had changed.

**Why it matters:** Organizers can believe they configured long abstracts or another input type
while the public form enforces a different schema.

**Required fix:** Make type changes explicit, optimistic only after local schema validation, and
confirm the saved type after the mutation settles. Prevent unrelated panels from opening due to
event propagation or unstable row keys.

**Acceptance:** Change a field through short text → long text → dropdown, reload after each change,
and verify the builder and public form agree every time.

### OS-007 — Participant collection can be enabled with no usable questions

**Severity:** P1 · **Area:** CFP builder/validation · **Confidence:** confirmed  
**Formal rubric impact:** blocked CFP-S2 until the organizer manually added participant questions.

**Observed behavior:** The seeded form required exactly one Primary speaker while participant
collection had zero participant questions. The public speaker step rendered an empty card, Add was
disabled, and submission could not satisfy the participant minimum.

**Why it matters:** The product allows an internally contradictory published form. A speaker has
no action that can satisfy the rule.

**Required fix:** Publishing validation must require at least the identity fields needed to create
a participant whenever the minimum is greater than zero. Alternatively seed a standard participant
question set when collection is enabled.

**Acceptance:** The builder refuses to publish a participant requirement without usable questions
and explains exactly what must be added.

### OS-008 — Seeded description limit rejects the canonical fixture

**Severity:** P2 · **Area:** CFP defaults/demo readiness · **Confidence:** confirmed  
**Formal rubric impact:** slowed CFP-S2; recoverable through the builder.

**Observed behavior:** The canonical 386-character abstract was rejected because seeded
Description was a rich-text field with a 255-character maximum. The organizer had to raise it to
5,000 before the fixture could proceed.

**Why it matters:** A conference CFP with a 255-character abstract ceiling is implausibly strict,
and the competition's own canonical fixture fails the default demo.

**Required fix:** Use an intentional abstract default—at least 2,000–5,000 characters—and test the
seed against the evaluator fixture.

**Acceptance:** The canonical abstract submits without administrator repair while over-limit text
still produces clear validation.

### OS-009 — Application failures are returned inside HTTP 200 responses

**Severity:** P1 · **Area:** API/observability · **Confidence:** source-confirmed

**Observed behavior:** The failed CFP save was a `POST /_serverFn/...` with Worker outcome `ok`,
HTTP 200, no exception, and a typed application-level DbError inside the response.

**Why it matters:** HTTP monitoring, browser network panels, and platform alerting all report
success. Automated retries and operational dashboards cannot distinguish a saved form from a
failed one without parsing the entire application envelope.

**Required fix:** Map typed failures to truthful 4xx/5xx responses at the server-function boundary,
while retaining the typed client payload.

**Acceptance:** A forced persistence failure returns a non-2xx status, a stable public error code,
and a correlated server log entry.

### OS-010 — Database failure detail is swallowed

**Severity:** P1 · **Area:** Server observability · **Confidence:** source-confirmed

**Observed behavior:** Worker tail showed no exception or diagnostic log for the failed
`forms.replaceFields` operation. The public error envelope exposed only the generic repository
label; the underlying database error and failing field set were absent.

**Why it matters:** Production diagnosis required reading implementation source and inferring the
failure boundary. The next incident cannot be distinguished from validation, constraint, driver,
or transaction failures.

**Required fix:** Log the original cause server-side with request/ray ID, repository operation,
tenant/event/form identifiers, and safe structural metadata. Keep sensitive values out of logs.

**Acceptance:** A controlled failure produces one correlated structured error in Worker logs and a
safe client error code.

### OS-011 — Production emits React hydration error #418

**Severity:** P2 · **Area:** Runtime stability · **Confidence:** confirmed

**Observed behavior:** Browser console contained repeated minified React error `#418` hydration
messages. They were not the direct cause of the save failure, but they occurred in production.

**Why it matters:** Hydration mismatches can replace DOM, lose focus, duplicate effects, and make
interaction automation unreliable. They also obscure real client errors in console evidence.

**Required fix:** Reproduce with development React diagnostics, identify server/client markup
differences or invalid nesting, and make hydration clean on all auth/public/admin shells.

**Acceptance:** A clean navigation through onboarding, CFP editor, portal, agenda, widgets, and CRM
produces no hydration warnings.

### OS-012 — Reviewer assignment appears unsuccessful until reload

**Severity:** P2 · **Area:** Abstract evaluation · **Confidence:** confirmed

**Observed behavior:** Assigning SESS-1 to Sam succeeded in the backend and appeared in Sam's queue,
but the organizer table immediately returned to **0 assignments**. Reload later showed
**Assignments (1)**.

**Why it matters:** An organizer will repeat the action or assume assignment failed. In bulk
workflows this can create duplicates or accidental reassignment.

**Required fix:** Apply an optimistic cache update or invalidate/refetch the exact assignment query
after mutation. Display a stable success state tied to the returned assignment ID.

**Acceptance:** Assign a review and see the count, row, and progress update immediately without
reload; a failed write rolls back visibly.

### OS-013 — Submission Spotlight reports Reviews 0 after a completed review

**Severity:** P2 · **Area:** Abstract evaluation/data consistency · **Confidence:** confirmed

**Observed behavior:** Sam completed and submitted a full review that appeared in round Results,
but the generic submission Spotlight continued to show **Reviews · 0**.

**Why it matters:** Two organizer surfaces disagree about the same canonical review state. Users
cannot trust the convenient record-level summary.

**Required fix:** Derive all review counts from the same persisted review query and invalidate the
submission-detail cache when a review is submitted.

**Acceptance:** Reviewer completion updates Progress, Results, and submission Spotlight to the same
count immediately and after reload.

### OS-014 — Accepted submissions disappear from Results and review export

**Severity:** P1 · **Area:** Abstract evaluation/history · **Confidence:** confirmed  
**Formal rubric impact:** ABS-04 partial and ABS-10 partial.

**Observed behavior:** SESS-1 had a completed unequal weighted review that should aggregate to
3.33. After the submission was accepted, it vanished from the round Results table. Its assignment
remained visible in Progress, but the review and aggregate could no longer be viewed or exported
from Results. Export reported four submissions while excluding the accepted target.

**Why it matters:** Disposition is incorrectly acting like deletion from the evaluation record.
Historical review evidence is essential for auditability and later program decisions.

**Required fix:** Results must be round-scoped, not limited to currently pending submissions.
Status should be a filter/column, never an implicit exclusion.

**Acceptance:** Accept or decline a reviewed submission; its reviews, weighted aggregate, reviewer,
comments, and export row remain available with the new decision status.

### OS-015 — Bulk reviewer reminder has no success confirmation

**Severity:** P2 · **Area:** Abstract evaluation · **Confidence:** confirmed  
**Formal rubric impact:** ABS-09 partial.

**Observed behavior:** The organizer selected Sam and triggered the reminder. Selection cleared,
but no toast, queued count, delivery row, or history entry confirmed what happened.

**Why it matters:** Communication is a side effect; clearing selection is not sufficient proof. An
organizer cannot tell whether to retry.

**Required fix:** Return and display recipient count, queued/sent status, and a link to delivery
history.

**Acceptance:** Send one reminder and see `Queued 1 reminder for Sam Whitfield`, followed by a
persisted communication-history row.

### OS-016 — Notification preview chooses the first participant, not the primary speaker

**Severity:** P2 · **Area:** Decisions/communications · **Confidence:** confirmed

**Observed behavior:** The SESS-1 acceptance preview greeted Marcus because he was the first listed
participant even though Priya was labeled Primary speaker. Final email history did create separate
messages for both recipients.

**Why it matters:** The preview is the organizer's trust boundary before sending. Showing the wrong
person implies role ordering is ignored and can conceal incorrect personalization.

**Required fix:** Preview either the selected recipient explicitly or show a per-recipient preview
carousel. Never imply one preview represents all recipients when role-specific text can differ.

**Acceptance:** Primary-speaker preview greets Priya; switching to Marcus previews Marcus; final
delivery rows match both previews.

### OS-017 — AI triage is exposed but unusable without a production key

**Severity:** P2 · **Area:** AI evaluation · **Confidence:** confirmed  
**Formal rubric impact:** ABS-14 fail.

**Observed behavior:** AI evaluation rows were visible but explicitly produced no numeric score or
reasoning because an Anthropic key was not configured.

**Why it matters:** A visible feature that cannot run reads as unfinished. It also causes a direct
rubric failure when the product claims AI-assisted triage.

**Required fix:** Either configure the production capability with bounded usage and visible failure
handling, provide a deterministic demo mode for the competition, or hide the feature until ready.

**Acceptance:** Run AI evaluation on a submission, receive numeric score plus reasoning, override it
as a human, and retain both values distinctly after reload.

### OS-018 — Sparse CSV updates erase fields absent from the file

**Severity:** P1 · **Area:** Speaker import/data integrity · **Confidence:** confirmed

**Observed behavior:** CSV import correctly matched Priya and Marcus by email, but choosing Update
replaced fields not present in `speakers.csv`. Priya's existing Vegetarian dietary value and T-shirt
size M became **No dietary needs** and missing.

**Why it matters:** Normal partial imports silently destroy richer profile data. Organizers expect
missing columns to mean “leave unchanged,” not “clear.”

**Required fix:** Make sparse update semantics the default. Offer an explicit per-column mapping
choice for `Ignore`, `Replace`, or `Clear`, and preview destructive changes before import.

**Acceptance:** Import a CSV without dietary/shirt columns; existing values remain untouched.
Explicit Clear is the only path that removes them.

### OS-019 — Blank organizer contact is treated as a speaker

**Severity:** P1 · **Area:** Speaker roster/scoping · **Confidence:** confirmed

**Observed behavior:** The event roster contained a blank organizer-contact row. **All speakers**
task assignment and bulk communications included this record and sent/logged to
`jordan.organizer@...` as if it were a speaker.

**Why it matters:** Counts, completion rates, recipient totals, and costs are wrong. Real production
could send speaker communications to staff.

**Required fix:** Separate event membership from speaker/contact participation. Speaker groups must
require an explicit speaker role and a non-empty canonical contact.

**Acceptance:** Organizer-only members never appear in speaker roster, task assignments, progress,
or all-speaker email recipients.

### OS-020 — Speaker task deadlines render one calendar day late

**Severity:** P1 · **Area:** Dates/time zones · **Confidence:** confirmed

**Observed behavior:** Organizer dates Apr 1 and Apr 15 rendered in Priya's portal as Apr 2 and
Apr 16.

**Why it matters:** Deadline correctness is operationally critical. Speakers can miss contractual or
production deadlines, and automated reminders can fire on the wrong date.

**Likely cause:** Date-only values are being parsed/serialized as timestamps and shifted across the
event/user timezone boundary.

**Required fix:** Store date-only deadlines as date semantics or normalize consistently in the
event timezone. Do not pass them through browser-local midnight conversions.

**Acceptance:** The same due date renders identically for organizers and speakers in at least UTC,
PST/PDT, and IST browser zones.

### OS-021 — No editable travel/logistics or event custom field

**Severity:** P2 · **Area:** Speaker management · **Confidence:** confirmed gap  
**Formal rubric impact:** SPK-15 fail.

**Observed behavior:** Speaker Spotlight only displayed read-only **No travel or logistics notes**.
No organizer-editable travel preference, logistics field, or general event-level custom field was
found.

**Why it matters:** Conference speaker operations routinely need travel, accessibility, dietary,
arrival, and reimbursement details. The CRM has metadata depth, but the event speaker workflow
cannot use it directly.

**Required fix:** Add organization-defined typed fields or a focused logistics section on event
speaker records with portal/organizer visibility controls.

**Acceptance:** Create a logistics field, set it for Priya, reload, filter/report it, and optionally
allow Priya to update it in the portal.

### OS-022 — List-level task completion controls are too coarse

**Severity:** P2 · **Area:** Speaker task tracking · **Confidence:** confirmed gap

**Observed behavior:** The organizer list showed outstanding/done counts and a **Has outstanding**
filter, but no clean complete/incomplete split and no individual task titles at table level.

**Why it matters:** The round-trip technically passes, but an organizer cannot quickly answer
“Who has not signed the release?” without opening records or navigating elsewhere.

**Required fix:** Add task-specific columns/filtering or a matrix view with named task status.

**Acceptance:** Filter to speakers missing a selected task and bulk remind exactly that set.

### OS-023 — No direct Add session workflow

**Severity:** P2 · **Area:** Sessions/content setup · **Confidence:** confirmed gap

**Observed behavior:** Sessions only accepts graduated CFP submissions. There was no direct **Add
session** action, so the evaluator could not create the requested Marcus-only Lightning session
without fabricating a submission decision.

**Why it matters:** Real programs include invited keynotes, sponsor sessions, breaks, and late-added
content that never came through CFP.

**Required fix:** Support manual session creation with the same canonical session model and optional
speaker assignment.

**Acceptance:** Create a Marcus-only session directly, schedule it, collect files, and publish it
without creating a fake proposal.

### OS-024 — File requests are buried in submission Spotlight, not Tasks

**Severity:** P2 · **Area:** Speaker portal UX · **Confidence:** confirmed

**Observed behavior:** Priya's file requirements did not appear in the portal Tasks area. They were
inside the accepted submission's Spotlight panel.

**Why it matters:** Speakers naturally look at Tasks for outstanding work. Hiding deliverables in a
record drawer increases missed uploads and support burden.

**Required fix:** Show a unified actionable task list that includes general tasks and file requests,
while retaining the session-level file thread.

**Acceptance:** Portal home and Tasks show the presentation/headshot requirements with due dates,
status, and direct upload actions.

### OS-025 — Upload tracking is per session slot, not per speaker

**Severity:** P1 · **Area:** Deliverables/data model · **Confidence:** confirmed  
**Formal rubric impact:** CNT-07 partial.

**Observed behavior:** One outstanding row listed Marcus and Priya for a requirement. When Priya
uploaded, it became one uploaded row owned by Priya and Marcus's outstanding obligation vanished.

**Why it matters:** The product cannot represent speaker-specific deliverables for co-presented
sessions. Completion, ownership, reminders, and accountability are incorrect.

**Required fix:** Model requirement assignments independently from the session and create one
assignment per required speaker, with uploads/version threads attached to that assignment. Session-
shared requirements should be an explicit alternative mode.

**Acceptance:** Assign a headshot to Priya and Marcus; Priya's upload completes only Priya's row,
leaving Marcus outstanding and individually remindable.

### OS-026 — Dashboard completion counts misrepresent multi-speaker requirements

**Severity:** P1 · **Area:** Deliverables/reporting · **Confidence:** confirmed

**Observed behavior:** Deliverables reported **0 of 1 sessions uploaded** for a requirement assigned
to a two-speaker session, rather than two recipient assignments. After one upload, the shared slot
looked complete.

**Why it matters:** The dashboard presents a confident but wrong completion metric. This is more
dangerous than a missing metric because organizers may stop chasing an outstanding speaker.

**Required fix:** Count the unit actually assigned—speaker, session, or organization—and label the
metric accordingly. Do not show speaker names on a shared assignment if either can satisfy both.

**Acceptance:** The count reads 0/2 speakers, then 1/2 after Priya, then 2/2 after Marcus.

### OS-027 — No outstanding-deliverable bulk reminder workflow

**Severity:** P1 · **Area:** Deliverables/communications · **Confidence:** confirmed gap  
**Formal rubric impact:** CNT-08 fail.

**Observed behavior:** No reminder control was found in Deliverables or Files. General task reminders
and broad Communications rules exist, but neither selects the actual outstanding upload assignments.

**Why it matters:** Organizers must manually reconstruct recipient lists, and the shared-slot model
makes that reconstruction inaccurate.

**Required fix:** Add **Remind outstanding** at requirement and filtered-dashboard levels, with a
resolved recipient preview and delivery history.

**Acceptance:** After only Priya uploads, the reminder preview contains Marcus and excludes Priya;
sending records a one-recipient history row.

### OS-028 — Content approval does not gate public publication

**Severity:** P0 · **Area:** Content/publishing integrity · **Confidence:** confirmed  
**Formal rubric impact:** CNT-12 fail.

**Observed behavior:** SESS-3 remained pending/unapproved in Content but appeared on the public
agenda after agenda publication. Acceptance effectively made the content public; the separate
approval status did not control output.

**Why it matters:** Organizers can publish unreviewed titles, abstracts, headshots, or sensitive
content despite a UI that claims an approval workflow exists.

**Required fix:** Public program queries must require the effective approved content revision, not
only accepted/scheduled/published session state. Surface blocked-session counts before publication.

**Acceptance:** Schedule an unapproved accepted session and publish; it remains absent publicly.
Approve it; it appears without rebuilding the agenda. Revoke approval; it disappears or uses the
last approved revision according to a documented rule.

### OS-029 — Ten-minute Lightning Talks are illegal on the 15-minute grid

**Severity:** P1 · **Area:** Agenda · **Confidence:** confirmed

**Observed behavior:** The fixture's native 10-minute Lightning Talk could not be scheduled because
the grid rejected it with **Duration must use 15-minute increments**. The evaluator had to change
the agenda duration to 15 minutes.

**Why it matters:** Program library and agenda constraints disagree. A format the product allows
cannot be placed without silently changing its duration.

**Required fix:** Support the greatest-common scheduling increment needed by configured formats
(for example five minutes), or validate format durations when the library is configured.

**Acceptance:** A 10-minute session can be placed at 11:00–11:10, moved, conflict-checked, and
published without duration mutation.

### OS-030 — Auto-schedule error obscures the real duration incompatibility

**Severity:** P2 · **Area:** Agenda/AI assist · **Confidence:** confirmed

**Observed behavior:** Auto-scheduling the unscheduled 10-minute SESS-4 failed with **These criteria
do not have enough legal slots**. The real blocker was the 15-minute duration rule, not event
capacity.

**Why it matters:** The organizer is told to change constraints or capacity instead of fixing the
invalid duration. “AI” output appears arbitrary.

**Required fix:** Run deterministic preflight validation and report excluded sessions with exact
reasons before generating a draft.

**Acceptance:** The draft dialog says `SESS-4 uses 10 minutes; this agenda requires 15-minute
increments` and links to a repair action.

### OS-031 — Demo Roles button covers Get Code

**Severity:** P1 · **Area:** Widgets/global demo chrome · **Confidence:** confirmed  
**Formal rubric impact:** EMB-15 partial.

**Observed behavior:** In the widget editor's production viewport, the fixed bottom-right **Demo
roles** control sat directly over the primary **Get code** button. Pointer activation opened Demo
Roles instead of the embed output.

**Why it matters:** The primary handoff action of the widget builder is visibly present but
unusable. The same global utility can cover other bottom-right actions.

**Required fix:** Remove demo-role chrome from production or reserve layout space and collision-
test it against fixed/sticky controls. It must never overlay an interactive target.

**Acceptance:** Get Code is clickable at all supported viewport widths and zoom levels; automated
hit-target tests confirm the topmost element is the intended button.

### OS-032 — Embed outputs are limited to URL and iframe

**Severity:** P2 · **Area:** Widgets/distribution · **Confidence:** confirmed gap  
**Formal rubric impact:** EMB-15 partial.

**Observed behavior:** The builder generates a Share URL and iframe snippet. It does not offer the
evaluator's stronger format family: styled script/HTML, basic HTML, JSON, XML, or iCal feeds.

**Why it matters:** The feature is genuinely embeddable and renders correctly, but integrators have
little choice. It leaves a heavily weighted differentiator only partially satisfied.

**Required fix:** At minimum add documented JSON and iCal endpoints, with stable public URLs and
field/filter parity. Add script/basic HTML only if the product intends DOM-native embedding.

**Acceptance:** Each advertised format is retrievable anonymously, contains the filtered live data,
and remains consistent with the iframe/public surfaces.

### OS-033 — “Live” widget preview can remain stale until reload

**Severity:** P2 · **Area:** Widgets/cache feedback · **Confidence:** confirmed

**Observed behavior:** After selecting Platform & Infra, the builder said **Saved** and **Updates
live**, but the preview still showed all three sessions. Reloading the editor produced the correct
one-session filtered view.

**Why it matters:** Organizers may copy an embed while believing filters failed or publish an
unverified configuration. The label makes a stronger promise than the UI keeps.

**Required fix:** Update preview URL/state immediately from the draft or remount the iframe after a
successful save. Display Saving until both persistence and preview revision agree.

**Acceptance:** Toggle a track and see the preview result count change without reload; reload keeps
the same state.

### OS-034 — Primary color appeared to revert after reload

**Severity:** P3 · **Area:** Widgets · **Confidence:** needs reproduction

**Observed behavior:** Automation set the primary color input to `#166534` and the editor displayed
Saved. After returning to the widget, the color showed the default/black state instead.

**Why confidence is lower:** Color inputs can require a native change event that generic browser
fill APIs do not reproduce exactly. The companion text field was not the final interaction path.

**Required next step:** Reproduce manually using both the color picker and text field while
capturing before/reload evidence. If confirmed, ensure the option is included in the save payload
and normalized consistently.

**Acceptance:** Set a color manually, reload, reopen from the widget list, and verify both control
and rendered CSS variable retain it.

### OS-035 — Singular widget result reads “1 sessions”

**Severity:** P3 · **Area:** Public widgets polish · **Confidence:** confirmed

**Observed behavior:** The filtered widget header rendered **1 sessions**.

**Why it matters:** Small, but highly visible in a polished public surface and screenshot-based
competition.

**Required fix:** Use singular/plural-aware count copy.

**Acceptance:** Counts render `1 session` and `2 sessions` across sessions, itinerary, and schedules.

### OS-036 — Removing an itinerary selection temporarily returns to All sessions

**Severity:** P3 · **Area:** Public itinerary UX · **Confidence:** confirmed

**Observed behavior:** While viewing My Schedule, removing SESS-2 temporarily switched the visible
view to **All sessions**. Clicking **My Schedule (1)** again showed the correct remaining item.

**Why it matters:** The underlying selection persisted, but the navigation jump breaks the user's
mental model and makes removal appear to exit their schedule.

**Required fix:** Preserve the active view when its membership changes unless the view becomes
empty, in which case show an empty My Schedule state.

**Acceptance:** Remove one of two items and remain in My Schedule with the remaining card visible.

### OS-037 — CRM pipeline enrollment appears stale until reload

**Severity:** P2 · **Area:** Speaker CRM · **Confidence:** confirmed

**Observed behavior:** Adding Marcus produced **Contact added to pipeline**, but the board stayed at
five cards and the modal remained in a completed-looking state. Reload showed six cards and Marcus
in Prospect.

**Why it matters:** Success feedback conflicts with visible state and invites repeated enrollment.

**Required fix:** Close/reset the dialog and optimistically insert the returned card, or refetch the
board before displaying success.

**Acceptance:** Enrollment immediately adds one card, increments the stage/board count, closes the
dialog, and remains correct after reload.

### OS-038 — CRM Move dropdown resets before Move can execute

**Severity:** P1 · **Area:** Speaker CRM · **Confidence:** confirmed

**Observed behavior:** Selecting Contacted in Marcus's Move dropdown briefly enabled the adjacent
Move button, then the controlled value reset to Prospect and the button became disabled before it
could be used. Drag-and-drop successfully moved Prospect → Contacted → Confirmed and persisted.

**Why it matters:** The accessible/non-pointer alternative is broken. Keyboard users and anyone who
cannot drag have no reliable stage-transition workflow.

**Required fix:** Keep pending stage selection in stable card-local state; do not overwrite it from
query data until a move mutation settles or the user cancels.

**Acceptance:** Select a new stage, activate Move by keyboard or pointer, see immediate board change,
and retain it after reload.

### OS-039 — CRM email declares an implicit add-to-event side effect

**Severity:** P2 · **Area:** CRM communications/scoping · **Confidence:** needs verification

**Observed behavior:** The bulk-email dialog states: **Recipients are linked to the selected event
without duplicate entry.** The evaluator's action was to email two organization contacts, not
explicitly add them to the event roster.

**Why it may be a problem:** Communication and event enrollment are materially different actions.
Implicitly linking recipients can pollute event speakers, tasks, analytics, and future campaigns.

**Required next step:** Verify whether Sofía and Samira were actually added to DevFlow's event
contacts/speakers. If yes, split the actions or require an explicit checked confirmation.

**Acceptance:** Sending CRM email does not mutate event membership unless the organizer explicitly
selects **Also add recipients to event** and previews the consequence.

### OS-040 — Pipeline enrollment omits score/rationale depth

**Severity:** P3 · **Area:** Speaker CRM · **Confidence:** confirmed gap

**Observed behavior:** Enrollment supports a contact, starting stage, and free-text card note, but
not the evaluator's optional prospect score and structured rationale.

**Why it matters:** The pipeline passes its required rubric, but sourcing prioritization remains
qualitative and hard to sort/report.

**Required fix:** Only if competition time permits, add an optional score and rationale field and
surface score on cards/filtering. This is behind every P0/P1 item.

**Acceptance:** Enroll Marcus with score 85, retain it after stage moves/reload, and sort/filter the
pipeline by score.

### OS-049 — Widget builder has no custom-CSS configuration

**Severity:** P3 · **Area:** Widgets · **Confidence:** confirmed gap

**Observed behavior:** The configuration panel has a native color picker and a companion text input
whose placeholder is **Theme default**. Source inspection confirms that input edits
`primaryColor`; it is not a custom-CSS editor. No custom stylesheet field exists.

**Why it matters:** The evaluator explicitly looks for branding/colors and custom CSS. Color and
theme support are solid enough for basic embedding, but teams cannot adapt typography, spacing, or
surface treatment to a host site.

**Required fix:** Only if broader embedding depth is a priority, add scoped, sanitized CSS or a
documented token-based theming surface. Do not allow CSS to escape the embed root.

**Acceptance:** A saved style override changes only the generated embed, persists after reload, and
cannot affect the organizer shell.

### OS-050 — Saved-widget list lacks search, filtering, and output-format grouping

**Severity:** P3 · **Area:** Widgets · **Confidence:** confirmed gap

**Observed behavior:** The landing list shows widget name, view type, update date, enable switch,
and open action. It does not expose search, filtering, or output-format grouping.

**Why it matters:** This was explicitly observed because the evaluator asks about management depth.
It does not hurt a one-widget demo, but becomes noisy for organizations maintaining many event-
site placements.

**Required fix:** Defer until multiple formats or realistic widget volume exist. Then add compact
search and view/enabled filters; show format only if widgets can actually differ by format.

**Acceptance:** With 20 saved widgets, an organizer can locate one by name and filter by view and
enabled state without opening records.

### OS-051 — CRM overview analytics are limited

**Severity:** P3 · **Area:** Speaker CRM · **Confidence:** confirmed gap

**Observed behavior:** Overview has useful total contacts/events, open/won/lost, profile
completeness, pipeline distribution, and campaign history. It does not show the richer evaluator
examples such as top companies, source, region, areas of focus, or drill-through analytics.

**Why it matters:** CRM-12 still passes because populated pipeline distribution is a legitimate
analytics widget. This is competitive depth, not broken correctness.

**Required fix:** After core issues, add one or two genuinely actionable slices—top companies and
tag/area distribution—with click-through into the filtered directory.

**Acceptance:** Clicking a company or tag metric opens the directory with that criterion visibly
applied and counts consistent with the overview.

### OS-052 — General tasks cannot be targeted to an explicit speaker subset

**Severity:** P2 · **Area:** Speaker task assignment · **Confidence:** confirmed gap

**Observed behavior:** The three evaluator tasks used automatic **All speakers** assignment because
the creation path did not expose an explicit Priya + Marcus subset. This technically included both
required speakers, but it also assigned Dana and the blank organizer-contact row.

**Why it matters:** Organizers often need tasks for only keynotes, workshop hosts, or international
speakers. All-or-one-group assignment creates irrelevant work and amplifies OS-019.

**Required fix:** Add an assignee mode for selected speakers or filtered groups, with a resolved
recipient preview before creation.

**Acceptance:** Create one task for Priya and Marcus only; Dana and organizer members receive no
assignment, and the list/portal counts agree.

## Evaluation and evidence limitations

These items affected confidence or efficiency but are not established product failures.

### OS-041 — Real email delivery was not verified

**Type:** Eval limitation · **Affected areas:** CFP, speakers, reminders, CRM

The product displayed invitation/decision/campaign success states and logged recipient rows, but
fixture addresses were synthetic and no controlled mailbox was checked. Consequently, SPF/DKIM,
delivery, actual subject/body, and literal unresolved token behavior outside the app remain
unverified. This is why CRM-11 and automated-reminder evidence was graded conservatively.

**Close-out:** Add one controlled inbox contact, send each critical message type, and preserve the
received headers/body as manual evidence.

### OS-042 — Downloaded export payloads were not opened

**Type:** Eval limitation · **Affected areas:** review CSV, deliverables ZIP, itinerary ICS

The browser verified that export controls enabled, success states appeared, and downloads were
offered. The resulting files were not parsed or imported. Therefore column completeness, ZIP
folder structure, latest-version correctness, and ICS validity remain manual-only evidence.

**Close-out:** Save each download into a durable evidence folder, parse CSV/ZIP/ICS, and compare
contents to the canonical session data.

### OS-043 — Native picker fallback through Computer Use was not attempted

**Type:** Eval limitation · **Affected areas:** speaker CSV, headshot, slides

The in-app browser's restricted Playwright wrapper does not expose `locator.setInputFiles(...)`.
However, full Computer Use can potentially operate the macOS Open dialog owned by the Codex app:
focus the dialog, use `Command+Shift+G`, type the absolute fixture path, select it, and activate
Open. That fallback was not attempted during this run, and the user selected the fixtures manually.

This was an evaluation-process miss, not proof that native pickers require human assistance. The
resulting product states were still verified and remain valid. Future upload scenarios should try
Computer Use first, inspect the dialog after every action, and request human help only if macOS does
not expose the dialog through accessibility or an unexpected permission prompt appears.

### OS-044 — Screenshots were not saved as a durable evidence bundle

**Type:** Eval limitation · **Affected area:** all

Screenshots and DOM snapshots were inspected during the live run, but image files were not written
to `docs/eval-evidence/` and individually linked. The durable run record contains exact URLs,
values, timestamps, messages, and outcomes, but is not yet a screenshot-complete judge package.

**Close-out:** Reproduce the highest-severity and stale-state issues with named before/action/after/
reload screenshots and link them from this register.

### OS-045 — Official LLM evaluator could not run without API credentials

**Type:** Eval limitation · **Affected area:** harness

The evaluator expects an Anthropic API key. The run therefore used the same YAML scenarios and
rubric weights but executed and judged them manually through the signed-in production browser. The
89.4% score is a strict evidence-based hand grade, not an API-generated report.

### OS-046 — Evaluator README totals are stale relative to executable YAML

**Type:** Eval limitation · **Affected area:** harness metadata

The current YAML sums to 183 required item-weight points and 35 Public Widgets points. README prose
still reports 182 and 34. The manual score uses YAML as the source of truth. This discrepancy is in
the evaluator repository, not OpenSesh.

### OS-047 — Accidental headshot upload removed the intended mixed state

**Type:** Eval limitation · **Affected area:** content scenario

During native-picker coordination, the headshot requirement was also completed. That removed the
intended “slides complete, headshot outstanding” visual fixture. The more important product defect
was still independently proven: the session-shared assignment model removed Marcus's outstanding
row after Priya uploaded.

### OS-048 — Production tabs closed when the task turn ended

**Type:** Eval limitation · **Affected area:** Codex in-app browser

The host environment closed production browser tabs when an assistant turn finalized. The user had
to keep the task active while native pickers were open. This is a Codex desktop/browser lifecycle
constraint, not OpenSesh behavior.

## Items deliberately not classified as product defects

- Conflict creation was allowed rather than blocked, but both room and speaker conflicts were
  clearly flagged with exact explanations. The evaluator explicitly accepts visible flagging.
- The public agenda is a structured day/time list rather than a room-column grid. The rubric accepts
  an equivalent day/track/time structure, and the data/navigation were correct.
- The duplicate merge was not confirmed because it removes a seeded record. The comparison,
  primary selection, combined preview, and destructive warning all existed; lack of final evidence
  is a run-safety limitation, not proof that merge is broken.
- Speaker invitations and campaigns use demo/log delivery in this environment. In-app behavior
  passed; only external delivery remains unverified.
- The widget's generated iframe rendered correctly and consistently. OS-031/032 concern retrieval
  ergonomics and format depth, not whether the iframe itself works.

## Repair order

### Competition-critical first

1. OS-001 and OS-002 — make clean signup/workspace creation reliable.
2. OS-003 — unblock real CFP submission.
3. OS-004 through OS-007 — make fresh CFP construction atomic and internally valid.
4. OS-028 — enforce approval at the public query boundary.
5. OS-025 through OS-027 — correct the per-speaker deliverable model and reminders.
6. OS-014 — preserve evaluation history across decisions.

### Then remove trust-destroying behavior

7. OS-018 through OS-020 — prevent profile loss, ghost recipients, and deadline drift.
8. OS-009 through OS-013 — truthful errors, correlated logs, clean hydration, consistent caches.
9. OS-029/030 and OS-038 — make configured durations and accessible CRM moves actually usable.
10. OS-031/033/037 — eliminate controls and success states that lie about current UI state.

### Last-mile scoring and polish

11. OS-021/022/023/024 — logistics, task filtering, manual sessions, unified portal tasks.
12. OS-032 and OS-040 — embed/feed depth and optional CRM prioritization.
13. OS-035/036 — public-surface polish.
14. Reproduce OS-034 and OS-039 before assigning implementation work.

## Completion standard for this register

An issue is closed only when its acceptance test passes in production and the result is added to
the durable eval record. A code change, local test, or successful deployment alone is not closure.
