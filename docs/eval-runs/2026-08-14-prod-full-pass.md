# Production full evaluator pass — 2026-08-14

## Rules for this run

- Target: `https://app.opensesh.io`
- Dataset: `/tmp/killmysaas-evals/fixtures/sample-data.json`
- Rubric: all 20 scenarios and 98 items in `/tmp/killmysaas-evals/specs/*.yaml`, including optional Speaker CRM
- Tenant isolation: create a new organization and event; do not reuse, reconcile, reset, or mutate prior evaluator/demo tenants
- Identities: fresh Gmail plus-addresses derived from `baidyaprithvish1102@gmail.com`
- Scoring: only executed rubric criteria receive verdicts; blocked checks are `cannot_judge`, never invented failures
- Evidence: durable observations and exact URLs here; screenshots are optional for this rerun per the user

## Identity plan

Run key: `osfull-20260814-0024`

- Organizer: Jordan Alvarez — `baidyaprithvish1102+osfull-20260814-0024-org@gmail.com`
- Speaker: Priya Raman — `baidyaprithvish1102+osfull-20260814-0024-priya@gmail.com`
- Speaker 2: Marcus Okafor — `baidyaprithvish1102+osfull-20260814-0024-marcus@gmail.com`
- Reviewer: Sam Whitfield — `baidyaprithvish1102+osfull-20260814-0024-reviewer@gmail.com`

## Progress

| Scenario | Status | Evidence / result |
|---|---|---|
| CFP-S1 | Passed except conditional-field setup | Fresh workspace/event, metadata, library, public form, second event, and hard cross-event record isolation verified |
| CFP-S2 | Passed core; edit persistence pending | Speaker auth, draft/resume, validation, two submissions, confirmations and portal listing passed |
| CFP-S3 | Passed | Reviewer invited, exactly one proposal assigned, blind role isolation and persisted scorecard verified |
| CFP-S4 | Passed | Review aggregation, decisions, branded email dispatch, submission→session handoff, closed public state, and edit-lock message passed |
| ABS-S1 | Partial coverage | Three proposal/session records exist, but the fixture co-author edit was not completed in this isolated run |
| ABS-S2 | Passed core | Two independent persisted rounds with different scorecards; round 1 reviewer pool/assignment/progress/reminder passed |
| ABS-S3 | Partial coverage | Blind review storage, organizer aggregate table/progress, and byte-inspected results export passed; the second assigned review remains incomplete |
| SPK-S1 | Partial coverage | Two-speaker roster, manual add, exact identity fields, search, and one auto-assigned general task passed; remaining task templates/import not yet executed |
| SPK-S2 | Partial coverage | Priya real portal auth, participation confirmation, own-session/task scoping, and admin-route denial passed; native file upload is currently tool-blocked |
| SPK-S3 | Partial coverage | All-speaker audience resolved exactly 2 speakers, personalized preview passed, and 2-recipient campaign was queued with per-recipient history |
| CNT-S1 | Passed | Distinct Priya/Marcus sessions and both exact deliverable requirements exist; dashboard shows 2 sessions x 2 requirements, all outstanding |
| CNT-S2 | Partial; upload cannot_judge | Portal lists both requirements with exact due dates and constraints; admin access redirects to portal; browser bridge did not emit its file-chooser event |
| CNT-S3 | Partial; upload-dependent checks cannot_judge | Bulk reminders, editing/history, approval gating and exports passed; file thread/version/ZIP checks depend on the tool-blocked upload |
| AIA-S1 | Passed core; explicit conflict injection unexecuted | Multi-day grid, rooms/tracks, three sessions, persisted conflict-free placement and zero-conflict result passed |
| AIA-S2 | Passed | Greedy draft generated, proposed earliest conflict-free slot, accepted one change, published, and handed off anonymously |
| EMB-S1 | Passed | Three populated public session cards, two speakers, facets, title/speaker search, detail, show-more, agenda/itinerary/gallery surfaces verified |
| EMB-S2 | Passed | Exact two-session selection, My Schedule view, reload persistence, remove controls, and byte-inspected two-event ICS passed |
| EMB-S3 | Passed | Widget builder, live preview, customization, share URL, iframe, and unauthenticated JSON/ICS payloads verified |
| CRM-S1 | Passed core | Org-level directory, 3 contacts, persisted search/filter segment, note, tag, canonical profile, and activity passed; merge not yet executed |
| CRM-S2 | Passed core | Configurable kanban, Marcus enrollment, persisted stage transition/history, event reuse without duplication, and consistent analytics dashboard passed; CRM campaign pending |

## Findings

Only confirmed behavior from this isolated tenant is recorded below.

- **CFP-S1 pass · Isolated tenant and exact event metadata.** Created `Full Eval 20260814 0024` and `DevFlow Conf 2027`; event settings persisted May 12–14, 2027, Moscone West, San Francisco, CA, tagline, and description.
- **CFP-S1 pass · Program library.** Persisted three tracks, five formats with durations, four rooms, and Beginner / Intermediate / Advanced levels.
- **CFP-S1 pass · Public deadline and clean rich text.** Public URL `https://app.opensesh.io/submit/devflow-conf-2027/mjjpaLePo3BIWNnS-aj7p` renders the welcome copy without literal `<p>` markup and shows `Closes Apr 30, 9:00 AM GMT+5:30`.
- **CFP builder friction · Condition source only permits earlier form questions.** The evaluator asks `Workshop prerequisites` to depend on Format, but creating Workshop prerequisites before Format meant Format was absent from its source selector. Reordering/creating Format first is required; this is builder dependency ordering, not yet scored as a product failure.
- **CFP-S2 pass · Real speaker authentication.** A new plus-address speaker requested and received a production magic link and returned to the same CFP authenticated.
- **CFP-S2 pass · Draft persistence.** Entering only the first fixture title, returning to Account, and reopening showed `SESS-1 · draft` with a Resume affordance and retained the title.
- **CFP-S2 pass · Required validation.** Continuing with Description and Key takeaway empty produced explicit `Description is required` and `Key takeaway is required` errors.
- **CFP-S2 pass · Confirmation content fixed.** The completed proposal reached `Submission received`; the success text rendered as ordinary rich text (no literal HTML) and explicitly said confirmation was sent to the speaker plus address.
- **CFP-S2 pass · Two-proposal dashboard.** The speaker portal listed exactly SESS-1 and SESS-2, both pending.
- **CFP-S3 pass · Default evaluator criteria.** A new round started prefilled with Originality, Relevance, Recommendation (Accept/Maybe/Reject), and Comments; all remained editable/removable.
- **CFP-S3 pass · Assignment scoping.** Sam Whitfield was assigned only SESS-1; SESS-2 remained explicitly Unassigned.
- **CFP-S3 pass · Reviewer authorization and blind state.** Sam's production account exposed only `My Reviews`, exactly one assigned proposal, and no participant identity. Originality 4, Relevance 4, Accept, and the fixture comment persisted; progress changed to `0 pending · 1 completed`.
- **CFP-S4 pass · Review round-trip.** Organizer spotlight showed Sam, timestamp, both numeric 4s, Accept, and the exact fixture comment.
- **CFP-S4 pass · Decision and email previews.** Accepted SESS-1 with publication approval and declined SESS-2; both dialogs rendered branded, resolved email previews and queued one decision email each.
- **CFP-S4 pass · Submission→session handoff.** Accepted SESS-1 immediately exposed `View session` linking to the Sessions spotlight; its decision surface now directs future cancellation to Sessions.
- **AIA-S1 pass · Builder structure.** Agenda exposes all three exact event days, a 15-minute time grid, four room columns, an unscheduled pool, track filter, list view, and conflicts view.
- **AIA-S2 pass · Greedy solver.** `Auto-schedule` created a reviewable `Balanced v1` draft and proposed SESS-1 at the earliest conflict-free slot with an explicit rationale. Accepting the selected change placed the session; the live agenda remained untouched until acceptance.
- **AIA-S2 pass · Publication handoff.** The organizer state changed to `Published`; anonymous `/e/devflow-conf-2027/agenda` showed the session at 8:00–8:30 AM in Main Stage with Priya Raman.
- **EMB discovery pass.** Anonymous public navigation exposes Sessions, Speakers, Agenda, Itinerary, and Speaker Gallery as distinct surfaces.
- **EMB-S1 pass · Cross-surface consistency.** Sessions, Agenda, and Itinerary consistently show SESS-1 on Wed May 12, 8:00–8:30 AM, Main Stage, Priya Raman. Speakers list and gallery consistently show Priya Raman with one session.
- **EMB-S2 pass · Anonymous personal itinerary mechanics.** Adding the session on Agenda updated Itinerary to `My Schedule (1)` and rendered a pressed Remove control. `Export ICS` reported `Downloaded devflow-conf-2027-my-schedule.ics`.
- **Fixture/data gap · Speaker title/company.** The fixture supplied Priya's title/company, but this CFP only collected biography, so public speaker surfaces truthfully render `Title not provided · Independent`. This is a planning/default-field gap and will reduce filled-state quality unless profile fields are completed later.
- **EMB-S3 pass · Full widget builder.** Sessions widget supports filters, theme/time/color, seven field toggles, custom CSS, enable state, a live populated iframe preview, and stable CSS hook documentation.
- **EMB-S3 pass · Generated outputs.** Share URL and iframe snippet reference `/embed/4QW7mkAr1wwq-IvFPkAK1`; JSON `/json` and Calendar `/ics` feed endpoints were generated. The in-app browser blocked direct navigation to the JSON feed with `ERR_BLOCKED_BY_CLIENT`; this is `cannot_judge` for payload contents, not a product failure.
- **CNT-S1 pass · Two distinct programmed sessions.** Added Marcus Okafor's direct session `Lightning: Agents in Production Q&A` as Lightning Talk / AI Engineering. Its session detail explicitly says `Added manually — there is no submission to decline` and offers cancellation, confirming the intended post-acceptance content model.
- **CNT-S1 pass · Requirements expand across sessions.** `Upload Session Presentation` (May 1, PDF, 50 MB) and `Upload Final Headshot (print quality)` (Apr 14, PNG/JPG, 10 MB) now apply across the distinct Priya and Marcus sessions.
- **SPK/CNT pass · Real portal and hard authorization boundary.** Priya's real production magic link reached a portal containing only her accepted/declined submissions, SESS-1 files, and own tasks. Direct navigation to `/admin` redirected to `/portal`.
- **CNT-S2 cannot_judge · Actual upload/version workflow.** The portal exposed the correct `.pdf · 50 MB` constraints and opened the product upload control, but the selected in-app browser bridge did not emit a file-chooser event even when the actual `input[type=file]` was clicked. This is evaluation-tool friction, not a product failure; versioning/comments/export remain unscored in this run until a file can be selected.
- **CRM-S1 pass · Org-level canonical directory.** The organization workspace persisted Priya, Marcus, and Dana with email/title/company/bio; search narrowed 3 contacts to Priya and restored correctly. A dynamic `AI Experts` segment persisted one member.
- **CRM-S1 pass · Contact depth.** Priya's canonical profile persisted the `AI` tag and exact internal note with Jordan Alvarez and timestamp. The same surface exposes typed metadata, event/session links, pipeline, campaign history, and a chronological activity feed.
- **CRM-S2 pass · Event reuse.** Adding Priya's canonical CRM contact to DevFlow Conf 2027 reported `without duplicate entry`, preserving CRM/event separation.
- **CRM-S2 pass · Configurable sourcing pipeline.** Configured Prospect / Contacted / Confirmed / Declined stages, enrolled Marcus with rationale and score 85, moved him Prospect → Contacted, reloaded, and verified both card position and attributed timestamped transition history persisted.
- **CRM-S2 pass · Analytics.** Overview exactly matched the directory: 3 contacts, 1 event reached, 1 open pipeline card, 86% profile completeness, correct top-company counts, and the AI tag count.
- **CFP-17/18 pass · Multi-event and isolation.** Created `Forward Summit 2028`; the switcher showed it alongside DevFlow. Forward Summit's Submissions surface rendered its own empty first-submission state while DevFlow retained 3 submissions, proving event-plane isolation.
- **CFP-04/16 pass · Closed-state enforcement.** Turning `Form open` off persisted after delay/reload. The public URL then rendered only `Submissions are closed — This form is no longer accepting new or updated submissions.` This explicitly covers both new and updated submissions.
- **Cross-event portal retest passed with a fresh speaker session.** An earlier shared browser/auth state rendered `No portal to show` after switching events, but requesting a fresh Priya magic link subsequently landed directly in the correct DevFlow speaker portal with her submissions, sessions, tasks and profile. The earlier state is not retained as a confirmed product defect because it did not reproduce in a clean speaker authentication.
- **ABS-01/03 pass · Independent review rounds.** Added and reloaded `Final Review` at position 2 with its own numeric `Final Score` scorecard, while round 1 retained four weighted numeric/dropdown/long-text criteria and blind review. The rounds remained independently listed with distinct criteria counts and reviewer pools.
- **SPK task-depth pass · Three general tasks.** Templates now show `Confirm participation`, `Complete bio and profile`, and `Sign speaker release form`, all contact-scoped, auto-assigned across both speakers, and manually completable. The aggregate lifecycle count updated to 0 of 6 complete.
- **CNT editing/history pass.** Two organizer title edits were saved, attributed to Jordan Alvarez with timestamps and approval state, persisted across reload, and the exact original title was restored for later scenarios.
- **Export verification pass · Sessions CSV.** Downloaded `sessions (1).csv` is 363 bytes with a valid header and two records. It contains SESS-3/Marcus/manual/active and SESS-1/Priya/May 12/Main Stage/approved/CFP/active.
- **Export verification pass · Personal ICS.** Downloaded `devflow-conf-2027-my-schedule (3).ics` contains one complete VEVENT with stable UID, `DTSTART:20270512T023000Z`, `DTEND:20270512T030000Z`, exact title, `LOCATION:Main Stage`, escaped/folded description, public session URL, and `STATUS:CONFIRMED`.
- **EMB feed verification pass.** Unauthenticated curl of the generated widget JSON and ICS endpoints returned SESS-1 with exact title, speaker, schedule, room, description, and public URL. This supersedes the earlier browser-client-only `cannot_judge` note for feed payloads.
- **SPK communications pass.** `All speakers` resolved exactly Priya and Marcus (not declined-only submitters or all submissions). Merge fields resolved Marcus's name, exact session title, event name, and portal link in the branded HTML preview. Sending queued two rows with exact recipients and per-recipient delivery state/history.
- **AIA populated solver pass.** With three programmed sessions, a fresh draft proposed all three: SESS-4 Room 2A at 8:00, SESS-3 Main Stage at 8:00, and moved SESS-1 to Main Stage at 8:15. The proposal gave per-row reasons, changed nothing until acceptance, then persisted after reload with `Conflicts 0`; republish succeeded.
- **EMB full populated-state pass.** After publication approval, the public Sessions surface rendered exactly 3/3 sessions with title, code, time, room, speaker/title/company, track, format, descriptions where supplied, Show more, Track/Format/Room facets, and search. `Marcus` narrowed the result to exactly SESS-3; detail showed full time, room, tags, and speaker bio.
- **EMB itinerary/ICS pass.** Added exactly SESS-4 and SESS-1; `My Schedule (2)` persisted across full reload and showed only those two chronologically. Export produced `devflow-conf-2027-my-schedule (4).ics`; byte inspection found exactly two VEVENTs with correct distinct UIDs, May 12 start/end times, summaries, Room 2A/Main Stage locations, URLs, and confirmed status.
- **ABS aggregate/export pass.** The organizer results table showed SESS-1 at 1/1, recommendation Accept, aggregate 4.00, and SESS-2 at 0/1. `evaluation-devflow-round-1.csv` downloaded successfully and byte inspection confirmed both rows, reviewer identity, exact stored criterion values/comment, weighted aggregate, recusal column, and completed/pending states.
- **ABS progress truthfulness pass.** The progress dashboard currently reports Sam Whitfield at 2 assigned, 1 completed, 0 recused, 1 remaining, 50%, matching the stored reviews rather than presenting a stale 2/2 state.
- **Task reminder/email pass.** Selected both speakers with outstanding general tasks and queued exactly two reminders. Production Gmail received Priya's branded `3 outstanding tasks for DevFlow Conf 2027` email; the rendered subject/body contained no literal `<p>` markup.

## Current strict assessment

No penalty is assigned for unexecuted/cannot-judge checks. Based only on direct evidence in this tenant, the production product is operating in the **mid/high 90s on the required browser rubric**, with the optional CRM also strong. A single precise headline score is withheld because the file-upload/version branch is tool-blocked and the explicit agenda-conflict injection was not completed; presenting either as a product failure would be false.

Confirmed product defects / remaining score risks:

1. **CFP conditional logic is order-dependent and was not successfully configured in this run.** The controlling Format question must precede Workshop prerequisites; the builder does not help reorder/recover the dependency during setup.
2. **Accepted CFP metadata can be incomplete if the form/operator maps it incorrectly.** This run's accepted SESS-1 feed has no format/track because the evaluator selected the wrong options earlier; the app preserved exactly what was submitted. This is not scored as a product defect, but the default form should make Track/Format mapping harder to miss.
3. **File upload/version/comment/ZIP branch is cannot-judge here.** The product exposes correct constraints and controls, but the in-app browser bridge never emits the chooser event and this browser wrapper does not expose direct file-input assignment. No product failure is claimed.
4. **Explicit speaker/room conflict warnings are not re-executed in this tenant.** The solver produced a valid 3-session, zero-conflict schedule and persisted it; negative conflict injection remains unscored rather than failed.
5. **The exact ABS co-author scenario is incomplete in this tenant.** The product code and portal surfaces support multiple submission participants and role labels, but Marcus was not added to Priya's existing CFP submission during this run. This criterion is unexecuted here, not a confirmed product failure.
6. **Two exact general-task deadlines were not persisted.** All three required general tasks exist and expanded to both speakers. Priya's portal shows Confirm participation due Apr 1, but `Complete bio and profile` and `Sign speaker release form` show `No due date` instead of Apr 1 and Apr 15. This is a real fixture mismatch in this isolated run; due-date support itself works.
7. **Reviewer completion is honestly partial.** Sam has 2 assigned / 1 completed / 1 remaining and the results CSV agrees. The second evaluation was not submitted after the shared browser session reverted to organizer auth; it is not scored as a product failure.

Directly verified exports/endpoints:

- `/Users/prithvishbaidya/Downloads/sessions (1).csv`
- `/Users/prithvishbaidya/Downloads/evaluation-devflow-round-1.csv`
- `/Users/prithvishbaidya/Downloads/devflow-conf-2027-my-schedule (4).ics`
- `https://app.opensesh.io/embed/4QW7mkAr1wwq-IvFPkAK1/json`
- `https://app.opensesh.io/embed/4QW7mkAr1wwq-IvFPkAK1/ics`
