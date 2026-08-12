# Production Manual Eval Run — 2026-08-12 V3

Fresh, durable, resumable manual execution of the complete SessionBoard Eval Kit against the current OpenSesh production deployment. V2 evidence is used only as a regression checklist; every V3 verdict requires new production evidence.

## Run identity

- Status: **COMPLETE — manual read/write production pass**
- Started: 2026-08-12 07:59:09 IST
- Target: <https://app.opensesh.io>
- Evaluator checkout: `/private/tmp/killmysaas-evals`
- Evaluator commit: `2b0f7956ab0c6f4868d41356e495b3a225badaab`
- Evaluator inventory: 98 rubric items, 20 scenarios, 86 required items plus 12 optional CRM items
- Execution: direct browser walkthrough and manual grading; no evaluator API keys
- Evidence: [`docs/eval-evidence/2026-08-12-v3`](./eval-evidence/2026-08-12-v3)

## Safety and evidence rules

- Production UI only. Do not inspect production storage, credentials, cookies, or database rows.
- Use only evaluator fixture identities and content. Do not merge or delete plausible real records.
- Capture failures at action time, including visible state and console output where available.
- Distinguish product defects, fixture/default gaps, environmental configuration, and controller limitations.
- Use ordinary Chrome and the native macOS picker for uploads when the in-app browser chooser is unavailable.

## Scenario ledger

| # | Scenario | Status | Evidence / note |
|---:|---|---|---|
| 1 | CFP-S1 — build and publish CFP | tested, 1 defect | Libraries, branding, required fields, max two speakers and close behavior pass. Saved Workshop condition is ignored by the public renderer. Evidence 001–004, 020–021. |
| 2 | CFP-S2 — speaker draft, submit, edit | pass | Fresh draft/resume, validation, submit, receipt, email log and post-submit edit all persisted. Evidence 005–009. |
| 3 | CFP-S3 — reviewer assignment and scoring | tested, 2 defects | Blind review and scoring pass. Assignment counts are stale until reload; reviewer overview exposes event-wide metrics/recent submissions. Evidence 011–015. |
| 4 | CFP-S4 — decisions, notifications, handoff, close | pass with UI concern | Accept/decline and email log pass; closed form and edit lock pass. Decline dialog keeps an `Accept` tab visually emphasized. Evidence 018, 020–023. |
| 5 | ABS-S1 — submissions with co-author | pass | Priya primary plus Marcus co-presenter, exact values and organizer visibility verified. Evidence 007–009. |
| 6 | ABS-S2 — rounds, pools, assignments, reminders | partial | Two rounds, round-scoped pool, cap and exact assignments pass. The already-complete reviewer left no safe lagging-reviewer reminder case to exercise without changing the canonical queue. Evidence 011–015. |
| 7 | ABS-S3 — blind scoring, aggregates, export | pass except AI environment | Canonical weighted aggregate, both sorts, human/organizer identity contrast, recusal control and CSV export success toast pass. AI first pass remains deployment-disabled by the missing Anthropic key. Evidence 016–017 and final working log. |
| 8 | SPK-S1 — roster and onboarding tasks | pass | Three fixture speakers imported (2 updated, Dana created), search, profile detail, organizer edits, invitation, three dated onboarding tasks. Evidence 024–030. |
| 9 | SPK-S2 — speaker onboarding | pass | Speaker-only portal scope, bio/headshot edit and organizer approval, general task completion, requested headshot upload, presentation upload and two versions all persisted. Evidence 032–040. |
| 10 | SPK-S3 — progress and bulk communications | pass | Mixed list-level progress, personalized three-speaker welcome campaign, campaign history, automated reminder run and outbound mail log verified. Evidence 046, 092–095. |
| 11 | CNT-S1 — content collection setup | pass | Exact headshot and presentation requests, instructions, due dates, file types, size cap and assignment cardinality verified. Evidence 031, 038. |
| 12 | CNT-S2 — upload and version deliverable | pass | Native fixture uploads work; two presentation versions, exact cross-role comments and previous-version access verified. Evidence 033–042. |
| 13 | CNT-S3 — track, approve, export | pass | Central edits, attributed history/restore, admin profile/headshot editing, filters, latest-version ZIP generation and public approval gate all pass. Evidence 043–049, 057 observation. |
| 14 | AIA-S1 — agenda and conflicts | pass | Multi-day/room grid, new Overflow Room, exact placements, speaker double-booking and room overlap warnings, conflict resolution and reload persistence pass. Evidence 050–055. |
| 15 | AIA-S2 — auto-schedule and publish | pass | Reviewable AI draft made no live changes until selective acceptance; one placement accepted, calendar invites sent, agenda published successfully. Evidence 055–056 plus working log. |
| 16 | EMB-S1 — public browse surfaces | pass | All browse surfaces are anonymous. Sessions list/search/facets/expand, speaker list/search/detail, agenda days/detail and gallery fallback/search/detail pass. Evidence 062–072, 078–080. |
| 17 | EMB-S2 — itinerary | pass | Chronological multi-day itinerary, two-session personal schedule, reload persistence, ICS export success and removal all pass anonymously. Evidence 073, 075–076. |
| 18 | EMB-S3 — widget builder and consistency | pass | Five types, filters, fields, theme/color/custom CSS, enabled state, live preview, saved listing, iframe/share URL, JSON and ICS feeds verified. Evidence 058–061. |
| 19 | CRM-S1 — directory and enrichment | pass except safe merge completion | Org-level 28-contact directory, search, company filter, dynamic segment, persisted note/tag and duplicate warning pass. Merge confirmation intentionally not executed. Evidence 081–085. |
| 20 | CRM-S2 — pipeline and reuse | pass except new CRM campaign | Pipeline stages, Marcus enrollment/move/reload, note/history and overview KPIs pass. Existing event reuse is intact; the event-level welcome campaign was exercised, but a second CRM-directory campaign was not sent. Evidence 086–092. |

## Working log

### Checkpoint 0 — evaluator freeze

- Evaluator commit matches the V2 run, so score deltas reflect production behavior rather than spec drift.
- V3 evidence directory and ledger created before production mutations.

### Checkpoint 1 — CFP, submission and review

- Confirmed the event library has the evaluator's 3 tracks, 5 formats with durations, 4 rooms and audience levels.
- Added and saved required `Key takeaway` plus conditional `Workshop prerequisites`; the condition is correctly represented in the builder but the public Talk form still renders the Workshop field.
- Created a new title-only draft, resumed it, observed required-field errors, completed the canonical proposal with Priya plus Marcus, submitted it, observed the exact receipt and confirmation email, then edited and reloaded the proposal successfully.
- Created `Forward Summit 2028` and verified creator access plus event isolation; the prior P0 creator lockout is fixed.
- Assigned and submitted two blind reviews with canonical scores/comments. Weighted result `3.33` and comparison result `5.00` are correct, with ascending/descending sorting.
- Accepted `SESS-5`, declined `SESS-2`, sent both notifications, moved the CFP close date into the past, and verified the public closed state plus read-only speaker submission detail.
- Content approval is now a real separate state: accepted `SESS-5` is Approved while three other accepted sessions are explicitly `Awaiting approval`. Public-gate proof will be completed after agenda publication.

### Checkpoint 2 — speaker roster and organizer onboarding

- Created three manual auto-assigned tasks for Priya and Marcus: confirm participation, complete bio/profile, and sign release, with the evaluator due dates.
- Organizer search, detail, dietary/shirt data, session links and task due dates render. Organizer bio/workflow/travel edits survived reload. Invitation generated the expected portal link and email-history entry.
- Native fixture upload path is functional through ordinary Chrome. `speakers.csv` mapped all five columns automatically, detected two matches as Update, created Dana, and reported `Created 1 · Updated 2 · Skipped 0`.
- Import did not duplicate Priya or Marcus and produced the expected three-person roster.

### Checkpoint 3 — speaker portal, tasks and files

- Speaker login showed only Priya's own sessions, tasks and profile. A direct `/admin` attempt redirected to the portal and exposed no organizer controls.
- Priya changed her bio with sentinel `SBEK-PORTAL-BIO-01`, uploaded `headshot.png`, submitted the profile for approval and completed the two canonical general tasks. The organizer approved the pending revisions and the final organizer record shows the sentinel plus a real headshot.
- Created exact deliverables `Upload Final Headshot (print quality)` and `Upload Session Presentation`, including the fixture instructions, due dates, accepted extensions and 25 MB limit.
- Uploaded `slides.pdf`, added exact comment `Draft deck - final version coming Friday.`, uploaded a second version, and verified both versions with the latest clearly marked. Jordan's reply `Thanks - please confirm the final version by Tuesday.` is visible across roles.
- Assignment board shows Priya `3 done / 1 outstanding`, Marcus `0 done / 4 outstanding`, and Dana `0 done / 1 outstanding` without opening individual records.

### Checkpoint 4 — content administration and approval gate

- Central session content editing persisted the exact live-demo sentence. A second revision was created, the previous revision was restored, and the restored state persisted with editor/timestamp history.
- Organizer-side bio and headshot edits persisted. The central files library filters by speaker, shows version metadata and exposes per-file download controls.
- Multi-select ZIP generation reached `Ready · 2 latest versions` with Session-code grouping and an enabled Download ZIP action.
- Published the agenda while only SESS-5 was content-approved. The anonymous agenda showed exactly that one session, proving unapproved accepted sessions were excluded. After `Approve all`, the same public URL updated without republishing and showed all four scheduled approved sessions.

### Checkpoint 5 — agenda, conflicts, AI assist and publication

- Added `Overflow Room`; scheduled SESS-5 at May 12 10:00 AM / Room 2A, SESS-2 at May 12 2:00 PM / Room 2B and SESS-3 at May 13 11:00 AM / Room 2B.
- Deliberately produced four simultaneous warnings: one same-room overlap plus three speaker double-booking combinations. Each warning named sessions, speaker, room(s), time and reason.
- Moving the sessions cleared the counter to `Conflicts 0`; a full reload preserved all placements.
- Generated AI draft `Balanced evaluator pass`. It proposed five individually selectable changes with current/proposed slots and reasons while explicitly leaving the live agenda untouched. Selected only SESS-4 and accepted one change successfully.
- Calendar invites moved from `4 of 4 need invites` to `0 of 5 need invites`; each scheduled speaker/session generated an ICS-bearing outbound-mail record. Publish reported `Agenda published`.

### Checkpoint 6 — anonymous public program and embeds

- All five required surfaces are readable without login or organizer privilege: Sessions, Speakers, Agenda, Itinerary and Speaker Gallery.
- Sessions show all required anatomy. Search `Taming` returned `1 of 4`; search `Raman` returned `3 of 4`; Track/Format/Room facets are present and Platform & Infra narrowed to SESS-5.
- Speaker directory and gallery both show Marcus Okafor then Priya Raman (surname order). Priya has a headshot; Marcus uses a stable initials fallback. Details show bio plus complete dated/roomed session lists.
- Agenda day one contains three time-ordered sessions; day two contains SESS-3. Detail shows title, exact range, room, track, format, description and speakers, then closes back to the intact agenda.
- Personal schedule stored SESS-5 plus SESS-2, survived a full reload, exported `devflow-conf-2027-my-schedule.ics`, and updated correctly when one item was removed.
- Saved widget `DevFlow Sessions Embed` filtered to Platform & Infra. Verbatim share URL:
  `https://app.opensesh.io/embed/eGhm-BqZh6Zn2R0D8kYGW?view=sessions&theme=auto&color=default&time=12h&tracks=trk_devflow_platform&formats=&days=&tags=&company=1&title=1&bio=0&description=1&level=1&format=1&calendar=1`
- Verbatim iframe:
  `<iframe src="https://app.opensesh.io/embed/eGhm-BqZh6Zn2R0D8kYGW?view=sessions&theme=auto&color=default&time=12h&tracks=trk_devflow_platform&formats=&days=&tags=&company=1&title=1&bio=0&description=1&level=1&format=1&calendar=1" title="DevFlow Sessions Embed" width="100%" height="640" style="border:0" loading="lazy"></iframe>`
- JSON feed returned HTTP 200, CORS `*`, one correct SESS-5 record and speaker/session metadata. ICS feed returned HTTP 200, `text/calendar`, attachment disposition and the correct May 12 10:00–10:30 Room 2A event.

### Checkpoint 7 — optional cross-event CRM

- Organization-level CRM contains 28 contacts across two events, searchable and filterable by company/title/tag. Latticework Systems narrowed to one Priya record; saved dynamic segment `AI Experts` reopens with one member.
- Priya's contact profile shows canonical identity, four linked event sessions, activity, a persisted `AI` tag and the exact internal note `Met at DevFlow 2026 - strong on CI topics; shortlist for keynote.` after reload.
- The directory visibly reports `Review duplicates 1`. Per the run safety rule, the destructive merge confirmation was not executed against two plausible different Priya records.
- Enrolled Marcus into Prospect with the platform-engineering rationale, moved him to Contacted, reloaded and confirmed persistence. His detail shows timestamped `Not in pipeline → Prospect → Contacted` history and persisted note `Left voicemail 2027-01-15; follow up next week.`
- CRM overview reports 28 contacts, 2 events, 3 open, 1 won, 1 lost and 90% profile completeness with populated company/tag widgets.

### Checkpoint 8 — communications and automation

- Sent the three-speaker campaign `Welcome to DevFlow Conf 2027 speakers` with `{speaker_name}`, `{event_name}`, `{talk_title}` and `{portal_url}` tokens. Dana preview resolved to real name/event/portal data; history records 3 recipients and timestamp.
- Temporarily enabled the automated task-reminder rule with a 365-day window, ran it, observed the updated Last run time, and verified three new outbound `Task reminder` rows at the same timestamp. Restored the rule to its original disabled / 3-day configuration afterward.
- Retested evaluation CSV export: the product reported `Exported 5 submissions`. V3-007 is resolved for the automated/manual criterion; file-content inspection remains a manual-download check.

## Issue register

| ID | Severity | Kind | Surface | Summary | Evidence | Status |
|---|---|---|---|---|---|---|
| V3-001 | P1 | product defect | Public CFP | `Workshop prerequisites` is visible when Format is Talk even though its saved condition is Format = Workshop. | 002, 006 | open |
| V3-002 | P2 | product defect | Evaluation assignments | Assignment tab/count remains stale immediately after assigning; reload reveals the correct assignment. | 011 | open |
| V3-003 | P1 | authorization/scoping | Reviewer overview | Reviewer has no organizer controls, but `/admin` exposes event-wide KPIs and all recent submission titles/statuses rather than a reviewer-scoped home. | 012–015 | open |
| V3-004 | P3 | UI clarity | Decline dialog | Rejection preview/action is correct, but the `Accept` mode label remains visually emphasized in the decline flow. | 018 | open |
| V3-005 | P2 | environment/configuration | AI first pass | Feature is present but disabled with `Anthropic key not configured`; cannot earn the AI-assisted evaluation item in this deployment. | 016 | open |
| V3-006 | P2 | product/automation compatibility | Authentication | In-app-browser persona switches repeatedly required a second submit because the first submit cleared email and showed `Invalid email`; ordinary Chrome succeeded first try. | working log | open |
| V3-007 | P3 | verification gap | CSV export | Export now reports `Exported 5 submissions`; the controller still cannot inspect the downloaded blob contents. | working log | resolved for auto; manual payload check remains |
| V3-008 | P2 | product defect | mutation feedback/cache | Several successful mutations render stale data until reload: task/request renames, content history after save/restore, new CRM pipeline enrollment, evaluation assignment counts, and agenda invite counts. Persistence is sound, but immediate UI trust is inconsistent. | 011, 038, 044, 055, 086 | open |
| V3-009 | P2 | fixture/default gap | sparse CSV speaker | Dana's evaluator CSV supplies name/email/title/company/bio only. She consequently has no headshot/social/logistics defaults and remains low-readiness; automation should treat absent fields as unspecified rather than blocking. | 029–030, 093 | open |
| V3-010 | P3 | controller limitation | screenshots | The in-app browser screenshot method returns bytes; passing a `path` option silently does not persist them. Later evidence was explicitly written to disk, leaving some intermediate states documented in the working log but not as standalone files. | evidence directory | mitigated |
| V3-011 | P3 | product/UX | sessions facets | Facets are always expanded rather than behind the evaluator's expected `Filters` control. Functionality is stronger (Track, Format, Room all visible and working), but compact/mobile presentation may become noisy. | 062, 066 | open |
| V3-012 | P3 | product/UX | automated reminders | `Run now` changes to `Running…` and later updates Last run, but there is no immediate sent-count toast. Delivery is only obvious after opening Email delivery. | 094–095 | open |

`V3-007` retest result: **resolved for auto scoring** — `Export CSV` produced the visible success confirmation `Exported 5 submissions`. The browser controller still did not expose the downloaded blob for payload inspection.

## Strict manual rubric score

This is a conservative evaluator-style score, not a claim that the API-key harness ran. Unexercised destructive CRM merge and the environment-disabled AI reviewer receive no invented credit; the downloadable evaluation CSV receives functional credit from the production success confirmation but not manual payload-validation credit.

| Area | Area weight | Items | Manual score |
|---|---:|---:|---:|
| Call for Papers | 20 | 18 | **18.9 / 20** (conditional logic fails; reviewer landing is partially scoped) |
| Abstract Management | 20 | 14 | **17.8 / 20** (real-time progress partial; reminder unexercised; AI disabled) |
| Speaker Management | 15 | 16 | **14.8 / 15** (bio/headshot roundtrip proven; social-link mutation not repeated) |
| Content Management | 15 | 14 | **15.0 / 15** |
| AI Agenda | 10 | 8 | **10.0 / 10** |
| Public Widgets | 20 | 16 | **20.0 / 20** |
| **Required headline** | **100** | **86** | **96.5 / 100** |
| Speaker CRM (optional) | +10 | 12 | **9.2 / 10** (merge and second CRM-directory campaign not executed) |

### Fixture integrity and scoring caveats

After rechecking the evaluator text, the ordinary fixture interactions below are **not reward hacking and did not bypass product defects**. They are the literal scenario actions or expressly permitted chained-run setup. The `96.5` remains a fair evaluator-style score for the automated/UI criteria observed. A stricter human score may be around **95–96** only because of the explicit unverified manual halves and unexercised branches listed later—not because uploading version two, approving content, or changing fixture state was illegitimate.

#### Required scenario actions — not workarounds

- Changing CFP dates, decisions, content approvals, agenda placements and publication state is the purpose of the chained evaluation.
- SESS-2 was declined for the decision scenario and later accepted for the named agenda/conflict scenario. This used the product's supported reversible decision workflow; it did not bypass a defect.
- The widget scenario explicitly instructs the evaluator to approve every scheduled session when the earlier content scenario leaves only one approved session. Using `Approve all` followed that precondition exactly.
- The versioning scenario explicitly asks for another upload. Re-uploading the supplied `slides.pdf` fixture is sufficient to prove that a second persistent version is created; a distinct second fixture is not supplied.
- The speaker-profile headshot and requested-file headshot are two independently scored workflows, so uploading `headshot.png` in each place is expected.
- The CRM scenario explicitly allows skipping a second CRM import when the contacts from the earlier speaker CSV import already appear in the organization directory. Observing that propagation was compliant with the scenario.
- Temporarily changing the configurable reminder window to include the future-dated fixture tasks, running the rule, verifying timestamped deliveries, and restoring the setting exercised a real supported configuration. It was not a workaround for a broken send. The remaining manual question is whether the scheduled/background cycle fires at the configured time without `Run now`.

#### Actual product workarounds encountered

- Successful mutations sometimes remained visually stale until a full reload. Reloading was necessary for assignment counts, content history, task/request names, CRM enrollment and agenda invite counts. This is the real cross-surface product defect recorded as V3-008; persistence itself was correct.
- Some in-app-browser sign-ins cleared the email on first submit and succeeded on retry. Ordinary Chrome did not reproduce it. This is recorded as V3-006 rather than counted as a clean authentication pass.
- The conditional Workshop field could not be made correct through normal configuration. It remains a direct product failure and receives no credit under CFP-02.
- The reviewer landing exposed event-wide titles/KPIs. It is explicitly scored partial rather than treated as acceptable reviewer isolation.

#### Controller workarounds, not product successes

- Native file selection required ordinary Chrome plus macOS Computer Use. The product's real file input worked; the in-app browser controller could not attach through its chooser.
- Public JSON and ICS feeds were validated with read-only `curl` after the browser blocked direct JSON navigation. This validates the deployed endpoints, but not a user clicking and opening those payloads inside the browser.
- The browser screenshot API returned bytes and silently ignored a supplied filesystem path. Representative states were revisited and explicitly persisted, but some moment-in-time states—most notably the one-session approval-gate view—exist only as direct observations in the working log.

#### Criteria whose manual halves remain unverified

- Evaluation CSV: success toast observed; downloaded CSV contents and headers were not opened and checked.
- Bulk ZIP: generation reached Ready with the correct count/grouping; archive contents were not opened and compared.
- Personal/widget ICS: HTTP payload shape and download success were observed; files were not imported into a calendar application.
- Embed: the anonymous iframe URL rendered directly, but the snippet was not installed on a genuinely separate third-party origin.
- Email: demo-mode outbound records exist; no external fixture inbox was inspected.
- File download/version history: both version controls are visible and responsive, but downloaded version bytes were not compared.

#### Incomplete or interpretation-sensitive scoring calls

- Reviewer reminder remains unexercised because Sam had already completed the canonical two-item queue. Creating a new lagging assignment would have invalidated the exact-queue evidence.
- Speaker bio and headshot mutation were proven end-to-end, but social-link mutation was not repeated in V3; SPK-08 is already partial.
- The public directory/gallery contained only two publishable speakers, not the scenario's requested three-card observation sample. The rubric's actual pass criteria do not impose a three-card minimum, so this is not a fixture workaround, but the evidence sample is smaller than ideal.
- Widget generation offers iframe/share URL, JSON and ICS plus configuration, but no separate basic-HTML or XML output was observed. EMB-15 received full automated credit because multiple live formats and a rendered anonymous embed exist; a stricter reference-parity grader could deduct partial credit.
- CRM event reuse was verified from existing linked Marcus/Priya data rather than pushing another new contact into the event in V3.
- CRM duplicate detection was observed, but merge was intentionally not confirmed against two plausible distinct Priya records. CRM-06 is partial.
- The event-level speaker campaign was sent; a second campaign originating from CRM directory selection was not sent. CRM-11 is unexercised in V3.

#### Honest confidence statement

No additional **hard product failure** was observed on the paths actually traversed. That is not evidence that no other problems exist. The run did not exhaust every browser, viewport, concurrency condition, payload download/import, real-mail delivery, third-party embed origin, or destructive CRM branch. The issue register is exhaustive for observed problems and explicit verification gaps—not exhaustive for all latent defects in the product.

### Item-level disposition

- **CFP:** pass `01,03–09,11–18`; fail `02`; partial `10`.
- **Abstracts:** pass `01–07,10–13`; partial `08`; unexercised `09`; environment-disabled `14`.
- **Speakers:** pass `01–07,09–16`; partial `08` only because social-link editing was not repeated in V3.
- **Content:** pass `01–14`.
- **AI Agenda:** pass `01–08`.
- **Public Widgets:** pass `01–16`.
- **Speaker CRM:** pass `01–05,07–10,12`; partial `06`; unexercised `11` in the CRM-specific surface.

## Evidence integrity and remaining manual halves

- **84 durable screenshots** are present in the V3 evidence directory. They cover every required area and all five anonymous widget surfaces.
- Production was exercised only through product UI/public HTTP feeds. No production database, storage bucket, credentials, cookies or server secrets were inspected.
- No contacts, sessions, files, widgets or events were deleted. No plausible real contacts were merged. Fixture-address mail only was sent.
- Still manual outside this controller: open the downloaded evaluation CSV and ZIP; import the personal-schedule/widget ICS files into a calendar app; place the iframe on a separate origin; verify actual external inbox delivery rather than the product's demo-mode outbound log.
