# Production Eval — Isolated Round 02

## Run identity

- Status: complete; findings frozen before fixes
- Product baseline: `0f14d57`
- Production Worker: `960ceb39-a97e-4716-9061-baf4d2dd567f`
- Evaluator baseline: `killmysaas-evals@8109958`
- Target: `https://app.opensesh.io`
- Evidence: `docs/eval-evidence/2026-08-12-isolated-r2/`

## Isolation contract

- This round starts in a brand-new workspace created only for Round 02.
- No product state, screenshots, observations, or score evidence from Round 01, V3,
  or any other evaluation are reused.
- Each evaluation is a clean-room run. Current fixtures are never reconciled against
  V3 or any prior run, and missing current-run state is never filled from earlier data.
- A run may resume only its own workspace and evidence; it may not resume, merge, or
  compare product state from another evaluation.
- Only the authoritative evaluator spec and fixture definitions are shared.
- The seven evaluator areas run in their specified order because scenarios within
  this round intentionally chain state.
- Product fixes are forbidden until all Round 02 scenarios finish and this round's
  issue register is frozen.
- Every workaround, confusion, missing fixture default, console error, network error,
  or stale content surface is recorded even when its rubric item ultimately passes.

## Round workspace

- Workspace: `SBEK Isolated Round 02` (`sbek-isolated-r2-20260812`)
- Primary event: `DevFlow Conf 2027`
- Secondary event: `Forward Summit 2028`
- Organizer: fresh Round 02 administrator identity
- Speaker: Priya Raman fixture identity
- Reviewer: Sam Whitfield fixture identity
- Attendee: Alex Attendee fixture identity

## Scenario ledger

| Area | Scenario | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| Call for Papers | CFP-S1 | Completed with deferred checks | `004`–`010` | Public form options, conditional rendering, and empty validation require an account; deferred to CFP-S2 as permitted. |
| Call for Papers | CFP-S2 | Completed | `011`–`025` | Two proposals submitted; draft resume, validation, conditional fields, edit persistence, and dashboard statuses verified. |
| Call for Papers | CFP-S3 | Failed | `026`–`029` | Assignment persisted in admin, but the exact reviewer account sees `No reviews assigned`; score submission and organizer round-trip are blocked. |
| Call for Papers | CFP-S4 | Completed with failed review prerequisite | `030`–`038` | Accept/reject, notifications, session handoff, closed portal, speaker statuses, and edit lock passed. Organizer review round-trip could not pass because CFP-S3 produced no review. |
| Abstract Management | ABS-S1 | Completed with co-author failure | `039`–`041` | Three submissions exist. New-submission participant step can add speakers, but an existing submission cannot add/edit participants and no participant role selector exists; Marcus could not be added to SESS-1. |
| Abstract Management | ABS-S2 | Completed | `042`–`047` | Two independent rounds, distinct scorecards/pools, exact two assignments, cap, 0/2 progress, and reminder dispatch all persisted. No AI-evaluation feature is claimed or present. |
| Abstract Management | ABS-S3 | Failed | `048`, `152` | Exact reviewer still sees `No reviews assigned` after two persisted assignments; review submission, score storage, aggregates, sort, completion progress, and COI are blocked. The organizer results export control exists independently. |
| Speaker Management | SPK-S1 | Completed | `049`–`059` | Manual profiles, CSV import, search/filter, Confirmed persistence, organizer bio sentinel, existing session link, 3×2 tasks, and portal invitation all passed. |
| Speaker Management | SPK-S2 | Completed | `060`–`066` | Portal scoping/session, current-round bio/social/headshot update, reload persistence, exact due dates, and 2-complete/1-open task state passed. |
| Speaker Management | SPK-S3 | Completed | `067`–`071` | Portal edits/headshot round-tripped, list-level mixed progress, download control, 5-recipient merged campaign/history, and travel data persistence passed. |
| Content Management | CNT-S1 | Completed with manual-session metadata caveat | `072`–`074` | Two sessions/two speakers and 2×2 incomplete deliverables with dates/constraints passed; direct session creation omitted track and auto-approved publication. |
| Content Management | CNT-S2 | Completed | `075`–`079` | Constraints, upload, cross-role comment, two accessible versions/current marker, task status, speaker scoping, and admin redirect passed. |
| Content Management | CNT-S3 | Completed with caveats | `080`–`084`, `153`–`154` | Organizer progress/reminders, central file review, cross-role thread, content/profile versioning and restore, native headshot replacement, latest-only ZIP export, and canonical-title restoration passed. Public approval gating was later proven; directly created SESS-4 could not be made unapproved. |
| AI Agenda | AIA-S1 | Completed | `155` plus working log | Four-room/multi-day builder, exact placements, live speaker and room conflict detection, conflict clearing, and reload persistence all passed. Transient conflict screenshots were not durably saved; final published placements were recaptured from this run. |
| AI Agenda | AIA-S2 | Completed with approval-gate handoff caveat | `155`–`160` | AI draft proposed and placed the remaining session in one accepted change; publish succeeded. The approval gate was verified before all four sessions were approved for public-widget checks. |
| Public Widgets | EMB-S1 | Completed | `156`–`159` plus working log | All four browse surfaces work anonymously: sessions search/facets/expansion, speaker list/search/detail, two-day agenda/detail, and gallery/search/detail. Stable final surfaces were recaptured from this run. |
| Public Widgets | EMB-S2 | Completed | `160` plus working log | Anonymous chronological itinerary, two-session personal schedule, reload persistence, ICS export, and single-session removal passed. Final one-session state was recaptured. |
| Public Widgets | EMB-S3 | Completed | `161`–`163` | Saved live widget supports all five view types, rich filters/fields/theme/CSS, iframe/share/JSON/ICS outputs, and a reachable non-admin rendered URL. |
| Speaker CRM bonus | CRM-S1 | Completed | `164`–`166` plus working log | Org directory, native CSV mapping/import, search/filter, dynamic segment, notes/tag/history, five-stage pipeline configuration, duplicate detection and primary-preserving merge passed. |
| Speaker CRM bonus | CRM-S2 | Completed | `165`–`166` plus working log | Two stage moves persisted, note/history persisted, add-to-event reuse passed, overview analytics and personalized two-contact campaign/history passed. |

## Working observations

Record facts here during the round. Do not convert them into fixes until the scenario
ledger is complete.

1. Fresh organization creation succeeded.
2. Fresh event creation succeeded with the repeated fixture name `DevFlow Conf 2027`;
   this confirms the Round 01 cross-organization slug collision is repaired in production.
3. The month/year dropdowns make May 2027 directly reachable. After a future date is
   selected, reopening the picker shows August 2026 instead of the selected May 2027
   month. The stored date remains correct, but the calendar view is disorienting.
4. Public CFP URL: `https://app.opensesh.io/submit/devflow-conf-2027-2/jvYrGNGIKAOsYs4vscG6T`.
5. The Program library exposes five identical accessible buttons named only `Add`.
   Their section context is visual but absent from each accessible name. Browser
   automation accidentally added `Platform & Infra` as a format while targeting the
   track control; the stray row was deleted and the correct track then created. This
   is an agent/accessibility trap even though the visual sectioning is understandable.
6. The public CFP loads logged out with event name and `Closes Apr 30, 9:00 AM PDT`.
   Continuing immediately gates on a magic-link account, so dropdown, conditional,
   and required-validation checks were deferred to CFP-S2 exactly as the spec permits.
7. Signing in through `Demo roles` resets the active organization/event to the seeded
   AI.Engineer workspace. The agent must manually switch back to `SBEK Isolated Round
   02` after every persona sign-in or it will silently act on unrelated seeded data.
8. Multi-event creation works. `Forward Summit 2028` appeared alongside `DevFlow Conf
   2027`, and its Submissions page was empty. Immediately after creation, the switcher
   button showed Forward Summit while the open list marked DevFlow as selected; the
   Forward Summit submissions page nevertheless loaded the correct empty event scope.
9. The library has separate `Name` and `Duration` controls, while the evaluator fixture
   presents each format as a single label such as `Talk (30 min)`. Entering that exact
   fixture label plus duration causes the public form to render `Talk (30 min) (30 min)`.
   This is an evaluator trap: the organizer must infer that the product expects the bare
   name `Talk` even though the instruction says configure the labels exactly. The names
   were corrected to bare names before submission so public options match the fixture.
10. Drafts are implicit autosaves rather than an explicit `Save draft` action. Leaving
    the form after entering only a title produced `SESS-1 · draft`, and resuming restored
    the title. This satisfies the behavior but an evaluator searching only for a named
    save control could incorrectly report the feature absent.
11. First submission confirmation wording: heading `Submission received`; body
    `Thank you. Your submission has been received.` It does not claim that an email
    was sent, although confirmation email was enabled in form settings.
12. Both submitted proposals show status `pending` in Priya's portal. The second newly
    submitted proposal immediately shows `Edits pending approval` even though it was
    not edited after submission, while the first proposal's deliberately edited
    abstract does not show that badge in the two-row list. The approval-state messaging
    appears reversed or otherwise inconsistent.
13. Organizer detail correctly round-trips both proposals and the appended `Updated:`
    sentence. Its activity/email history proves a demo confirmation email was sent with
    recipient and title, satisfying the manual email evidence despite the confirmation
    page omitting that claim.
14. Reviewer provisioning accepts only email and assignment cap. It has no name field,
    so the fixture reviewer is displayed as `sbek-reviewer`, not `Sam Whitfield`. The
    copyable access path is only the generic `/login`; usable access requires knowing to
    request a second demo magic link from that page.
15. Admin assignment shows exactly one persisted assignment: SESS-1 →
    `sbek-reviewer · pending`; SESS-2 remains unassigned. Signing in through the generated
    reviewer email opens the correctly reviewer-only `My Reviews` shell but shows
    `No reviews assigned`. Reloading does not repair it. No seeded reviewer or invented
    assignment was substituted, so CFP-S3 review submission is a genuine failure.
16. Accepting SESS-1 generated a decision email, created exactly one session without
    re-entry, and carried over the title, Priya Raman, and `Platform & Infra`. Rejecting
    SESS-2 generated the separate rejection email. The organizer list persisted the
    distinct `Accepted` and `Declined` statuses; the evaluator says Rejected, but treats
    an unambiguous equivalent as acceptable on the speaker side.
17. Moving the close date to Aug 11, 2026 saved successfully. Logged out, the public
    URL shows `Submissions are closed` and `This form is no longer accepting new or
    updated submissions.` with no submission entry point.
18. Priya's isolated Round 02 portal shows the CI proposal as `accepted` and the AI
    proposal as `declined`. Opening the accepted submission after closure shows
    `This submission form is closed. Your content is now read-only.` and exposes no
    editing fields or save action.
19. CFP-S4's organizer-side review check remains a real failure inherited from CFP-S3:
    there is no Sam Whitfield rating/comment to display because the assigned reviewer
    queue was empty. The rest of CFP-S4 completed without substituting seeded state.
20. ABS-S1 reopened the same Round 02 CFP by moving its close date to Aug 31, 2026.
    Priya's existing accepted SESS-1 detail allowed content edits but exposed no
    participants/co-author section, so Marcus Okafor could not be added to the required
    existing proposal. No admin or seeded-data substitution was used.
21. A fresh submission's Participant step does support `Add speaker`, but every card is
    generically labeled `speaker` and there is no role selector. This proves multi-speaker
    entry exists only during creation, not the post-submit edit path required by ABS-S1,
    and role labels such as Co-author/Co-presenter cannot be assigned.
22. The third fixture proposal was submitted once, not duplicated. Its required `Key
    takeaway` has no value in the evaluator fixture, so the run supplied the minimal
    sensible value `A checklist for building retrieval-grounded documentation sites under
    $50/month`; this fixture gap is recorded rather than treated as product data.
23. Priya's Round 02 dashboard now shows exactly three proposals: SESS-1 `accepted`,
    SESS-2 `declined`, and SESS-3 `pending`. The newly submitted SESS-3 again immediately
    shows `Edits pending approval` despite no post-submit edit.
24. ABS-S2 persisted two independent rounds after reload: blind `Initial Review`
    (Aug 1–Oct 15, four weighted/type-varied criteria, Sam pool) and identified `Final
    Review` (Oct 16–Nov 30, Final Score 1–10 plus Comments, empty independent pool).
25. Initial Review now assigns exactly SESS-1 and SESS-2 to `sbek-reviewer`, leaving
    SESS-3 unassigned. The reviewer cap remains 5 from CFP-S3. Progress accurately shows
    2 assigned, 0 complete, 2 remaining, 0%.
26. `Send reminders (1)` produced a new email-log row to the exact reviewer fixture:
    subject `Initial Review: 2 pending reviews`, status `Demo`. The progress screen itself
    gave no durable success state after the action, but the product's email delivery log
    proves dispatch.
27. No AI evaluation/triage capability or AI-review claim appears anywhere in the Round
    02 evaluation configuration, assignments, progress, or results surfaces, so ABS-14 is
    not applicable under its own rubric rather than failed.
28. ABS-S3 retried the exact reviewer identity after Initial Review dates and assignments
    were corrected. The reviewer-only shell still shows `No reviews assigned`; therefore
    this is not stale setup from CFP-S3. Per the spec, the reviewer scenario stops here.
    No review values, aggregate scores, sort states, completion progress, COI action, or
    export were fabricated through an organizer or seeded account.
29. SPK-S1 started with Priya already present through the accepted Round 02 submission.
    Her organizer profile was completed with title/company, set to `Confirmed`, and given
    the exact `SBEK-ORG-EDIT-01` bio sentinel; reload preserved all three. Her existing
    SESS-1 session link was already present and required no duplicate session.
30. Marcus was manually added using the `sbek-speaker2@example.com` fixture identity.
    Native browser upload of the authoritative `speakers.csv` then mapped name/email/title/
    company/bio and completed with `Created 3 · Updated 0 · Skipped 0`. The CSV's own
    Priya/Marcus emails differ from sample-data's runtime fixture emails, so it created
    duplicate-name contacts plus Dana; the rubric explicitly permits this. Dana appearing
    brought the roster to five records.
31. Roster search narrowed to both Priya-name records and cleared successfully. The
    `Confirmed` workflow filter narrowed to only the manually linked Priya; her status and
    title/company persisted.
32. Three manual-completion tasks were created with exact dates and assigned only to the
    original Round 02 Priya/Marcus contacts, not the CSV duplicates: Confirm participation
    (Apr 1), Complete bio and profile (Apr 1), Sign speaker release form (Apr 15). The
    assignments board shows each target at 3 outstanding / 0 done. It shows aggregate counts,
    not task titles/due dates, at list level; those live in task/portal detail.
33. Priya's explicit `Invite` action reported `Sent 1 invitation`, provided `/portal`, and
    persisted an email/activity row `Your speaker portal for DevFlow Conf 2027` with status
    `demo`.
34. SPK-S2's portal is speaker-facing and scoped: Priya's identity, three own submissions,
    accepted SESS-1, and three own tasks are visible; Marcus and Dana appear nowhere.
35. The profile initially said `Replace headshot`, indicating the reused fixture login may
    carry a global profile asset from outside this new organization. That pre-existing asset
    was explicitly excluded from evidence. The run replaced it through the native picker
    with this round's authoritative `headshot.png`; the product reported `Headshot saved as
    a new version`, displayed `headshot.png`, and the rendered image persisted on reload.
36. Priya's portal edit persisted `SBEK-PORTAL-BIO-01`, LinkedIn, X/Twitter, and the new
    current-round headshot. This deliberately re-establishes profile evidence inside Round 02
    despite the global fixture identity being reusable across organizations.
37. The portal listed exact dates for all three general tasks. Completing Confirm
    participation and Complete bio and profile moved them into `Done`; reload preserved
    `2 of 3 complete` while Sign speaker release form remained open for Apr 15. Every manual
    task also renders an unexplained `View file` button despite being created as manual
    check-off work, a product-language defect even though completion works.
38. SPK-S3 organizer detail immediately reflected the portal bio sentinel, rendered
    current-round headshot, social links, and a file row `headshot.png · Headshot · 569 B ·
    Priya Raman · Aug 12`; its Download control responded without navigation/error.
39. The assignments board shows mixed progress without opening records: Priya 1 outstanding /
    2 done versus Marcus 3 outstanding / 0 done. `Has outstanding` is the only status-like
    filter; there is no complete-only filter, though individual-task filtering exists.
40. Communications composed to `All speakers` (five current Round 02 roster contacts),
    resolved `{speaker_name}`, `{event_name}`, and `{portal_url}` for a per-recipient preview,
    reported `Sent 5 campaign emails`, and persisted a history row with exact subject,
    recipient count, type, and timestamp.
41. Priya's organizer-side travel field saved and survived reload with exact value
    `Arrival May 11, aisle seat; dietary: Vegetarian`. Per-assignment deadline extensions
    were not observed; file/request task types are evaluated in Content Management.
42. CNT-S1 created SESS-4 `Lightning: Agents in Production Q&A` directly for the original
    Marcus contact as Lightning Talk. The Add session form has no track field, so required
    `AI Engineering` could not be entered there. The resulting manual session is also
    automatically `Content approved for publication`, which conflicts with CNT-S3's later
    requirement to leave it unapproved; both are recorded for downstream verification.
43. Two session-wide file requirements now apply to the two accepted sessions/speakers:
    Upload Session Presentation (May 1, `.pdf`, 50 MB, 0/2) and Upload Final Headshot
    (print quality) (Apr 14, `.png,.jpg,.jpeg`, 10 MB, 0/2). The presentation request's
    exact instructions were recorded in the filled form. No separate enable-uploads toggle
    exists; file collection is enabled by creating requirements.
44. CNT-S2 showed both file requirements only for Priya's SESS-1 and displayed constraints
    at upload time: `Accepted: .pdf · Maximum: 50 MB`. Native upload of this round's
    `slides.pdf` changed presentation to `Uploaded` automatically; headshot stayed
    `Outstanding` with Apr 14 due date.
45. Priya added exact comment `Draft deck - final version coming Friday.`. It displayed
    Priya Raman, Speaker, and a timestamp. Uploading the same fixture again reported `New
    version uploaded`; version list contains two separately downloadable slides.pdf rows,
    the newest explicitly `Current`, while the older remains accessible.
46. Final portal state is 3 of 5 complete (two general tasks plus uploaded presentation),
    with headshot and release still open. No Marcus/Dana content appears. Direct navigation
    to `/admin` while signed in as Priya redirects to `/portal`, proving admin denial.
47. CNT-S3's organizer summary shows presentation 1/2 uploaded and final headshot 0/2.
    Filtering the presentation request to `Outstanding` leaves only Marcus. Sending its
    reminder reported one recipient; sending the headshot reminder reported two recipients.
48. The central Files surface contains Priya's uploaded `slides.pdf` under SESS-1 with two
    versions, the current Round 02 profile `headshot.png` with version history, and three
    outstanding assignment rows. The SESS-1 file detail exposes both slide versions and the
    cross-role thread. Dana Organizer's exact reply `Thanks - please confirm the final version
    by Tuesday.` persisted with organizer attribution and timestamp.
49. Organizer content editing saved the required `UPDATED:` title and appended the live-demo
    sentence. A second save appended `Attendees should bring a laptop.`. Reload showed two
    distinct Dana Organizer history entries with changed-field labels and timestamps.
50. Restoring the first organizer snapshot required an explicit confirmation dialog. After
    confirmation, history retained all prior entries and added a fourth attributed version;
    the laptop sentence was removed while the live-demo sentence and updated title remained.
51. The evaluator names organizer `Jordan Alvarez`, but the product's available organizer
    demo identity is `Dana Organizer`. No alternate organizer identity was invented. All
    organizer content, profile, file-comment, and restore history is therefore correctly
    attributed to Dana inside this isolated run, not to the fixture's display name.
52. The organizer profile editor appended the exact sentence `Priya leads the
    developer-productivity group at Latticework Systems.` and replaced the headshot through
    the native macOS picker with this run's authoritative `headshot.png`. Reload preserved
    the bio; the new current headshot row is attributed to Dana Organizer and the earlier
    Priya Speaker version remains downloadable.
53. Both SESS-1 and the directly created SESS-4 are `Approved`. SESS-4 was auto-approved on
    creation. Its only content action is `Edit session`, whose terminal action is `Save and
    approve`; there is no unapprove/draft control. The run therefore could not create the
    required approved-versus-unapproved pair without changing the scenario data or product.
54. Public approval-gate evidence is deferred until the Round 02 agenda is published, per
    scenario dependency. SESS-4's forced approved state is already a product failure even if
    both sessions later appear publicly.
55. Files ZIP export allowed selecting exactly the current headshot and slides rows. Its
    confirmation stated that only the latest version of each of the two selected files would
    be included, generated `Ready · 2 latest versions`, and exposed a Download ZIP action.
56. The SESS-1 title was restored to its canonical fixture value after versioning evidence so
    later agenda/public scenarios start from the authoritative Round 02 fixture. The restored
    live-demo abstract remains as required by CNT-S3; this is same-run scenario state, not
    reconciliation with any earlier evaluation.
57. AIA-S1 used only this Round 02's own submissions. To make the three fixture proposals
    schedulable as directed, SESS-2's prior decline was explicitly replaced with Accept and
    SESS-3 was accepted. Both acceptance dialogs left content approval unchecked, preserving
    an in-run public approval-gate comparison rather than importing or reconciling old state.
58. The agenda builder opened as a true three-day 15-minute grid (May 12, 13, 14) with an
    unscheduled pool containing all four accepted Round 02 sessions. Inline room creation
    added Main Stage, Room 2A, Room 2B, and Workshop Lab; all four immediately appeared as
    scheduling columns. Existing fixture tracks remained visible on session cards/filtering.
59. Click-to-schedule placed SESS-1 at May 12, 10:00 AM in Room 2A. Its grid card showed
    title, code, and Priya Raman, and the unscheduled count fell from four to three.
60. Placing SESS-2 at May 12, 10:00 AM in Room 2B immediately changed the tab to
    `Conflicts 1`. Its detail named `Speaker double-booking`, both sessions, Priya Raman,
    both rooms, and exact reason `Priya Raman is assigned to both sessions at once.`
61. Placing SESS-3 at the same May 12 10:00 AM slot in Room 2A was allowed but visibly
    flagged. The conflict tab rose to four: one `Room overlap` plus three pairwise speaker
    overlaps because all three fixture submissions share Priya. The room warning's exact
    reason was `Both sessions occupy Room 2A during the same time window.`
62. Moving SESS-2 to May 12 2:00 PM in Room 2B cleared its speaker conflict live and reduced
    the count from four to two. Moving SESS-3 to May 13 11:00 AM in Room 2B cleared the
    remaining room/speaker conflicts live; the tab became `Conflicts 0` without reload.
63. Day views showed SESS-1 and SESS-2 in the final Day 1 slots and SESS-3 in its Day 2
    slot. The list view showed exact day/time/room/duration for all three, and a full page
    reload preserved every placement while leaving Marcus's SESS-4 unscheduled.
64. `AI drafts` is a substantive assisted scheduler, not a label-only control. A new draft
    accepted all three days/four rooms and `Respect existing placements`, then proposed the
    sole unscheduled SESS-4 at May 12 8:00 AM on Main Stage with reason `Earliest
    conflict-free slot, interleaved by track.` The live agenda remained unchanged until the
    explicit `Accept 1 changes` action; afterward the unscheduled pool was zero.
65. `Publish agenda` published immediately, changed the builder status and disabled action
    to `Published`, and removed `Unpublished changes`. The public event route became `Live`.
66. The public event home and Agenda handoff show only SESS-1 and SESS-4: both are approved
    content. SESS-2 and SESS-3 are accepted/scheduled but content-unapproved and are withheld.
    This simultaneously proves CNT-S3's content approval gate; it also means AIA's handoff
    cannot show all three fixture sessions unless their content is approved before EMB checks.
67. EMB-S1 followed its explicit chained-run precondition: after recording the two-session
    approval-gated public state, the organizer approved SESS-2 and SESS-3, logged out, and
    restarted the tour anonymously. This is same-run state required by the current public
    spec, not reconciliation with V3 or any earlier evaluation.
68. The anonymous Sessions surface showed four cards and facets for Track, Format, and Room.
    Three fixture cards showed title, full time range, room, Priya with title/company,
    track/format, description, and in-place Show more/less. Marcus's direct session has no
    track/description because its creation UI omitted those fields, but still shows time,
    room, speaker title/company, and format.
69. Session search narrowed `Taming` to 1/4 and speaker surname `Raman` to 3/4. Selecting
    Platform & Infra narrowed to the sole matching card with one active filter. All were
    anonymous; no attendee or organizer login was needed.
70. The anonymous speaker list is surname-ordered Okafor then Raman, shows title/company and
    graceful initials for Marcus's missing headshot. Priya detail shows the current Round 02
    photo, complete bio, and all three sessions with exact date/time/room. Exact-name search
    narrowed to 1/2. The gallery independently renders the same two speakers/photo fallback,
    exact search, bio, and three-session detail.
71. Public Agenda is a time-slotted day list. Day 1 showed Marcus 8:00 Main Stage, CI 10:00
    Room 2A, and AI Pair 2:00 Room 2B; Day 2 showed Docs 11:00 Room 2B. CI detail included
    full time range, room, track, format, description, and speaker title/company; Close
    restored the intact day view. Values match the organizer list and all other widgets.
72. The anonymous Itinerary groups sessions chronologically under Wednesday and Thursday,
    with the same titles, full date/time, room, speaker roles/companies, track/format, and
    descriptions. Adding CI and AI Pair produced `My Schedule (2)` with exactly those two in
    time order. A full reload preserved both selections without any account.
73. Export ICS reported `Downloaded devflow-conf-2027-2-my-schedule.ics`. Removing AI Pair
    immediately updated the view to `My Schedule (1)`, leaving only CI.
74. All five viewer surfaces are anonymous public routes and require no admin privileges:
    Sessions `/sessions`, Speakers `/speakers`, Agenda `/agenda`, Itinerary `/itinerary`, and
    Gallery `/speakers/gallery` under `/e/devflow-conf-2027-2`.
75. Organizer Widgets starts as a saved-list area. Creating the first widget immediately
    opens a live builder with all five view choices: Sessions, Speaker list, Speaker gallery,
    Agenda, and Itinerary. It supports track/format/day/tag filters, auto theme, 12/24-hour
    time, primary color, visible-field toggles, custom CSS with documented stable hooks,
    enabled state, View HTML, and a live iframe preview.
76. The saved widget is `Round 02 Sessions List`. Its verbatim iframe output is
    `<iframe src="https://app.opensesh.io/embed/DY9j_qtl_QHW3eeLAKSBj?view=sessions&theme=auto&color=default&time=12h&tracks=&formats=&days=&tags=&company=1&title=1&bio=1&description=1&level=1&format=1&calendar=1" title="Round 02 Sessions List" width="100%" height="640" style="border:0" loading="lazy"></iframe>`.
77. Additional outputs are share URL
    `https://app.opensesh.io/embed/DY9j_qtl_QHW3eeLAKSBj?view=sessions&theme=auto&color=default&time=12h&tracks=&formats=&days=&tags=&company=1&title=1&bio=1&description=1&level=1&format=1&calendar=1`, JSON
    `https://app.opensesh.io/embed/DY9j_qtl_QHW3eeLAKSBj/json`, and ICS
    `https://app.opensesh.io/embed/DY9j_qtl_QHW3eeLAKSBj/ics`. The share URL rendered all
    four sessions outside admin with the same data as the public Sessions surface.
78. CRM-S1 opened in a true organization workspace, outside any single event. Event-level
    CSV imports do not automatically populate it, so three current-spec contacts were
    created inside Round 02. Directory search `Priya` and title filter Principal Engineer
    narrowed correctly; `AI Experts` saved as a dynamic segment with one recalculated member.
79. Priya's canonical CRM profile persisted the exact internal note and `AI` tag after full
    reload. It also exposes linked events/sessions, pipeline, communication history, and a
    chronological activity feed; the note is attributed to Dana Organizer with timestamp.
80. The fresh CRM had no default pipeline stages. Organizer configuration created Prospect,
    Contacted, Interested, Confirmed/won, and Declined/lost. The final Declined creation
    emitted a contradictory `Could not create CRM stage` toast while the stage appeared and
    remained usable; this needs final reload verification before the scenario is frozen.
81. Marcus enrolled at Prospect with card note `Score 85 — Strong platform-engineering track
    record; ideal for Platform & Infra track.`, moved Prospect → Contacted → Interested, and
    stayed Interested after reload. His profile shows all three timestamped transitions.
82. Marcus's pipeline note `Left voicemail 2027-01-15; follow up next week.` persisted after
    reload with Dana/timestamp and a matching chronological activity entry.
83. `Add to event` reused the canonical Marcus in DevFlow Conf 2027 and reported `without
    duplicate entry`. Event Speakers search found the new fixture email with name, title,
    company, and Invited state intact.
84. CRM Overview reports 3 total contacts, 1 event reached, 1 open, 0 won/lost, 86% profile
    completeness, pipeline distribution, three top companies, and AI tag count. This matches
    the three-row directory.
85. Selecting Marcus and Priya opened an org-level email composer with live per-recipient
    merge preview. The exact subject `Speak at DevFlow Conf 2027?` and personalized body were
    sent; the success state reported `Campaign sent · 2 recipients`.
86. Native CRM CSV import accepted the authoritative `speakers.csv`, auto-mapped name/email/
    title/company/bio, previewed all three rows with outcomes, and completed `Imported 3
    contacts · 0 skipped` / `3 Created`. Because the CSV fixture emails differ from the
    manually created sample identities, the directory intentionally grew from 3 to 6 and
    surfaced three same-name/different-email duplicate pairs.
87. `Review duplicates 3` opened a primary-selection merge flow with combined-record preview
    and an explicit irreversible acknowledgement promising preservation of notes, tags,
    event links, custom metadata, and pipeline history. Selecting the Priya pair and keeping
    `priya.raman@sbek-test.example.com` as primary reduced the directory from 6 to 5 while
    preserving the AI tag and canonical record.
88. A reload after pipeline configuration confirmed all five stages, including Declined/lost,
    despite the earlier contradictory creation toast. Stage semantics and Marcus's Interested
    placement therefore persisted.
89. CRM campaign history now lists one sent campaign, exact subject `Speak at DevFlow Conf
    2027?`, DevFlow Conf 2027, 2 recipients, and timestamp. No organizer event state or
    evidence from another evaluation was used to populate or score the CRM.
90. Evidence-integrity audit found that screenshots numbered `085`–`151` had been described
    during the run but were never written into the durable evidence directory. They are not
    cited as files and are not borrowed from any earlier run. Stable current state was
    recaptured from the still-live Round 02 tenant as `152`–`166`; transient observations
    that cannot be reconstructed remain explicitly identified as working-log evidence only.
91. The final Overview is internally contradictory after agenda publication: the lifecycle
    step says `4 scheduled · 0 unscheduled · 0 conflicts · published`, while the Agenda card
    says `Draft` and the agenda summary says `Draft — not published`. It also says `3 of 3
    proposals reviewed` while the adjacent review-progress card says `0 of 4` and `4 awaiting
    first review`. These are stale/incorrect summary surfaces, not merely copy differences.

## Frozen issue register

Frozen after all 20 scenarios. No code changes were made before this point.

### Rubric blockers

1. **Reviewer assignments do not reach the reviewer queue (critical).** Organizer setup,
   round membership, caps, and exact SESS-1/SESS-2 assignments persist, but the corresponding
   reviewer-only account always renders `No reviews assigned`. This directly fails CFP-11 and
   ABS-05 and prevents end-to-end proof of ABS-03/04/07/08/10/12. It is the largest score loss.
2. **Existing submissions cannot manage participants or roles (major).** Multi-speaker cards
   exist only while creating a new submission. A submitted proposal cannot add Marcus, and
   participant cards have no Co-author/Co-presenter role selector. ABS-11 fails.
3. **No automatic due-date reminder was proven (manual outstanding).** Organizer-triggered
   reviewer and deliverable reminders work and log sends, but SPK-16 specifically requires an
   unattended scheduled reminder within a due-date window. No scheduler/history evidence was
   observed; this remains manual-pending rather than silently passed.

### Product defects and stale state

4. **Published agenda is reported as draft on Overview (major).** The lifecycle correctly says
   published, while two Overview agenda labels say Draft/not published.
5. **Overview review metrics contradict each other (major).** It reports 3/3 proposals reviewed
   while the same page reports 0/4 reviews and four awaiting first review.
6. **Post-submission approval messaging is inconsistent.** A never-edited new submission shows
   `Edits pending approval`, while a deliberately edited proposal does not show it in the list.
7. **Direct session creation omits program metadata.** The form has no track field and yielded
   a public session without track/description, weakening otherwise complete public cards.
8. **Direct sessions are auto-approved with no unapprove/draft control.** This made the exact
   CNT-S3 approved/unapproved pair impossible using the requested directly-created session.
9. **Manual checklist tasks render `View file`.** The control is nonsensical for non-file tasks
   and can mislead speakers about what completion requires.
10. **Future-date picker reopens on the wrong month.** Stored May 2027 values are correct, but
    reopening shows August 2026 instead of the selected month.
11. **CRM stage creation can report failure after succeeding.** Creating Declined/lost emitted
    `Could not create CRM stage`, yet the stage existed and survived reload.
12. **A reusable speaker identity leaks profile state between organizations.** The fresh Round
    02 speaker login initially exposed a headshot from outside this organization. The run
    replaced it before using profile evidence, but a clean tenant should not inherit another
    organization's profile asset without an explicit shared-profile model and disclosure.

### Evaluator and accessibility traps

13. **Five library actions share the accessible name `Add`.** Visual section context is not
    encoded in the button name; automation added a track as a format before correcting it.
14. **Demo-role sign-in silently resets active organization/event.** Every persona transition
    returns to the seeded AI.Engineer tenant, creating a high-risk cross-tenant evaluator trap.
15. **The multi-event switcher briefly disagrees with itself.** Its button showed Forward Summit
    while the open list marked DevFlow selected, even though the loaded page was correctly scoped.
16. **Format fixture wording and product modeling conflict.** Entering fixture label `Talk
    (30 min)` plus product duration renders `Talk (30 min) (30 min)`; the evaluator must infer
    that `Name` expects only `Talk` despite instructions to configure the label exactly.
17. **Draft save is implicit only.** Autosave works and resumes correctly, but there is no named
    Save draft action, so a literal evaluator can miss a passing capability.
18. **Submission confirmation omits enabled-email feedback.** The email log proves a message was
    generated, but the confirmation screen never tells the participant an email was sent.
19. **Reviewer provisioning lacks display name and a direct usable invite link.** It creates an
    email-derived label (`sbek-reviewer`) and exposes only generic `/login`; an evaluator must
    know to request another magic link.
20. **Organizer demo identity cannot match the fixture.** Version history correctly attributes
    Dana Organizer, but the criterion names Jordan Alvarez. No identity was invented; this costs
    conservative partial credit and should be addressed through evaluator-ready identity setup.
21. **CSV fixtures create allowed but confusing duplicate-name records.** Sample runtime emails
    differ from `speakers.csv`; imports produce duplicate Priya/Marcus rows. CRM detects them,
    but an evaluator must understand that the rubric permits this and merge only the requested pair.
22. **The third-submission fixture omits a value for a required field.** `Key takeaway` had to be
    supplied with a minimal same-run value. This is a fixture completeness gap, not a product fail.
23. **Later screenshots were not durably written during execution.** `085`–`151` are excluded as
    file evidence. `152`–`166` recapture stable state from Round 02 only; transient checks remain
    in the log. The eval runner needs an atomic screenshot-and-log helper before the next round.

## Score

This is a conservative read-only manual judgement using the evaluator's area-weighted scoring
rules. Manual-only SPK-16 and non-claimed ABS-14 are excluded from the current denominator;
auto-partial manual follow-ups remain listed below.

| Required area | Earned / judged | Area score | Area weight contribution |
| --- | ---: | ---: | ---: |
| Call for Papers | 36 / 38 | 94.7% | 18.9 / 20 |
| Abstract Management | 14 / 27 | 51.9% | 10.4 / 20 |
| Speaker Management | 32 / 32 | 100% | 15.0 / 15 |
| Content Management | 30 / 31 | 96.8% | 14.5 / 15 |
| AI Agenda | 18 / 18 | 100% | 10.0 / 10 |
| Public Widgets | 35 / 35 | 100% | 20.0 / 20 |

- **Required headline: 88.8% at 98.8% coverage.**
- **Bonus Speaker CRM: 19 / 19 — 100%.**
- Manual follow-ups still pending: SPK-16 automatic reminders; delivered/openable invite,
  campaign, and reminder emails; exported result/ZIP/ICS file contents; third-party iframe
  rendering; and live embed propagation after a source edit.
- Strict failures: CFP-11, ABS-05, ABS-10, ABS-11, ABS-12.
- Partial credit: ABS-03, ABS-04, ABS-07, ABS-08, CNT-11.
- ABS-14 is not applicable because this product does not claim AI-assisted abstract review.
