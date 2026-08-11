# Production Manual Eval Run — 2026-08-11

This is the durable, resumable record for a human-driven production pass of the
SessionBoard Eval Kit against OpenSesh. Update this file immediately after every
meaningful checkpoint so another session can resume without relying on chat history.

The deduplicated, severity-ranked explanation of every product issue and evaluation
limitation discovered in this run is [EVAL-ISSUE-REGISTER-2026-08-11.md](./EVAL-ISSUE-REGISTER-2026-08-11.md).

## Run identity

- Status: **COMPLETE — MANUAL READ/WRITE PASS**
- Started: 2026-08-11 13:30:08 IST
- Last checkpoint: 2026-08-11 15:36 IST
- Target: <https://app.opensesh.io>
- Evaluator checkout: `/private/tmp/killmysaas-evals`
- Evaluator commit: `2b0f7956ab0c6f4868d41356e495b3a225badaab`
- Evaluator scope: all 20 scenarios, all 98 rubric items, including optional Speaker CRM
- Execution mode: direct browser walkthrough; no evaluator API keys or LLM harness
- Evidence mode: exact URLs, visible state, browser console, and scoped Worker request evidence
  recorded here; secrets and request payloads are deliberately excluded

## Safety and isolation

- Use only a newly-created production account and organization for this run.
- Do not modify the seeded AI.Engineer or DevFlow organizations/events.
- Do not inspect cookies, local storage, secrets, or production database rows.
- Do not delete data. A second event is deliberately created because CFP-17/18 test it.
- Fixture emails are synthetic `sbek-test.example.com` addresses.

## Run entities

| Entity | Value | Production ID/URL | Status |
|---|---|---|---|
| Organizer account | `codex-eval-organizer-20260811@sbek-test.example.com` | `/portal` after signup | created, but onboarding redirect is broken |
| Organization | `Codex E2E 2026-08-11` | unavailable | creation route redirects away; fallback is isolated event in existing org |
| Fresh-start probe event | `DevFlow Conf 2027 — Codex E2E` | `/e/devflow-conf-2027-codex-e2e` | created; library populated; CFP editor defective |
| Chained eval event | seeded `DevFlow Conf 2027` | `/e/devflow-conf-2027` | use for remaining fixture chain |
| Isolation event | `DevFlow Conf 2027 — Codex E2E` | `/e/devflow-conf-2027-codex-e2e` | verified empty submissions/sessions/speakers versus seeded event |
| Speaker account/contact | Priya Raman / synthetic run email | pending | pending |
| Co-speaker account/contact | Marcus Okafor / synthetic run email | pending | pending |
| Reviewer account/contact | Sam Whitfield / synthetic run email | pending | pending |

## Canonical fixtures

- `fixtures/sample-data.json`: event, identities, 3 submissions, review, communications, tasks
- `fixtures/speakers.csv`: Priya Raman, Marcus Okafor, Dana Kowalski
- `fixtures/headshot.png`: speaker-profile upload
- `fixtures/slides.pdf`: two-version deliverable upload
- `fixtures/aie-europe.json`: not referenced by any scenario; excluded from the canonical run

## Scenario checkpoints

Verdicts are `pending`, `pass`, `partial`, `fail`, or `blocked`. Scores are filled only
after the scenario evidence is complete.

| # | Scenario | Persona | Status | Evidence / resume note |
|---:|---|---|---|---|
| 1 | CFP-S1 — Organizer builds and publishes the CFP | organizer | partial | Fresh event/library and public portal pass; builder fields/conditional logic pass on seeded fallback; fresh builder remains non-atomic/broken |
| 2 | CFP-S2 — Speaker drafts, submits, and edits proposals | speaker | blocked | Draft/resume + required validation pass; complete fixture submit is blocked by participant-role mismatch (`speaker` vs `Primary speaker`) |
| 3 | CFP-S3 — Organizer assigns a reviewer; reviewer scores | organizer → reviewer | pass | Sam assigned only SESS-1; blind reviewer queue scoped correctly; completed 4/4/Accept/comment review persists |
| 4 | CFP-S4 — Organizer decides, notifies, hands off, closes CFP | organizer → speaker | pass | Decisions/notifications/handoff pass; past close date blocks new and updated submissions; original deadline restored |
| 5 | ABS-S1 — Speaker seeds submissions with a co-author | speaker | partial | Seed has three target submissions and SESS-1 has Priya + Marcus roles; always-fresh third-submission path blocked by CFP participant-role bug |
| 6 | ABS-S2 — Organizer configures rounds, pools, assignments, reminders | organizer | partial | Two rounds, distinct pools/scorecards, caps/auto-distribute and exact two assignments pass; reminder action has no visible confirmation; AI lacks key |
| 7 | ABS-S3 — Reviewer scores blind; organizer checks aggregates/export | reviewer → organizer | partial | Exact two-item blind queue, both reviews, 100% progress and export pass; accepted SESS-1 disappears from results table, losing its aggregate/history there |
| 8 | SPK-S1 — Organizer builds roster and assigns onboarding tasks | organizer | pass | CSV import/dedupe, search, Confirmed persistence/filter, organizer bio version, session links, 3 general tasks, and invitation all pass |
| 9 | SPK-S2 — Speaker completes onboarding in portal | speaker | pass | Priya-only portal, accepted session, profile/headshot persistence, and 2-done/1-open tasks pass; due dates render one day late |
| 10 | SPK-S3 — Organizer tracks progress and bulk communicates | organizer | pass | Portal edits/files sync, list progress, token preview, bulk send, and history pass; logistics edit absent and all-speaker group contains blank organizer row |
| 11 | CNT-S1 — Organizer sets up content collection | organizer | pass | Two exact session requirements persist with instructions, dates, type/size limits, SESS-1, and both listed speakers; direct Marcus-only session creation absent |
| 12 | CNT-S2 — Speaker uploads and versions a deliverable | speaker | pass | Constraints, two slide versions, comments, portal scope, and admin redirect pass; requirements are buried in submission Spotlight rather than Tasks |
| 13 | CNT-S3 — Organizer tracks, reviews, approves, exports | organizer | partial | Library, metadata, comments, edit/history/restore, profile edit, approval, filters, and ZIP pass; per-speaker outstanding model/reminders fail and public gate deferred |
| 14 | AIA-S1 — Build agenda and resolve conflicts | organizer | pass | 3-day grid, room creation, exact placements, speaker/room conflicts, moves, clearing, and reload persistence pass |
| 15 | AIA-S2 — Auto-schedule assist and publish | organizer | pass | AI proposal/compare/accept places legal unscheduled SESS-2; publish and public agenda handoff pass; 10-minute candidates expose grid incompatibility |
| 16 | EMB-S1 — Non-admin tour of browse widgets | attendee | pass | All five public surfaces are anonymous and populated; sessions/speakers/gallery search+details and two-day agenda navigation/content pass |
| 17 | EMB-S2 — Itinerary and personal schedule | attendee | pass | Two selections, exact My Schedule membership, reload persistence, removal, and ICS export affordance pass anonymously |
| 18 | EMB-S3 — Embed generation and consistency | organizer | partial | Builder/list/render/filter/fields/enable and exact iframe URL pass; only URL+iframe outputs, and fixed Demo roles button pointer-blocks Get code |
| 19 | CRM-S1 — Build and organize speaker database | organizer | pass | Org directory/search/filter/dynamic segment/profile/note/tag/history/import lineage pass; merge comparison exists but destructive confirmation deliberately skipped |
| 20 | CRM-S2 — Source through pipeline and reuse across events | organizer | pass | Enroll, two DnD moves, reload, note/history, existing event handoff, personalized bulk campaign, and overview KPIs all pass |

## Rubric totals

| Area | Required area weight | Items | Strict manual result |
|---|---:|---:|---:|
| Call for Papers | 20 | 18 | 31.5 / 38 = **82.9%** |
| Abstract Management | 20 | 14 | 24.5 / 28 = **87.5%** |
| Speaker Management | 15 | 16 | 31.5 / 33 = **95.5%** |
| Content Management | 15 | 14 | 24.5 / 31 = **79.0%** |
| AI Agenda | 10 | 8 | 18 / 18 = **100.0%** |
| Public Widgets | 20 | 16 | 33.5 / 35 = **95.7%** |
| **Required headline** | **100** | **86** | **89.4%** area-weighted |
| Speaker CRM (reported separately) | +10 optional | 12 | 18 / 19 = **94.7%** |

## Evidence log

### Checkpoint 0 — evaluator inventory

- Pulled evaluator `main` from `54acf7a` to `2b0f795` before starting.
- Current evaluator README reports 98 items: 86 required / 12 extra credit.
- The public-widgets spec changed in the latest evaluator commit; this run uses the new version.
- No production mutations performed yet.

### Checkpoint 1 — new-account onboarding defect

- Submitted `/signup` with `codex-eval-organizer-20260811@sbek-test.example.com`.
- The UI produced a demo magic link whose callback was explicitly `/onboarding`.
- Opening the link authenticated the new user but redirected to `/portal` for
  **AI.Engineer Sandbox — NYC 2026**, where the body said **You do not have access**.
- Navigating directly to `https://app.opensesh.io/onboarding` redirected back to the same
  inaccessible `/portal` state.
- This blocks a clean evaluator from creating its first organization through open signup.
- Next safe fallback: sign out, authenticate as the seeded evaluator organizer, and test
  whether the organization switcher can create a new isolated organization. Do not reuse or
  mutate the seeded DevFlow event.

### Checkpoint 2 — seeded organizer fallback and organization-creation defect

- Signed in successfully as seeded evaluator organizer
  `jordan.organizer@sbek-test.example.com` using the canonical fixture password.
- The organizer correctly landed at `/admin` on **DevFlow Conf 2027** with admin-only navigation.
- The organization menu exposes **Create organization**.
- Activating **Create organization** returns to `/admin`; no dialog or onboarding form appears.
- Result: production currently has no working UI path to create a new organization, for either a
  new user or an existing organizer. This is a hard onboarding failure outside the 98-item feature
  rubric and blocks the user's requested fresh-org isolation.
- Safe continuation: create a uniquely named isolated event in the existing organization, without
  editing seeded events. Grade multi-event/event-scoping normally and retain the onboarding defect
  as a critical product defect.

### Checkpoint 3 — fresh event and library

- Created **DevFlow Conf 2027 — Codex E2E** through the event switcher.
- Dates persist as May 12–14, 2027; tagline, Moscone West location, and fixture description persist.
- Public slug: `devflow-conf-2027-codex-e2e`.
- Program library round-trip passed from empty:
  - Tracks: AI Engineering; Platform & Infra; Developer Experience.
  - Formats: Keynote 45; Talk 30; Lightning Talk 10; Workshop 120; Panel 45.
  - Rooms: Main Stage; Room 2A; Room 2B; Workshop Lab.
  - Levels: Beginner; Intermediate; Advanced.

### Checkpoint 4 — fresh CFP builder defects

- Created form ID `2XYq27O_ByqzkbGgAdpd3`; public path is
  `/submit/devflow-conf-2027-codex-e2e/2XYq27O_ByqzkbGgAdpd3`.
- Changing collection type from Sessions to Abstracts persisted after reload.
- Welcome copy persisted after reload, despite the editor permanently reporting
  **Save failed — retry** and toast **Could not save form fields**.
- A new abstract form starts with two locked, required **Title** fields instead of Title + Abstract.
- Adding an `Abstract` question and choosing Long text did not visibly change its type from Short
  text; a conditional editor appeared unexpectedly during the required-toggle interaction.
- Fresh CFP construction is not trustworthy enough to continue the chained fixture run. This is a
  substantive CFP-01/02 failure, not a harness problem.
- Per the evaluator's own fallback rule for pre-seeded products, continue the remaining 20-scenario
  traversal on seeded **DevFlow Conf 2027**, while keeping this clean-start failure in the grade.

### Checkpoint 5 — captured CFP save failure at the request boundary

- Reproduced at **2026-08-11 13:48:42 IST** on the isolated fresh event/form, while a scoped
  production Worker tail was active. The harmless probe changed only the external form title to
  `DevFlow Conf 2027 Call for Papers · capture`; the original title was restored afterward.
- Browser evidence at the failure instant:
  - editor status: **Save failed — retry**;
  - toast: **Could not save form fields**;
  - route: `/admin/forms/2XYq27O_ByqzkbGgAdpd3`;
  - the only console errors in the browser log were React minified error `#418` hydration errors,
    first at `2026-08-11T08:06:04.972Z`; there was no save-specific JavaScript exception.
- Matching Worker request evidence:
  - request: `POST /_serverFn/[redacted]` from the exact form route;
  - Cloudflare Ray: `a295cfa4be4785ab`;
  - request body size: 4,573 bytes;
  - Worker version: `4977b25f-0515-49cd-bbbd-80f31a11fb02`;
  - Worker outcome: `ok`; HTTP status: `200`; wall time: 54 ms; CPU time: 17 ms;
  - Worker exceptions/logs: none.
- Conclusion: this was **not** a network failure or thrown Worker exception. The client received an
  application-level error inside an HTTP 200 response. The exact toast text maps to the
  `forms.replaceFields` database error label in `packages/domain/src/server/repos/forms.ts`.
- The source also explains the misleading partial persistence observed earlier: `saveForm` runs
  `forms.update(...)` and `forms.replaceFields(...)` concurrently without a transaction. The form
  row can persist while field replacement fails, after which the aggregate response is an error.
  This is a non-atomic partial-write defect; the underlying database error detail is currently
  swallowed by the typed public error envelope and absent from Worker logs.
- Evidence limitation: a HAR/DevTools network recorder was not active for the first occurrence.
  The controlled reproduction above captures the matching production request metadata and the
  visible/client log state, but not the framed HTTP response body.

### Checkpoint 6 — public CFP, conditional logic, and draft behavior

- Public URL: `https://app.opensesh.io/submit/devflow-conf-2027/form_devflow_cfp`.
- Logged-out portal passes: branded **DevFlow Conf 2027** header, visible
  **Closes Nov 30, 3:59 PM PST** deadline, and account gate reached without authentication.
- Seeded fallback builder now has required `Key takeaway`, conditional long-text
  `Workshop prerequisites`, and the fixture library-backed `Audience level` field.
- Conditional logic passes visually in the public form: the prerequisites field renders for
  `Workshop (120 min)` and is absent for `Talk (30 min)` without a reload. A transient
  accessibility-tree entry while the select was focused was explicitly discarded as false
  evidence after visual verification.
- Required validation passes: advancing with empty fields visibly reports Description, Track,
  Audience level, Notes for reviewers, and Key takeaway as required.
- Draft/resume passes. A title-only draft was auto-saved as **SESS-5 · draft** and reopening it
  restored the exact title.

### Checkpoint 7 — canonical fixture submission blockers

- The canonical abstract is 386 characters, but seeded `Description` was configured as rich text
  with a 255-character maximum. The public form correctly rejected it with
  **Description must be 255 characters or fewer**. The organizer raised the maximum to 5,000
  through the normal builder; the draft then accepted and restored the complete abstract.
- The seeded CFP had participant collection enabled with a minimum of one speaker, but zero
  participant questions. The public speaker step rendered an empty card and disabled Add; submit
  rejected with **Primary speaker requires between 1 and 1 participants**.
- Through the organizer builder, added required First Name, Last Name, Email, and Biography
  questions (Email type; Biography long text with 5,000-character maximum). The public form then
  rendered those fields, accepted the complete Priya fixture profile, and showed all values on the
  review step.
- Final submit still rejects with **Primary speaker requires between 1 and 1 participants**.
  Source confirms a non-recoverable UI mismatch: `participantForEmail` in
  `apps/web/src/routes/submit.$eventSlug.$formId.tsx` hardcodes role `speaker`, while the seeded
  form requires role `Primary speaker` (and also defines `Co-presenter`). The form editor exposes
  enabled/min/max only, not role names, so the organizer cannot repair this through production UI.
- CFP-S2 is therefore blocked at final submit. CFP-05 cannot pass for the fresh manual chain;
  CFP-07 draft/resume and required validation do pass. Preserve SESS-5 as evidence and continue
  downstream scenarios against seeded SESS-1/2/3 rather than fabricating a successful submission.

### Checkpoint 8 — reviewer assignment and round-trip

- Seeded Initial Review is a real independent round: Aug 1–Oct 15, blind, with weighted numeric
  Originality/Relevance, Accept/Maybe/Reject dropdown, and long-text Comments. Final Review exists
  separately with Oct 16–Nov 30 dates and a different 1–10 scorecard.
- Sam Whitfield exists in the Initial Review pool only. Assigning SESS-1 appeared to revert to
  `0 assignments` in the organizer table immediately after the first action, but reviewer login
  proved the backend mutation had succeeded; reloading later showed `Assignments (1)`. This is a
  stale organizer-view feedback defect, not a failed assignment.
- Sam's signed-in sidebar exposes only **My Reviews**, with no organizer navigation. His queue
  initially contained exactly SESS-1 and the blind review view omitted Priya, Marcus, and company
  identity. A reversible-looking **Recuse** control is present.
- Submitted Originality 4, Relevance 4, Accept, and the canonical review comment. Queue updated to
  `0 pending · 1 completed`; organizer round Results showed Sam, both values, recommendation, and
  exact comment. The generic submission spotlight incorrectly continued to show `Reviews · 0`.

### Checkpoint 9 — decisions, notifications, and session handoff

- Decision flow is explicit and sends notifications in the same confirmation dialog.
- SESS-2 is now **declined** and **Notified**. Activity and Email history record the demo rejection
  message to Priya.
- SESS-1 is now **accepted** and **Notified**. The preview greeted Marcus because he was the first
  listed participant, even though Priya is the Primary speaker; final Email history correctly
  contains one acceptance message for Priya and one for Marcus.
- Acceptance automatically exposes **Session content**, creates onboarding state, and moves SESS-1
  into the Sessions area with title, Platform & Infra track, Talk format, Priya and Marcus intact.

### Checkpoint 10 — abstract-management depth

- Assigned SESS-2 to Sam as the second and only other review. Organizer Progress showed 2 assigned,
  1 completed, 1 remaining. The bulk reminder control accepted Sam and cleared selection but gave
  no visible sent/queued confirmation.
- Reviewer queue then contained exactly SESS-1 and SESS-2; Docs That Answer Back was absent. Blind
  identity hiding remained intact. Updated SESS-1 to Originality 4 / Relevance 2 / Accept and
  submitted SESS-2 as 5 / 5 / Accept with `Excellent fit for the AI Engineering track.`
- Reviewer queue finished at `0 pending · 2 completed`; organizer Progress shows 2/2 and 100%.
- Results is weighted and correctly displays SESS-2 aggregate 5.00. However, once SESS-1 was
  accepted, it disappeared entirely from the round Results table even though its completed review
  and assignment remain in Progress. Therefore the expected weighted 3.33 aggregate and historical
  review cannot be viewed/exported from Results after disposition.
- Export CSV executed and confirmed **Exported 4 submissions**. The excluded accepted SESS-1 means
  the export is also disposition-filtered rather than a durable round-results export.
- AI rows are visible but explicitly report no output because an Anthropic key is not configured;
  no fabricated AI score was treated as evidence.

### Checkpoint 11 — organizer speaker roster and onboarding setup

- Speaker CSV import mapped `name`, `email`, `title`, `company`, and `bio` automatically. The
  preview correctly identified 3 rows, 2 matching event emails, and 0 errors. Import completed as
  **Created 1 · Updated 2 · Skipped 0**: Dana Kowalski was added while Priya and Marcus were
  de-duplicated by email and updated. The roster now shows 4 records, including a pre-existing
  blank organizer-contact row.
- Caution: choosing **Update** replaces profile fields that are absent from the CSV. Priya's
  existing Vegetarian / T-shirt M values became `No dietary needs` / missing after import. This is
  potentially destructive sparse-update behavior, though the rubric explicitly accepts merging.
- Priya's workflow status is **Confirmed** after reload. The roster status filter narrows from
  4 records to Priya alone and clears back to the full roster.
- Priya's organizer biography now contains `SBEK-ORG-EDIT-01` after reload, and profile history
  records Jordan Alvarez's approved version. Her SESS-1/2/3 links remain intact, including the
  exact target session **Taming 40-Minute CI: Incremental Builds at Monorepo Scale**.
- The per-speaker **Invite** action reports **Sent 1 invitation** and the invitation dialog records
  `Priya Raman · Invitation sent · /portal`. Actual email delivery remains manual-only evidence.
- Created the three required general/manual tasks: **Confirm participation** and **Complete bio and
  profile** due Apr 1, 2027, plus **Sign speaker release form** due Apr 15, 2027. All use automatic
  assignment to all event speakers, which includes both Priya and Marcus. The assignments board
  shows 3 outstanding / 0 done for each roster record.
- SPK-S1 passes. The product supports the complete organizer workflow; assigning to exactly a
  chosen pair was not required because the built-in **All speakers** assignment includes both
  target speakers and satisfies the evaluator's multi-assignee criterion.

### Checkpoint 12 — speaker portal and organizer round-trip

- Password login as Priya lands on a dedicated portal identifying Priya. Portal home and session
  view contain no Marcus or Dana data. **My Sessions** contains exactly the accepted SESS-1 target
  and reports it as not scheduled yet.
- Portal profile saved `SBEK-PORTAL-BIO-01`, LinkedIn, X/Twitter, and `headshot.png`. After reload,
  the bio and links persist; the image renders as a complete 256x256 data image. The file panel
  lists `headshot.png · Current`, Priya as uploader, date, 0.6 KB, and a download control.
- Portal task list initially showed all three assigned tasks. It displayed organizer due dates one
  day late: Apr 1 became Apr 2 and Apr 15 became Apr 16. This is a cross-timezone date-conversion
  defect. Completing **Confirm participation** and **Complete bio and profile** persisted after
  reload as 2 of 3 done; **Sign speaker release form** remains open.
- Organizer Spotlight immediately shows the portal sentinel, rendered headshot, `Profile pending`,
  profile-change history, and 2 Done / 1 Open tasks. The Files panel lists `headshot.png`, Headshot,
  569 B, Priya Raman, Aug 11; its download control responds without navigation or error.
- The assignments board reflects the portal round-trip without opening records: Priya has 1
  outstanding / 2 done while Marcus, Dana, and the blank organizer-contact row each have 3 / 0.
  It provides a **Has outstanding** filter but no separate complete/incomplete split and displays
  counts rather than individual task titles at table level.
- Communications supports all-speaker selection, merge tokens, and a per-recipient preview. The
  fixture welcome campaign resolved `Hello Priya Raman, welcome to DevFlow Conf 2027. View your
  portal at /portal.`, sent to 4, and is logged at Aug 11, 2:28 PM with recipient rows/statuses.
  The recipient group incorrectly includes the blank `jordan.organizer@...` contact as a speaker.
- No organizer-editable travel/logistics or generic custom field was found; Spotlight only displays
  read-only `No travel or logistics notes.` The automated reminder-rule UI exists (enable switch,
  days-before-due, Run now), but actual scheduled email delivery remains evaluator-manual.

### Checkpoint 13 — content collection setup

- Sessions has no direct **Add session** action; only the accepted SESS-1 exists in the session
  handoff list. Therefore the scenario's preferred new Marcus-only **Lightning: Agents in
  Production Q&A** session cannot be created through the ordinary session UI. SESS-1 already links
  both distinct fixture speakers and remains the safe file-collection target.
- Created session requirement **Upload Session Presentation** with exact instructions `Final slide
  deck as a PDF, 16:9 aspect ratio.`, due May 1, 2027 at 9:00 AM PDT, `.pdf`, 20 MB max.
- Created session requirement **Upload Final Headshot (print quality)** with `Final print-quality
  headshot.`, due Apr 14, 2027 at 9:00 AM PDT, `.png,.jpg`, 5 MB max.
- Deliverables lists both requirements, correct dates/constraints, and 0 of 1 sessions uploaded.
  The central Files dashboard creates one outstanding row per requirement/session and lists both
  Marcus Okafor and Priya Raman on each row. This is a session-centric assignment model rather than
  the evaluator's preferred 2-speaker x 2-task rows, but both target speakers are visibly assigned.
- In Priya's portal the requests are not shown under **Tasks**; they live inside accepted SESS-1's
  submission Spotlight. Both show their exact deadlines, descriptions, accepted file types and
  maximum sizes, plus distinct Choose File / Upload actions. CNT-S1 passes.

### Checkpoint 14 — deliverable upload, review, history, and export

- Priya uploaded `slides.pdf` against **Upload Session Presentation**, then replaced it with the
  same fixture. Portal and organizer views show two timestamped versions; the first is **Current**
  and the older remains separately downloadable. The upload UI communicated `.pdf · Maximum:
  20 MB` before selection.
- Priya added `Draft deck - final version coming Friday.`; organizer sees Priya/Speaker and the
  timestamp, and replied `Thanks - please confirm the final version by Tuesday.` with Jordan/
  Organizer and timestamp. The thread round-trip passes.
- Direct `/admin` navigation while signed in as Priya redirects to `/portal`, preserving the
  speaker-only shell. Marcus/Dana content remains absent from Priya's portal.
- During the second picker sequence the headshot requirement was also filled with `headshot.png`.
  Thus Priya's intended mixed presentation-complete/headshot-open fixture state was not preserved.
  More importantly, Files reveals the underlying model is one shared slot per session: once Priya
  uploads, the original outstanding row listing both Priya and Marcus becomes a single uploaded row
  owned by Priya, with no remaining Marcus row. The evaluator's per-speaker/per-task tracking and
  outstanding-recipient reminder semantics therefore fail independently of this test deviation.
- Central Files lists `slides.pdf` with SESS-1, Priya, Aug 11, Uploaded, and version count 2. Its
  Spotlight shows due date, `.pdf · 20 MB`, session/speaker links, both versions, and the comment
  thread. Session filtering changes the library from 3 records to 2.
- No deliverables-specific bulk reminder control was found in Deliverables or Files. The general
  Tasks board has reminders for action tasks, while Communications has a configurable automated
  rule; neither targets the outstanding session-requirement rows as required by CNT-08.
- Bulk export passes: selecting the two SESS-1 uploads enables **Export ZIP (2)**; the dialog states
  only latest versions are included, offers **Group folders by · Session code**, and reaches
  **Ready · 2 latest versions** with a Download ZIP control.
- Session content editing passes fully. First revision added the `UPDATED:` title prefix and live
  remote-cache-demo sentence; second added the laptop sentence. Content history showed two
  timestamped Jordan Alvarez entries. Confirmed restore created a third version, removed only the
  laptop sentence, and retained the live-demo sentence. The title was finally restored to the
  canonical exact value while keeping that abstract edit.
- Organizer profile editing passes: Priya's bio now includes `Priya leads the developer-productivity
  group at Latticework Systems.` and the replaced 256x256 headshot persists after reload; profile
  history now contains 7 versions.
- SESS-1 content status remains **Approved**. SESS-3 and SESS-4 are still pending/unapproved. Public
  approval-gate evidence is deferred until the agenda/public-widget scenarios because no agenda has
  yet been built or published.

### Checkpoint 15 — agenda builder, conflict rules, AI assist, and publication

- Agenda builder exposes a three-day May 12/13/14 switcher, 8:00 AM–7:00 PM 15-minute time grid,
  room columns, track filtering, unscheduled pool, List and Conflicts tabs, AI drafts, and publish.
  Added **Overflow Room** inline; it immediately appears beside the four fixture rooms.
- Accepted SESS-2, SESS-3, and the Marcus-only SESS-4 so the pool contained four real fixture
  sessions. Decision emails are demo-log entries. SESS-4 was later returned to Pending solely to
  isolate the AI scheduler's legal-duration behavior.
- Dragged SESS-1 to May 12, 10:00 AM, Room 2A; the DnD status encoded exact minute 600. Dragging
  SESS-2 to May 12, 10:00 AM, Room 2B produced destructive rings and **Conflicts 1** with
  **Speaker double-booking**, exact interval, both session names, Priya Raman, both rooms, and
  `Priya Raman is assigned to both sessions at once.`
- Moving SESS-2 into the occupied Room 2A at the same time was allowed but correctly produced
  **Conflicts 2**, adding **Room overlap** with exact interval/room and `Both sessions occupy Room
  2A during the same time window.` This satisfies visible flagging rather than hard blocking.
- Moving SESS-2 to May 12, 2:00 PM, Room 2B cleared both conflicts live. SESS-3 was scheduled May
  13, 11:00 AM, Room 2B. Its native 10-minute format is illegal on the 15-minute grid; the UI
  reported **Duration must use 15-minute increments**, so the placement required a 15-minute agenda
  duration. Reload preserved SESS-1/2/3 at exact final locations with Conflicts 0.
- The first AI draft failed on unscheduled 10-minute SESS-4 with **These criteria do not have enough
  legal slots**. After returning SESS-4 to Pending and unscheduling legal 30-minute SESS-2, the AI
  proposal succeeded: a reviewable one-change draft proposed SESS-2 at May 12, 8:00 AM, Main Stage,
  reason `Earliest conflict-free slot, interleaved by track.` **Accept 1 changes** applied it and
  reduced the eligible unscheduled pool to 0.
- **Publish agenda** switched Draft to **Published**, disabled the publish button, and enabled
  calendar invites. Public `/e/devflow-conf-2027/agenda` shows SESS-2 at May 12 8:00 Main Stage,
  SESS-1 at May 12 10:00 Room 2A, and SESS-3 at May 13 11:00 Room 2B.
- The deferred CNT-12 approval-gate check fails: SESS-3 appears publicly even though it never went
  through explicit organizer content approval. Acceptance effectively makes content public, so the
  separate content-review state does not gate the published agenda in this chain.

### Checkpoint 16 — anonymous public program surfaces and itinerary

- All five attendee surfaces render outside the organizer UI without a login: **Sessions**,
  **Speakers**, **Agenda**, **Itinerary**, and **Speaker Gallery** under
  `/e/devflow-conf-2027/*`.
- Sessions shows 3 of 3 published sessions with title, exact time range, room, speaker title/company,
  track, format, level, description, and Show more/Show less. Search narrows correctly by both
  `Taming` and `Marcus`; the Platform & Infra track facet narrows to only SESS-1. Track, Format, and
  Room facets are present.
- Speakers and Gallery both order Marcus Okafor before Priya Raman by surname, show role/company,
  support name search, and degrade to initials for Marcus's missing image. Priya's detail shows the
  persisted headshot, full biography, and all three linked sessions with dates/times/rooms.
- Agenda is a day/time structured list rather than a room-grid, but it correctly switches May 12
  and May 13. SESS-1 detail includes the exact 10:00–10:30 AM range, Room 2A, Platform & Infra,
  Talk, full description, both speakers, and a close control.
- Itinerary is anonymous and chronological by day. Added SESS-2 and SESS-1; **My Schedule (2)**
  contained exactly those two in time order after a full reload. ICS export was enabled and
  responded without error. Removing SESS-2 left exactly SESS-1 in **My Schedule (1)**.

### Checkpoint 17 — widget generation, rendering, and consistency

- Created enabled widget `uxV26dtk8_xb6WyEZFlL6`, named **Evaluator Sessions Widget**. The saved
  list identifies it as Sessions, shows its update date, and exposes an enabled switch.
- The type picker covers all five evaluator surfaces: Sessions, Speaker list, Speaker gallery,
  Agenda, and Itinerary. Configuration includes track/format/day/tag filters; theme; 12/24-hour
  time; primary color with a companion hex-value input; and seven field-visibility toggles. No
  custom-CSS editor is present.
- Platform & Infra persisted as the sole track filter. After reload the live preview renders exactly
  one session, SESS-1, with the configured content fields. The preview initially stayed at 3
  sessions immediately after the filter save despite claiming `Updates live`; reload corrected it.
- The generated share URL is:
  `https://app.opensesh.io/embed/uxV26dtk8_xb6WyEZFlL6?view=sessions&theme=auto&color=default&time=12h&tracks=trk_devflow_platform&formats=&days=&tags=&company=1&title=1&bio=1&description=1&level=1&format=1&calendar=1`
- The generated iframe snippet, verbatim, is:
  `<iframe src="https://app.opensesh.io/embed/uxV26dtk8_xb6WyEZFlL6?view=sessions&theme=auto&color=default&time=12h&tracks=trk_devflow_platform&formats=&days=&tags=&company=1&title=1&bio=1&description=1&level=1&format=1&calendar=1" title="Evaluator Sessions Widget" width="100%" height="640" style="border:0" loading="lazy"></iframe>`
- Navigating directly to the generated URL renders the one filtered session. SESS-1 exactly matches
  organizer/public data: **Taming 40-Minute CI: Incremental Builds at Monorepo Scale**, Wednesday
  May 12 10:00–10:30 AM, Room 2A, Platform & Infra.
- EMB-15 is partial rather than full: the builder only emits a Share URL and iframe snippet, not
  styled/basic HTML, JSON, XML, or iCal format families. In the current viewport the fixed
  **Demo roles** button also sits directly over **Get code**, making the pointer action unusable;
  the exact outputs above were captured from the preview URL and verified against the shipped
  generator implementation. The direct embed itself renders correctly.

### Checkpoint 18 — optional organization-level Speaker CRM

- CRM is explicitly organization-level (`AI.Engineer · Organization workspace`) and holds 28
  contacts aggregated by email across 2 events. Search `Priya` narrows to the two same-name
  contacts; company filter Latticework Systems further narrows to the correct fixture record, and
  filters are clearable.
- Event-level `speakers.csv` import is reflected in CRM: Marcus and Priya retain correct fixture
  identity fields, while Dana was created in the prior import. The CRM also exposes its own Import
  CSV action. Per the chained-run instruction, the same file was not uploaded a second time.
- Saved **AI Experts** as a dynamic segment from the Priya/Latticework filter. Reopening it shows
  one current member and the active criteria. Priya's CRM profile exposes canonical identity,
  three linked sessions, communication history, and chronological activity. The exact internal
  note `Met at DevFlow 2026 - strong on CI topics; shortlist for keynote.` and tag `AI` both persist
  after reload.
- Duplicate detection reports one pair and opens a side-by-side canonical-primary flow for the two
  Priya records, with a combined-profile preview and explicit cannot-be-undone acknowledgement.
  Confirmation was deliberately cancelled because it removes a seeded record and the run's safety
  contract prohibits destructive mutations; existence/depth is proven, but post-merge survival is
  not claimed.
- Pipeline has Prospect/Open, Contacted/Open, Confirmed/Won, and Declined/Lost stages. Enrolled
  Marcus with `Strong platform-engineering track record; ideal for Platform & Infra track.`, then
  dragged Prospect → Contacted → Confirmed. Both moves persisted after reload. The dropdown Move
  control is currently unreliable because its selected value resets before the adjacent button can
  activate; drag-and-drop works and produces an accessible drop-status message.
- Marcus detail shows timestamped Not in pipeline → Prospect → Contacted → Confirmed history. The
  exact note `Left voicemail 2027-01-15; follow up next week.` persists after reload and also appears
  in chronological Activity. His existing DevFlow event handoff retains email, title, company, bio,
  and SESS-1/SESS-4 links without re-entry.
- Bulk CRM outreach selected two contacts, resolved `{speaker_name}` separately for Sofía Alvarez
  and Samira Bello, sent subject **Speak at DevFlow Conf 2027?**, and reached **Campaign sent · 2
  recipients**. Overview immediately logs the campaign and shows 28 contacts, 2 events, 3 open,
  2 won, 1 lost, 90% profile completeness, and populated pipeline distribution; KPI totals match
  the directory and board.

### Checkpoint 19 — CFP deadline enforcement and event isolation

- Temporarily changed the seeded CFP close date from Nov 30, 2026 to Aug 10, 2026 while leaving
  **Form open** enabled. After the autosave reached Saved, the public route rendered only
  **Submissions are closed** and `This form is no longer accepting new or updated submissions.`
  This proves both new-submission closure and post-close edit locking are date-driven rather than
  merely an organizer toggle. Restored the exact original **Nov 30, 2026, 3:59 PM PST** deadline
  and confirmed Saved before leaving.
- The event switcher lists seeded **DevFlow Conf 2027**, **AI.Engineer Sandbox — NYC 2026**, and
  the newly created **DevFlow Conf 2027 — Codex E2E** concurrently. In the Codex E2E event,
  Submissions says `Collect your first submission`, Sessions says `No sessions are ready yet`, and
  Speakers says `Add your first speaker`; none of the seeded Priya/Marcus/submission/session data
  leaked across. Returned the active event to seeded DevFlow Conf 2027 after verification.

## Strict manual grade

This is an evidence-based hand application of the harness's own scoring model, not generated by
its API-key-dependent LLM judge. `pass = 1`, `partial = 0.5`, and `fail = 0`; item weights are
normalized within each area, then required area percentages are multiplied by their area weights.
Optional Speaker CRM is reported separately exactly as the harness does.

- Required: **89.4%** at full browser coverage (72 pass, 8 partial, 6 fail across 86 items).
- Optional Speaker CRM: **94.7%** (10 pass, 2 partial across 12 items).
- The current YAML files sum to **183 required item-weight points** and Public Widgets to 35. The
  evaluator README still says 182/34, so its inventory prose is one point stale after the latest
  public-widgets change; the score here uses the executable YAML as source of truth.

### Deductions

| Rubric | Verdict | Why |
|---|---|---|
| CFP-01 (w3) | partial | Seeded builder can produce the required public fields, but a fresh form has duplicate Title fields, bad type behavior, and a non-atomic Save failed state. |
| CFP-05 (w3) | fail | A complete public proposal cannot submit because UI participants use role `speaker` while the form requires `Primary speaker`. |
| CFP-08 (w1) | fail | Submission confirmation email cannot be triggered because the final submit itself is blocked. |
| CFP-09 (w2) | partial | Draft editing/resume works, but a submitted-proposal edit round-trip cannot be completed through the broken submission path. |
| ABS-04 (w1) | partial | Weighted criteria exist, but the only unequal weighted review disappears from Results after acceptance, so its 3.33 aggregate is not durable evidence. |
| ABS-09 (w1) | partial | Bulk reminder action accepts the reviewer selection but provides no visible sent/queued confirmation. |
| ABS-10 (w3) | partial | Aggregate results exist, but accepted SESS-1 disappears from the table/export; durable all-disposition sorting/reporting is incomplete. |
| ABS-14 (w1) | fail | AI triage is exposed but produces no score/reasoning without a configured Anthropic key. |
| SPK-15 (w1) | fail | No organizer-editable travel/logistics or general custom-field value exists on the event speaker record. |
| SPK-16 (w1) | partial | Automated reminder rules and Run now exist, but real due-date-driven email delivery was not verified. |
| CNT-07 (w3) | partial | Dashboard is session-slot-centric; one speaker upload removes the other speaker's outstanding row instead of tracking per-speaker/per-task state. |
| CNT-08 (w2) | fail | No deliverables-specific bulk reminder action/confirmation targets outstanding upload recipients. |
| CNT-12 (w3) | fail | Unapproved SESS-3 is public after agenda publication; content approval does not gate public output. |
| EMB-15 (w3) | partial | Builder/list/config/iframe render pass, but outputs are only Share URL + iframe; Get code is pointer-covered by Demo roles and no JSON/XML/iCal or styled/basic format family exists. |
| CRM-06 (w1) | partial | Duplicate warning, primary selection, combined preview, and destructive warning exist; final merge was intentionally not executed under the run's no-delete rule. |
| CRM-11 (w1) | partial | Composer, resolved merge preview, two-recipient success, and logged campaign pass; actual mailbox delivery was not verified. |

### Highest-priority product defects outside or broader than individual rubric deductions

1. New-account onboarding and organization creation are both broken, so a clean judge can be
   stranded before reaching the otherwise strong product.
2. Final CFP submission is impossible with the seeded participant-role configuration.
3. Fresh CFP saves are non-atomic and can persist the form row while field replacement fails.
4. Content collection is not modeled per speaker, and approval does not gate publication.
5. Several mutations show stale UI until reload (review assignment, CRM enrollment); the CRM Move
   dropdown also resets before its button can be used, although drag-and-drop succeeds.
6. The fixed Demo roles utility can cover primary bottom-right controls, including widget Get code.

## Resume instructions

1. Read this file and `/private/tmp/killmysaas-evals/README.md`.
2. Confirm the evaluator checkout is still at commit `2b0f7956ab0c6f4868d41356e495b3a225badaab`; record any update before continuing.
3. Resume at the first `pending` or `blocked` scenario in the checkpoint table.
4. Use the production IDs/URLs in **Run entities** rather than creating duplicates.
5. After each scenario, update its status, evidence, last-checkpoint timestamp, and area score notes.
