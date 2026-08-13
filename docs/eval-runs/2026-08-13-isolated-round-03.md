# Production Evaluation — Isolated Round 03

Status: **COMPLETE — FROZEN READ-ONLY RUN**
Started: 2026-08-13
Completed: 2026-08-13
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
| Speaker 2 | Marcus Okafor — `sbek-speaker2+r03-20260813-001@example.com` | Added as a Round 03 co-presenter |
| Reviewer | Sam Whitfield — `sbek-reviewer+r03-20260813-001@example.com` | Created in Round 03 |
| Attendee | Anonymous non-admin browser state | Verified across all public surfaces; no account required |
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

User direction changed the evidence protocol after AIA-S2: do not spend further time on screenshots. EMB-S1 through CRM-S2 therefore use contemporaneous written observations, exact values/URLs, persisted-state checks, and browser diagnostics only. Earlier evidence remains untouched.

## Scenario ledger

| Scenario | Description | Status | Evidence / observations |
| --- | --- | --- | --- |
| CFP-S1 | Organizer builds and publishes the CFP | Complete | `001`–`018`; public form `https://app.opensesh.io/submit/devflow-conf-2027-3/O37jjey2KkezEeX6Rb4xd` |
| CFP-S2 | Speaker drafts, submits, and edits proposals | Complete | `019`–`032`; new submissions `SESS-1` and `SESS-2` |
| CFP-S3 | Organizer assigns a reviewer; reviewer scores | Complete | `033`–`039`; round `6u-T1pevz5n35zzKKElXH`, only `SESS-1` assigned |
| CFP-S4 | Organizer decides, notifies, hands off, and closes the CFP | Complete | `040`–`052`; accepted session created, both decision emails logged, public CFP closed |
| ABS-S1 | Speaker seeds submissions with a co-author | Complete | `053`–`057`; Marcus persisted as Co-presenter, three proposals visible |
| ABS-S2 | Organizer configures rounds, pools, assignments, reminders | Complete | `058`–`067`; two independent rounds, exact 2 assignments, 2/0 baseline, reminder log |
| ABS-S3 | Reviewer scores blind; organizer checks aggregates and export | Complete | `068`–`080`; blind queue, exact stored reviews, weighted 3.33/5.00, sorts, 2/2, export |
| SPK-S1 | Organizer builds the speaker roster and assigns onboarding tasks | Complete | `081`–`092`; isolated Priya confirmed, fixture CSV imported, three tasks assigned to isolated Priya/Marcus, invite logged |
| SPK-S2 | Speaker completes onboarding in the portal | Complete | `093`–`101`; scoped portal, accepted session, persisted portal bio/headshot, tasks 2/3 complete |
| SPK-S3 | Organizer tracks progress and sends bulk communications | Complete | `102`–`109`; synced portal profile/file/tasks, 5-recipient resolved campaign, persisted travel notes |
| CNT-S1 | Organizer sets up content collection | Complete | `110`–`113`; two distinct sessions, two one-upload-per-session requirements, all outstanding |
| CNT-S2 | Speaker uploads and versions a deliverable | Complete | `114`–`120`; exact constraints, two `slides.pdf` versions with current marker, comment, headshot outstanding, admin redirect and speaker scope |
| CNT-S3 | Organizer tracks, reviews, approves, and exports | Complete | `121`–`138`; dashboard/filter/reminders, file metadata/thread, content history+restore, profile edit, approval split, ZIP ready, title cleanup |
| AIA-S1 | Build agenda structure, place sessions, trigger and resolve conflicts | Complete | `139`–`149`; four rooms, four schedulable sessions, speaker+room conflicts, live clear, persisted final list |
| AIA-S2 | Auto-schedule assist and publish the agenda | Complete | `150`–`157`; reviewable AI draft auto-placed SESS-4, explicit accept, publish confirmation, complete public agenda |
| EMB-S1 | Non-admin tour of the four browse widgets | Complete | Anonymous Sessions, Speakers, Agenda, and Speaker Gallery; written observations only per user direction |
| EMB-S2 | Schedule itinerary browsing and personal-schedule building | Complete | Two selections, exact personal view, reload persistence, removal, and ICS download confirmation |
| EMB-S3 | Organizer embed generation, snippet retrieval and data consistency | Complete | Saved `R03 Platform Sessions` widget; live filtered iframe, share URL, JSON, and ICS endpoints |
| CRM-S1 | Build and organize the speaker database | Complete | Three fixture contacts, search/filter/segment, persistent note/tag/custom field, CSV update import, duplicate merge |
| CRM-S2 | Source a speaker through the pipeline and reuse across events | Complete | Six-stage board, persistent Marcus moves/note/history, bulk personalized campaign, populated overview; event handoff only partial |

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

### CFP-S3 — Organizer assigns a reviewer; reviewer scores

- Signed in as the Round 03 organizer and verified the event submission list contains exactly `SESS-1` and `SESS-2`. Opened `SESS-1` and verified its title, Platform & Infra track, Talk format, Intermediate level, Priya Raman speaker identity and biography, and the persisted `Updated: now includes 2026 benchmark data.` sentence.
- Created review round `Round 03 CFP review` (`6u-T1pevz5n35zzKKElXH`) with the default prefilled scorecard: Originality numeric 1–5 weight 2, Relevance numeric 1–5 weight 1, Recommendation Accept/Maybe/Reject, and Comments long text. Set one review per submission, opened the round, and set its close date to Sep 11, 2026.
- Created the Round 03-only reviewer Sam Whitfield at `sbek-reviewer+r03-20260813-001@example.com`. The product supplied this access path: `https://app.opensesh.io/login?email=sbek-reviewer%2Br03-20260813-001%40example.com`.
- Assigned Sam to `SESS-1` only and left `SESS-2` unassigned. Signed out of the organizer account and signed in through Sam's fresh magic link.
- Sam's reviewer-only navigation exposed My Reviews, not the organizer surfaces. The queue contained exactly one assigned proposal across one round: `SESS-1`; it reported `1 pending · 0 completed · 0 recused`.
- Probed the Round 03 `SESS-2` URL while signed in as Sam. The product returned a visible `You do not have access` message and did not expose the proposal.
- Submitted Originality 4, Relevance 4, Recommendation Accept, and the fixture comment: `Strong practical content and a clear narrative arc; abstract could name the specific tooling used. Recommend accept for the Platform track.`
- Verified the queue changed to `0 pending · 1 completed · 0 recused` and `SESS-1` showed `completed` with the entered values retained.
- No console errors or warnings appeared during the scenario.
- Evidence: `033-cfp-s3-organizer-two-submissions.png` through `039-cfp-s3-review-completed.png`. Every file was written and size-verified in this run.

### CFP-S4 — Organizer decides, notifies, hands off, and closes the CFP

- Signed in as Jordan and opened `SESS-1`. The organizer spotlight showed Sam Whitfield's completed review with Originality 4, Relevance 4, Recommendation Accept, and the full fixture comment.
- Accepted `SESS-1` through the decision composer. The fixture acceptance body was entered in Personal message, but the product-generated subject `You're speaking at DevFlow Conf 2027` was not editable and therefore could not be replaced by the fixture subject. The send completed with `1 submission accepted`; the spotlight showed `Notified`, an `Acceptance email sent` activity entry, and a demo email-history record.
- Declined `SESS-2` with the brief personal message `Thank you for the thoughtful proposal. We cannot include it in this year's program, but we hope you will submit again.` The send completed with `1 submission declined`; the spotlight showed `Notified`, a `Decline email sent` activity entry, and a demo email-history record.
- Closed the spotlight and verified the submissions table side by side: `SESS-1 accepted Sent` and `SESS-2 declined Sent`.
- Opened Sessions. Acceptance had automatically created exactly one `SESS-1` session. Its spotlight showed the fixture title, `Talk · Platform & Infra`, Priya Raman, and the updated abstract.
- Set the CFP close date to Aug 12, 2026, 9:00 AM PDT. The form briefly showed `Unsaved`, then `Saved`; both states were captured and the saved state was used for verification.
- Signed out and loaded the exact public CFP URL. It showed `Submissions are closed` and `This form is no longer accepting new or updated submissions.` with no entry control.
- Signed in as Priya. Her dashboard showed exactly `SESS-1 ... accepted` and `SESS-2 ... declined`, plus the accepted-session participation prompt. Opening `SESS-1` showed `This submission form is closed. Your content is now read-only.` and no edit control.
- No console errors or warnings appeared during the scenario.
- Evidence: `040-cfp-s4-organizer-sees-review.png` through `052-cfp-s4-speaker-editing-locked.png`. Every file was written and size-verified in this run.

### ABS-S1 — Speaker seeds submissions with a co-author

- As required by the chained precondition, Jordan reopened the same Round 03 CFP by restoring its close date to Apr 30, 2027, then signed out. This reused only Round 03 state.
- Signed in as Priya and edited the existing accepted `SESS-1` rather than duplicating it. Added Marcus Okafor at the Round 03-only email `sbek-speaker2+r03-20260813-001@example.com`, selected the explicit `Co-presenter` role, and entered his fixture biography.
- Captured the complete two-speaker editor before save. After `Save speakers`, the UI showed `Speakers saved` but briefly collapsed back to `Speakers (1)`. A clean reload revealed `Speakers (2)` with Marcus and every entered field intact; persistence succeeded and the immediate post-save UI was stale.
- Reused existing `SESS-2` as-is and submitted only the guaranteed-new third proposal, `SESS-3 Docs That Answer Back: Retrieval-Grounded Documentation Sites`, with Lightning Talk, Developer Experience, Beginner, fixture abstract, and a required takeaway.
- Priya's dashboard showed exactly three proposals and their exact statuses: `SESS-1 accepted`, `SESS-2 declined`, and `SESS-3 pending`.
- Reopened `SESS-1` and captured both participants with role labels: Priya `Primary speaker`, Marcus `Co-presenter`; Marcus's Round 03 email and full biography persisted.
- No console errors or warnings appeared during the scenario.
- Evidence: `053-abs-s1-co-speaker-before-save.png` through `057-abs-s1-co-speaker-detail.png`. Every file was written and size-verified in this run.

### ABS-S2 — Organizer configures rounds, pools, assignments, reminders

- Signed in as Jordan and verified all three Round 03 submissions in the organizer table, including both Priya Raman and Marcus Okafor on `SESS-1`.
- Created blinded round `Initial Review` (`LDolbdBVTU-BQv2bhY_3z`) open Aug 1–Oct 15, 2026 with one review per submission and four criteria: Originality 1–5 weight 2, Relevance 1–5 weight 1, Recommendation Accept/Maybe/Reject, and Comments long text. The editor preview explicitly displayed `Blind` and both weights.
- Created distinct round `Final Review` (`58kAFOpgA7vjyOZ2WpT5u`) for Oct 16–Nov 30, 2026 with its own two-field scorecard: Final Score 1–10 weight 1 and Comments long text. Reloaded the rounds index; it showed Initial Review as Blind with four criteria and Final Review as Identified with two criteria and zero reviewers.
- Added Sam Whitfield only to the Initial Review pool at the existing Round 03 reviewer email. The round-specific pool showed `1 reviewer in this round only`, `Generalist`, and `Cap 5`; the Final Review row remained at zero reviewers. A fresh copyable reviewer access path was displayed.
- The assignment UI provided both an `Auto-distribute` control and an All tracks filter. Assigned exactly `SESS-1` and `SESS-2` to Sam and deliberately left `SESS-3` unassigned. The resulting state showed two pending Sam assignments and one Unassigned row.
- Progress showed Sam with Assigned 2, Completed 0, Recused 0, Remaining 2, Completion 0%.
- Selected Sam and triggered Send reminders. The action provided no visible toast or in-page confirmation and cleared the selection asynchronously. A verification retry therefore sent a second reminder. Email Delivery subsequently showed two Round 03 records with subject `Initial Review: 2 pending reviews`, recipient Sam, status Demo. This proves sending worked but also records the duplicate caused by absent feedback.
- No AI evaluation/triage/persona/score control was visible in the round setup, assignment, progress, or results navigation; the optional AI step was recorded absent.
- No console errors or warnings appeared during the scenario.
- Evidence: `058-abs-s2-organizer-three-submissions.png` through `067-abs-s2-reminder-email-log.png`. Every file was written and size-verified in this run.

### ABS-S3 — Reviewer scores blind; organizer checks aggregates and export

- Signed in as Sam through his Round 03 magic link. His queue showed three total assignments across two Round 03 rounds: the already-completed `SESS-1` in Round 03 CFP review, and exactly the two expected pending Initial Review assignments (`SESS-1`, `SESS-2`). `SESS-3 Docs That Answer Back` was absent.
- Opened Initial Review `SESS-1`. The page was explicitly labeled `Blind review`; Priya Raman, Marcus Okafor, Latticework Systems, emails, biographies, and the prior round's score were all absent. The control was worded exactly `Recuse`; it was observed but not clicked so the assigned review remained available.
- Submitted and retained Originality 4, Relevance 2, Recommendation Accept, and the full fixture comment. The queue moved to 1 pending / 1 completed; the still-open scorecard showed the stored values after submission.
- Submitted `SESS-2` with Originality 5, Relevance 5, Recommendation Accept, and `Excellent fit for the AI Engineering track.` The queue moved to 0 pending / 2 completed and both Initial Review entries showed completed.
- Signed in as Jordan and opened Initial Review Results. It explicitly labeled the table `weighted numeric criteria`. `SESS-1` displayed 3.33, matching `(4×2 + 2×1) / 3`; `SESS-2` displayed 5.00. The earlier CFP-S3 review was correctly isolated to its own round and not pooled into this round's aggregate.
- Captured descending order `SESS-2 (5.00), SESS-1 (3.33), SESS-3 (—)`, clicked Aggregate, and captured ascending numeric order `SESS-1 (3.33), SESS-2 (5.00), SESS-3 (—)`.
- Opened the `SESS-1` result spotlight: it showed Priya's Round 03 email as Primary speaker, Marcus Okafor as Co-presenter, the exact stored scorecard, weighted aggregate 3.33, Sam's human review, and the fixture comment. The linked full organizer submission page showed Priya Raman and Marcus Okafor by name, both emails and biographies, including Latticework Systems and Cloudreach Labs.
- The result spotlight exposed an `AI first-pass` section, but it said `Anthropic key not configured` and offered no runnable or override control. The optional AI score could not be produced in this production deployment.
- Progress showed Sam Assigned 2, Completed 2, Remaining 0, Completion 100%. Export CSV was triggered and the product confirmed `Exported 3 submissions`. The downloaded bytes were inspected after the browser scenario; see Post-run artifact verification below.
- No console errors or warnings appeared during the scenario.
- Evidence: `068-abs-s3-reviewer-queue.png` through `080-abs-s3-export-triggered.png`. Every file was written and size-verified in this run.

### SPK-S1 — Organizer builds the speaker roster and assigns onboarding tasks

- Opened the fresh event speaker directory before any CSV import. It contained exactly the two Round 03 people promoted through the accepted submission: Priya Raman and co-presenter Marcus Okafor. Priya was linked to `SESS-1`; both initially showed zero tasks.
- Exercised manual add with Priya's complete fixture profile. Saving correctly refused the duplicate Round 03 email with `A speaker with this email already exists.` Edited the existing contact instead, setting Principal Engineer, Latticework Systems, the full fixture biography plus `SBEK-ORG-EDIT-01`, Confirmed, Vegetarian, M, Twitter, and LinkedIn. Reload verified every value, profile approval/history, Confirmed status, and the linked `SESS-1` session persisted.
- Edited the existing Round 03 Marcus contact to Staff Developer Advocate, Cloudreach Labs, and his full fixture biography.
- Uploaded the prescribed `speakers.csv` through the browser's real file-chooser interface. Header mapping correctly recognized name, email, title, company, and bio; all three rows parsed with zero errors. Because the CSV fixture uses `priya.speaker@sbek-test.example.com` and `marcus.speaker@sbek-test.example.com` rather than the required isolated Round 03 identities, it reported zero matches and created all three rows. The resulting five-person roster contained Dana Kowalski plus duplicate display names for Priya and Marcus with distinct emails.
- Verified searching `Priya` reduces the roster to the two distinct Priya contacts, clearing restores all five, and the Confirmed status filter isolates only the Round 03 Priya contact.
- Created the exact three prescribed general tasks and assigned each specifically to the two isolated Round 03 identities, not the CSV contacts: `Confirm participation` due Apr 1, 2027; `Complete bio and profile` due Apr 1, 2027; and `Sign speaker release form` due Apr 15, 2027. The assignments board showed exactly Priya and Marcus with three outstanding tasks each.
- Sent Priya a portal invitation. The product confirmed `Sent 1 invitation`, displayed `/portal`, and Email Delivery recorded `Your speaker portal for DevFlow Conf 2027` to the isolated Priya email with Demo status.
- No console errors or warnings appeared during the scenario.
- Evidence: `081-spk-s1-initial-roster.png` through `092-spk-s1-invite-email-log.png`. Every file was written and size-verified in this run.

### SPK-S2 — Speaker completes onboarding in the portal

- The fixture password did not authenticate the existing magic-link-created Round 03 speaker account (`Invalid email or password`). Used the product's explicit `Email me a magic link` flow; the production demo environment rendered an `Open demo magic link`, which opened `/portal` as the same isolated Priya identity.
- Portal home identified Priya Raman and her Round 03 email, showed only her three submissions, profile, and `0 of 3 complete` task summary. A complete visible-text check found Priya and found neither Marcus Okafor nor Dana Kowalski.
- My Sessions showed exactly `SESS-1 Taming 40-Minute CI: Incremental Builds at Monorepo Scale`, Talk, `Not scheduled yet`.
- Edited the portal biography to preserve `SBEK-ORG-EDIT-01` and append `SBEK-PORTAL-BIO-01`; existing LinkedIn and Twitter values were present. Uploaded the exact `headshot.png` fixture through the browser file chooser. Autosave moved from `Saving…` to a pending-approval notice; the profile rendered the blue fixture headshot as Priya's avatar and listed `headshot.png · Current`, Priya Raman · Speaker, date, size, comments, and download control.
- Reloaded Profile and verified the portal sentinel, rendered headshot, version row, and social links persisted.
- Tasks initially showed all three prescribed due dates and `0 of 3 complete`. Marked Confirm participation complete, captured `1 of 3 complete`, then marked Complete bio and profile complete. Deliberately left Sign speaker release form open.
- Reloaded Tasks and verified persistent mixed state: `2 of 3 complete`, both Apr 1 tasks under Done, and Sign speaker release form still open with Apr 15, 2027 due date.
- No console errors or warnings appeared during the scenario.
- Evidence: `093-spk-s2-portal-home-scoped.png` through `101-spk-s2-two-complete-after-reload.png`. Every file was written and size-verified in this run.

### SPK-S3 — Organizer tracks progress and sends bulk communications

- Signed back in as Jordan through the same production demo magic-link path; the fixture password also did not authenticate this magic-link-created organizer account.
- Opened the isolated Priya record. It showed `SBEK-PORTAL-BIO-01`, Headshot Present, pending profile review, the newly uploaded `headshot.png`, 569 B, Priya Raman, date, and a Download control. The file control was clicked; the page remained healthy and no console error or error navigation occurred, although the browser's download-event observer did not receive an event within five seconds. The exact latest-version download bytes were inspected after the browser scenario; see Post-run artifact verification below.
- The same spotlight showed exact mixed task state without opening task detail: Confirm participation Done, Complete bio and profile Done, and Sign speaker release form Open. The assignments board showed list-level aggregate progress for both isolated identities: Priya 1 outstanding / 2 done; Marcus 3 outstanding / 0 done.
- The task board offers `Has outstanding` and task-name filtering but no Complete-only status filter. The required mixed state is visible directly, but separate complete/incomplete filtered screenshots are not possible.
- Created template `Round 03 speaker welcome` with subject `Welcome to DevFlow Conf 2027 speakers` and tokenized body `Hi {speaker_name}, welcome to {event_name}. Your session is {talk_title}. Open your portal: {portal_url}`. Captured the tokenized template and per-recipient preview. Priya's name, event, and portal resolved, but `{talk_title}` resolved to an empty string despite her linked accepted session.
- Kept the explicit All speakers audience, which comprised all five current directory contacts including the fixture-created duplicates. Sent the campaign; the product confirmed `Sent 5 campaign emails`. Campaign History persisted one campaign with the exact subject/template, five recipients, and timestamp; Priya's speaker email list also showed the welcome message.
- Added `Arrival May 11, aisle seat; dietary: Vegetarian` through the Travel and logistics field, saved, reloaded, and verified the exact value in Contact and logistics.
- Bonus observations: no per-assignment deadline-extension control was visible; the general task surface exposed Open/Done/Waive but no contract/COI task type. The dedicated deliverable types are evaluated later in content management.
- No console errors or warnings appeared during the scenario.
- Evidence: `102-spk-s3-organizer-profile-sync-file.png` through `109-spk-s3-travel-notes-persisted.png`. Every file was written and size-verified in this run.

### CNT-S1 — Organizer sets up content collection

- Reused Round 03 `SESS-1 Taming 40-Minute CI: Incremental Builds at Monorepo Scale` for Priya. Created a distinct new manual accepted session `SESS-4 Lightning: Agents in Production Q&A`, Lightning Talk, AI Engineering, assigned specifically to the isolated Marcus email. Reloaded Sessions and verified both session rows; SESS-4 was correctly labeled Manual with Marcus as its only speaker.
- No separate enable-file-uploads toggle was exposed in Sessions settings, Deliverables, or Files. Upload capability is always available through Deliverables requirements.
- Created session requirement `Upload Session Presentation` with exact instructions `Final slide deck as a PDF, 16:9 aspect ratio.`, due May 1, 2027 at 9:00 AM PDT, one upload per session, `.pdf`, 50 MB. Captured the completely filled form before save.
- Created session requirement `Upload Final Headshot (print quality)` due Apr 14, 2027 at 9:00 AM PDT, one upload per session, `.png,.jpg,.jpeg`, 10 MB.
- After reload, Deliverables showed both requirements, their dates/types/limits, and `0 of 2 sessions uploaded`. Files filtered to the presentation requirement showed exactly two session rows: SESS-1 associated with Priya and co-presenter Marcus, and SESS-4 associated with Marcus; both Outstanding with zero versions.
- The requirement cards report `Remind outstanding (3)` even though they report two session uploads outstanding. This reflects the chained SESS-1 co-presenter plus SESS-4 speaker. The one-upload-per-session dashboard still has exactly the required two session slots per deliverable; Marcus can see content for both sessions because he is legitimately attached to both within this Round 03 chain.
- As with other create flows, the successful requirement toast left the empty state visible until a full reload; persistence was correct.
- No console errors or warnings appeared during the scenario.
- Evidence: `110-cnt-s1-two-distinct-sessions.png` through `113-cnt-s1-presentation-assignment-rows.png`. Every file was written and size-verified in this run.

### CNT-S2 — Speaker uploads and versions a deliverable

- Signed in as the isolated Round 03 Priya identity and opened portal Tasks. The Session files section listed both Round 03 requirements with their instructions, exact deadlines, and Outstanding status: presentation due May 1, 2027 and print-quality headshot due Apr 14, 2027.
- Expanded Upload Session Presentation. The product exposed the exact configured constraints before selection: `Accepted: .pdf · Maximum: 50 MB`.
- Used the visible product Upload control and the browser file-chooser event to select the prescribed `slides.pdf` fixture. The mutation completed without a manual save step; task progress moved from 2 of 5 to 3 of 5, the requirement changed to Uploaded, and the version list showed `slides.pdf · Current`, Priya Raman · Speaker, date, and size.
- Added the exact comment `Draft deck - final version coming Friday.` and verified it persisted in the file thread under Priya Raman · Speaker.
- Used the visible Replace control and the same browser file-chooser path to upload `slides.pdf` again. The version list then contained two separate `slides.pdf` entries and marked only the newest row Current. The comment remained attached to the file thread.
- Deliberately left Upload Final Headshot (print quality) Outstanding. Portal home summarized `1 of 2 files uploaded` for SESS-1 and named the headshot as the next due item.
- Navigated directly to `/admin` while still signed in as Priya. The product redirected to `/portal` and exposed no organizer surface. My Sessions contained only Priya's accepted SESS-1; the Marcus-only manual SESS-4 and Dana Kowalski were absent.
- No console errors or warnings appeared during the scenario.
- Evidence: `114-cnt-s2-portal-deliverables-before.png` through `120-cnt-s2-speaker-scope.png`. Every file was written and size-verified in this run.

### CNT-S3 — Organizer tracks, reviews, approves, and exports

- Signed in as the isolated Round 03 organizer and opened the central Files dashboard. Its five records accurately included the SESS-1 `slides.pdf` upload with Priya and Marcus, Aug 12 upload date, Uploaded status, and version count 2; the SESS-4 presentation remained Outstanding; both session headshot slots remained Outstanding; Priya's separate profile `headshot.png` appeared as an uploaded profile file.
- Applied the Outstanding filter. The visible set changed from five records to the three outstanding session slots and exposed `Remind outstanding (4)`. Triggering it produced the explicit confirmation `Queued 4 reminders`.
- Opened `slides.pdf`. The organizer detail showed exact deliverable constraints, SESS-1 and both speakers, two individually downloadable versions with only the newest marked Current, and Priya's exact timestamped comment. Replied `Thanks - please confirm the final version by Tuesday.` and verified both roles in the same thread.
- Edited SESS-1 through Content: prefixed the title with `UPDATED: ` and appended `This session now includes a live demo of remote build caching.`. Save and approve persisted both fields, produced a Jordan-attributed history entry, and updated the Content list. Reopened the session, appended `Attendees should bring a laptop.`, and saved a second distinct Jordan revision.
- Content history then showed three versions including two distinct Jordan Alvarez entries with timestamps. Expanded the version immediately before the second edit, inspected its title/description diff, and restored it. The restored current abstract retained the live-demo sentence and no longer contained the laptop sentence; the product added another attributed approved version rather than deleting history.
- Edited Priya's organizer-side profile. Appended `Priya leads the developer-productivity group at Latticework Systems.` and saved; replaced the headshot with the exact `headshot.png` fixture through the visible product control. A clean reload showed the full appended biography, Headshot Present, Approved, six history entries, the current visual avatar/file, and confirmation `Priya's headshot replaced and approved` during the mutation.
- Captured the approval gate side by side: SESS-1 Approved and SESS-4 Awaiting approval. No public agenda or widget exists yet in this isolated event—the Widgets surface explicitly showed `Publish your first widget`—so public-output verification is deferred exactly as permitted to the agenda/public-widget scenarios. No fixture state from another run was used.
- Selected both currently uploaded files (`slides.pdf` and profile `headshot.png`) in Files and opened Export ZIP. The dialog explicitly said only the latest version of each of the two selected files would be included, offered grouping by Session code, and moved to `Ready · 2 latest versions` with a Download ZIP control. The archive bytes were inspected after the browser scenario; see Post-run artifact verification below. No share-link action was present.
- Final cleanup restored the exact canonical title `Taming 40-Minute CI: Incremental Builds at Monorepo Scale` while retaining the restored live-demo abstract. The Content list showed the canonical title Approved and SESS-4 Awaiting approval.
- The browser diagnostic log was empty at scenario completion; no console errors or warnings were observed.
- Evidence: `121-cnt-s3-files-unfiltered.png` through `138-cnt-s3-title-restored.png`. Every file was written and size-verified in this run.

### AIA-S1 — Build agenda structure, place sessions, trigger and resolve conflicts

- Opened the Round 03 agenda builder in Draft state. The initial Rooms view exposed all three event days, an 8:00 AM–7:00 PM 15-minute grid, room columns, unscheduled pool, track filter, List and Conflicts views, AI drafts, and Publish agenda.
- Created the four fixture rooms through the inline agenda UI: Main Stage, Room 2A, Room 2B, and Workshop Lab. All appeared immediately as schedulable columns and survived navigation/reload. The pre-existing chained tracks were confirmed on session peeks/cards: Platform & Infra, AI Engineering, and Developer Experience.
- Promoted the Round 03 SESS-2 and SESS-3 proposals to Accepted through the normal decision UI so they became sessions. SESS-2 already had Priya Raman as its speaker, giving the required shared-speaker pair with SESS-1; the unscheduled pool then contained all four accepted Round 03 sessions.
- Scheduled SESS-1 at May 12, 10:00 AM in Room 2A with the click-to-schedule editor. The grid rendered its title, SESS-1 code, Priya Raman and Marcus Okafor, and the unscheduled count dropped.
- Scheduled SESS-2 at the same May 12 10:00 AM in Room 2B. Conflicts updated live from 0 to 1. The Conflicts panel explicitly reported `Speaker double-booking`, May 12 10:00–10:30, named SESS-2 and SESS-1, named Priya Raman, named Room 2B and Room 2A, and explained `Priya Raman is assigned to both sessions at once.`
- Scheduled SESS-3 at May 12 10:00 AM in the already occupied Room 2A. Placement was accepted but visibly flagged; Conflicts rose to 4 because SESS-3 also carries Priya. The first article explicitly reported `Room overlap`, named SESS-3 and SESS-1, Room 2A, and explained `Both sessions occupy Room 2A during the same time window.` Three speaker-overlap articles were also visible.
- Moved SESS-2 live to May 12, 2:00 PM in Room 2B. Moved SESS-3 live to May 13, 11:00 AM in Room 2B. After the second move, Conflicts changed to 0 without a page reload. Day 2 rendered SESS-3 in the correct room/time.
- Reloaded the page and opened List. It retained exactly: SESS-1 May 12 10:00 AM Room 2A 30 min; SESS-2 May 12 2:00 PM Room 2B 30 min; SESS-3 May 13 11:00 AM Room 2B 10 min; SESS-4 unscheduled 10 min. Conflicts remained 0.
- The browser diagnostic log was empty; no console errors or warnings were observed.
- Evidence: `139-aia-s1-initial-builder.png` through `149-aia-s1-persisted-list.png`. Every file was written and size-verified in this run.

### AIA-S2 — Auto-schedule assist and publish the agenda

- Began from the reloaded AIA-S1 list with SESS-4 deliberately unscheduled. Opened AI drafts; the product explained `Generate, compare, then explicitly accept changes` and kept the live agenda unchanged.
- Created `Round 03 auto-place` across all three days and four rooms with Respect existing placements enabled. The generated comparison proposed exactly one change: SESS-4 from unscheduled to May 12 8:00 AM, Main Stage, reason `Earliest conflict-free slot, interleaved by track.` It selected 1 of 1 and exposed explicit Accept controls.
- Accepted the single proposal. Rooms returned with SESS-4 at 8:00 AM Main Stage, the unscheduled count moved to 0, Conflicts remained 0, and the product confirmed `1 change accepted`.
- Captured the pre-publish state and invoked Publish agenda. The builder changed from Draft/Unpublished changes to Published, disabled the Published button, retained Conflicts 0, and toasted `Agenda published`.
- The public attendee agenda initially showed only SESS-1 because SESS-2, SESS-3, and SESS-4 still had Awaiting approval content. The Agenda screen did not explain this prerequisite. Through the normal Content UI, `Approve all` approved the three scheduled sessions; its success toast appeared immediately but the rows stayed stale until reload. The reloaded Content table showed all four Approved.
- Returning to Agenda still showed Published with no additional publish action required; approval gating is applied dynamically to the published schedule. The attendee URL `/e/devflow-conf-2027-3/agenda` then showed three May 12 sessions with correct times/rooms/tracks, including AI-placed SESS-4, and the May 13 tab showed SESS-3 at 11:00 AM in Room 2B.
- No attendee/public URL is surfaced from the publish button or its options menu; the only post-publish menu item is Unpublish agenda. The public page had to be located by its event-route convention, a material evaluator findability problem recorded below.
- The browser diagnostic log was empty; no console errors or warnings were observed.
- Evidence: `150-aia-s2-ai-drafts-control.png` through `157-aia-s2-public-agenda-day2.png`. Every file was written and size-verified in this run.

### EMB-S1 — Anonymous public program tour

- Signed out completely and loaded the public event surfaces anonymously. Sessions, Speakers, Agenda, Itinerary, and Speaker Gallery all rendered outside organizer UI with no account gate.
- Sessions showed all four approved/published sessions with codes, dates/times, rooms, speakers, job titles, companies, track/format chips, descriptions, and in-place Show more/Show less controls where a description existed. SESS-4, created manually without a description, necessarily had no description or expansion control.
- Search `Taming` narrowed Sessions to 1 of 4 by title. Search `Raman` narrowed it to Priya's three sessions by speaker name. Combining `Raman` with the Platform & Infra facet narrowed it to SESS-1. Track, Format, and Room facets were all visible and the active-filter count updated.
- Speakers rendered two public program speakers in surname order: Marcus Okafor and Priya Raman. Search `Priya` narrowed the list to 1 of 2. Priya's detail opened in place with photo, title/company, biography, and all three sessions with exact times and rooms.
- Speaker Gallery rendered the same two people as visual cards, gracefully falling back to initials for Marcus's missing headshot. Priya's gallery detail contained the same photo, biography, and exact three-session list, and closed back to the intact grid.
- Agenda rendered three May 12 sessions chronologically and one May 13 session. Day navigation changed the visible set. Opening SESS-1 displayed its complete 10:00–10:30 AM range, Room 2A, Platform & Infra, Talk, description, Priya, Marcus, and Close control.
- SESS-1 was consistent everywhere: exact canonical title, May 12 10:00–10:30 AM, Room 2A, Platform & Infra, Talk, Priya Raman and Marcus Okafor. Priya's name/title/company were also identical between list, gallery, session card, and agenda detail.
- Per user direction, screenshot capture stopped after AIA-S2. Evidence for EMB and CRM is this contemporaneous durable written log plus the exact recorded product URLs and values.
- Browser diagnostic log remained empty.

### EMB-S2 — Itinerary and personal schedule

- From the anonymous Sessions surface, added SESS-1 and SESS-2 to My Schedule. Itinerary immediately reported `My Schedule (2)` while retaining an All sessions view.
- Itinerary grouped all four sessions chronologically under Wednesday, May 12 and Thursday, May 13. Cards showed code, full date/time, room, all speakers with title/company, track, format, description, and expansion controls.
- `My Schedule (2)` contained exactly SESS-1 and SESS-2. A full page reload retained both the selected view and both selections, proving browser persistence.
- Removed SESS-2; the count changed to `My Schedule (1)` and only SESS-1 remained.
- Export ICS produced the explicit notification `Downloaded devflow-conf-2027-3-my-schedule.ics`. Post-run transport-aware inspection verified the personalized export; see Post-run artifact verification below.
- Browser diagnostic log remained empty.

### EMB-S3 — Saved widget and embed generation

- Returned as the isolated Round 03 organizer and opened Widgets. The first Add widget action briefly disabled both empty-state buttons while the empty state remained visible; after the asynchronous create completed, the editor appeared.
- The editor offered Sessions as the default view; Track, Format, Day, and Tag filters; Auto theme; 12-hour time; primary color; visible-field controls for company, title, bio, description, level, format, and calendar; custom CSS with documented stable class hooks; and an enabled switch.
- Named the widget `R03 Platform Sessions` and selected only Platform & Infra. The live iframe immediately narrowed from four sessions to exactly SESS-1 with organizer-source title, speakers, room, time, track, format, and description intact.
- Generated and recorded the exact share URL:
  `https://app.opensesh.io/embed/nsWXu2sb6XLYpP0d_jZ1A?view=sessions&theme=auto&color=default&time=12h&tracks=49lpntaO6SGewTN0ke2Sl&formats=&days=&tags=&company=1&title=1&bio=1&description=1&level=1&format=1&calendar=1`
- Generated iframe snippet:
  `<iframe src="https://app.opensesh.io/embed/nsWXu2sb6XLYpP0d_jZ1A?view=sessions&theme=auto&color=default&time=12h&tracks=49lpntaO6SGewTN0ke2Sl&formats=&days=&tags=&company=1&title=1&bio=1&description=1&level=1&format=1&calendar=1" title="R03 Platform Sessions" width="100%" height="640" style="border:0" loading="lazy"></iframe>`
- JSON feed: `https://app.opensesh.io/embed/nsWXu2sb6XLYpP0d_jZ1A/json`. Calendar feed: `https://app.opensesh.io/embed/nsWXu2sb6XLYpP0d_jZ1A/ics`.
- Loaded the public share URL directly; it rendered exactly one Platform & Infra session with the same data as the live editor and public program. Returning to Widgets after navigation showed the saved `R03 Platform Sessions` card enabled and retrievable.
- Browser diagnostic log remained empty.

## Post-run artifact verification

At the user's request, the exact production artifacts from this isolated event were downloaded and inspected after the browser walkthrough. No product state was mutated and no product fix was made.

- **Evaluation CSV — pass.** The response was HTTP 200, `text/csv`, 1,081 bytes, and parsed as a real 13-column CSV with exactly three submission rows. `SESS-1` contained Sam Whitfield's Originality 4, Relevance 2, Accept recommendation, exact fixture comment, weighted total 3.33, and Completed status. `SESS-2` contained 5/5, Accept, exact fixture comment, weighted total 5.00, and Completed. Unassigned `SESS-3` retained blank reviewer/score fields and Unassigned status. This fully verifies ABS-13.
- **Direct latest-version downloads — pass.** Priya's current `headshot.png` downloaded as a valid 256×256 RGB PNG (569 bytes, SHA-256 `9727e98b19375716494cffa46f09edc60624d8a381199cc63a420a6c0f7174fc`). The current `slides.pdf` downloaded as a valid, unencrypted, one-page PDF 1.4 (608 bytes, SHA-256 `ffc81c3487a25fb311ecba34beaa9a99e88815e87fd9d7b7a46e7c301da42484`). This fully verifies SPK-10.
- **Files ZIP — pass.** The generated archive was a valid ZIP containing exactly `No session/headshot.png` and `SESS-1/slides.pdf`; `unzip -t` reported no errors. Each entry matched the exact current direct-download bytes and hashes above, proving the archive included only the selected latest versions. This fully verifies CNT-14. The `No session` path is expected for a profile headshot with no session association.
- **My Schedule ICS — pass.** The TanStack server-function wire response is a Seroval cross-JSON envelope, not the final browser string. Its string node necessarily contains escaped `\\r\\n` sequences; decoding it with the same Seroval `fromCrossJSON` path used by the client restores 26 actual CRLF delimiters. The resulting 1,059-byte calendar has 26 physical lines, one balanced VEVENT, a maximum folded-line length of 75 bytes, and exactly the selected SESS-1 with the correct UID, May 12 10:00–10:30 AM America/Los_Angeles conversion, Room 2A, title, description, and Confirmed status. This fully verifies EMB-11. The earlier plain-JSON extraction was an evaluator decoding error, not a product defect.
- **Saved-widget calendar feed — pass.** The separate public `/embed/nsWXu2sb6XLYpP0d_jZ1A/ics` endpoint returned HTTP 200 `text/calendar`, 1,069 bytes, 26 actual CRLF-delimited lines, one balanced VEVENT, and the correct filtered SESS-1 fields.

### CRM-S1 — Organization speaker database

- The organization-level Speaker CRM was reachable from the Organization navigation above all event-program modules. Tabs were Directory, Pipeline, Segments, and Overview.
- The fresh CRM empty state exposed only Add contact; Import CSV was absent until at least one contact existed. To continue without silently borrowing event-level records, manually created the three exact `speakers.csv` contacts: Priya Raman, Marcus Okafor, and Dana Kowalski.
- Three rapid successful creates produced three success toasts but immediately rendered only two contacts; reload corrected the directory to 3 of 3. Name, email, title, and company were visible for every row.
- Search `Priya` narrowed to 1 of 3. Company filter `Latticework Systems` independently narrowed to Priya and Clear filters restored the directory. A second title filter was available.
- Saved the active company filter as dynamic segment `AI Experts`. Segments showed `AI Experts · Latticework Systems · 1 contacts`; reopening it restored the dynamic-filter banner and Priya member row.
- Priya's canonical profile exposed identity, tags/custom metadata, events/sessions, internal notes, pipeline, communication history, and activity. Added `Met at DevFlow 2026 - strong on CI topics; shortlist for keynote.` and tag `AI`; reload retained both and added a timestamped Jordan activity entry.
- Added typed custom metadata `Speaker Type = External`. The editor supports Text, Number, and Yes/no value types rather than a reusable dropdown option set. Reload retained the value and reported 1 custom field.
- Created same-name/different-email duplicate `Priya Raman / priya.raman.alt@sbek-test.example.com`. Reload surfaced `Review duplicates 1`. The merge dialog allowed choosing the canonical primary, previewed the combined record, warned the duplicate would be removed while preserving notes/tags/event links/custom metadata/pipeline history, and required acknowledgement. The success toast appeared while both rows and count 4 remained stale; reload reduced the directory to the single original Priya and 3 total contacts.
- Once contacts existed, Import CSV appeared. The native file picker accepted the exact fixture. Mapping auto-selected name/email/title/company/bio, previewed all three rows, and labeled each Update under normalized-email matching. Completion reported 0 Created, 3 Updated, 0 Skipped; the directory remained three deduplicated contacts.
- Browser diagnostic log remained empty.

### CRM-S2 — Pipeline, outreach, reuse, and overview

- The fresh CRM pipeline had no default stages and rendered no board columns until configuration. Created Researching, Identified, Contacted, Interested as open; Confirmed as won; and Declined as lost. The resulting board had six named lifecycle columns.
- Enrolled Marcus Okafor into Identified with card note `Score 85 — Strong platform-engineering track record; ideal for Platform & Infra track.` The submission disabled the dialog but left the board at 0 cards until reload; reload showed Marcus in Identified.
- Moved Marcus to Contacted and then Interested through the Move to menu. The board updated immediately, showed success for both moves, and a full reload retained Marcus in Interested.
- Marcus detail showed all three timestamped transitions: Not in pipeline → Identified, Identified → Contacted, and Contacted → Interested. Added `Left voicemail 2027-01-15; follow up next week.`; reload retained the note and showed it in both Internal notes and chronological Activity.
- The chained event already contained a distinct `marcus.speaker@sbek-test.example.com` speaker imported during SPK-S1. CRM used the same email, so DevFlow was excluded from Add to event, yet the CRM profile still reported `0 linked events`; only Forward Summit 2028 was offered. Therefore the requested explicit Marcus → DevFlow handoff could not be demonstrated and no hidden workaround or extra identity was introduced.
- Selected Dana and Marcus in Directory. `Email selected` opened a two-recipient composer with `{speaker_name}` and `{talk_title}` support and resolved both names in preview. Entered subject `Speak at DevFlow Conf 2027?` and a tokenized invitation body. The only selectable Campaign event was Forward Summit 2028, not DevFlow, for the same current-event/existing-email interaction. Sending reported `Sent 2 personalized emails` and `Campaign sent · 2 recipients`; the record was Demo delivery and was logged under Forward Summit 2028 despite the DevFlow subject/body.
- Overview accurately reported 3 total contacts, 0 events reached, 1 open, 0 won, 0 lost, 86% profile complete, six-stage distribution, three populated companies, one AI tag, and one campaign. Clicking Cloudreach Labs drilled into a one-contact Marcus directory filter.
- Browser diagnostic log remained empty.

## Issues discovered

1. **Timezone selection shifts previously chosen calendar dates during onboarding.** The event was initially set to May 12–14 while the default timezone was Asia/Calcutta. Changing the timezone to America/Los_Angeles displayed May 11–13 because the saved instants were preserved. The user-facing onboarding flow therefore requires choosing timezone before dates or correcting both dates. The settings page states that timezone changes preserve UTC instants, but the ordering makes this easy to miss.
2. **Rapid sequential library additions expose stale UI state.** After saving `Developer Experience`, the immediate snapshot showed only two tracks, then the row appeared while a retry form was already open. The retry had to be cancelled to avoid a duplicate. A similar delayed count occurred for Panel: four formats were shown immediately, five after a later wait. There were no console warnings. The product eventually persisted correctly, but an evaluator can reasonably retry and create duplicates.
3. **Public form cannot be field-tested anonymously.** This is allowed by the eval, but it moves dropdown, conditional, and required-field validation evidence into the speaker scenario and adds an account transition before the first data-entry page.
4. **Confirmation rich text is rendered as escaped markup.** The confirmation page visibly says `<p>Thank you. Your submission has been received.</p>` rather than rendering the paragraph. Confirmation delivery text is otherwise explicit and correct.
5. **Autosave/navigation has an ambiguous intermediate state.** Continue/Review/Submit clicks frequently left the current page visible with a `Checking…` or saving state before navigation completed. The action did complete, but an evaluator can interpret the first click as ineffective and click again. No duplicate submissions resulted in this scenario.
6. **Review administration has the same stale-success ambiguity.** Immediately after creating Sam, the reviewer count briefly remained zero before updating. Saving the review round also appeared to require a second click because the first click provided no immediate transition. The final state was correct and no duplicate reviewer or round was created, but the delayed feedback invites retries.
7. **Decision email subjects are not editable.** The acceptance composer exposes only a Personal message field; its generated subject is fixed. The fixture acceptance body could be included, but the required fixture subject could not be used exactly. Sending, notification indicators, activity, and email history otherwise worked.
8. **Publication approval state did not match the unchecked decision control.** `Also approve content for publication` was deliberately left unchecked during acceptance, but the resulting session immediately displayed `Approved` / `Content approved for publication`. Either the checkbox is not authoritative or another undocumented approval path took precedence; the UI gives the organizer no explanation.
9. **Saving co-presenters momentarily renders stale participant state.** The save toast said `Speakers saved`, but the tab immediately changed from `Speakers (2)` to `Speakers (1)` and displayed only Priya. A clean reload restored both persisted participants. This false-negative success state is highly likely to make an evaluator retry or assume data loss.
10. **Reminder sending has no visible confirmation and invites duplicate email.** After `Send reminders (1)`, the selection eventually cleared but there was no toast, sent count, timestamp, or activity record in the progress view. Retrying to verify the action created a second identical reminder. Only the separate Email Delivery page exposed the duplicate sends.
11. **AI first-pass is deployed but unusable without an Anthropic key.** The capability is discoverable only after opening a submission in Results, where it reports `Anthropic key not configured`. There is no score, written reasoning, run control, or override available in production, so the optional AI rubric cannot be exercised.
12. **The identified reviewer view duplicates participant labels after a co-presenter edit.** The earlier non-blind Round 03 CFP review rendered `Priya Raman · Primary speaker` twice and `Marcus Okafor · Co-presenter` twice. The blind Initial Review correctly hid all identity, and organizer submission data itself contained each participant once, so this is a presentation duplication in the identified reviewer view.
13. **Results initially labels the primary participant by email rather than name.** The Initial Review Results table and spotlight showed Priya as her email address while Marcus appeared by name. The linked full submission page correctly showed `Priya Raman`; the mismatch weakens organizer scanability and suggests incomplete contact-name normalization.
14. **The prescribed speaker CSV cannot merge with an isolated eval identity.** The scenario fixture asks the evaluator to use Round-specific unique emails but `speakers.csv` hard-codes different `@sbek-test.example.com` addresses. The importer correctly matches by email, therefore reports zero matches and creates duplicate Priya/Marcus display names. This is a specification/fixture interaction rather than an importer defect, but it materially complicates later speaker selection and makes name-only rows ambiguous.
15. **Task creation immediately renders a stale template count and empty state.** After each successful save, the toast reported assignment to two speakers but the Templates tab retained its previous count and rows until a full reload. The first task therefore appeared as `Templates (0)` with `Create your first speaker task`; the second remained invisible at `Templates (1)`. Persistence was correct after reload, but the false empty state invites duplicate task creation.
16. **Task assignment defaults to every contact, including CSV-created duplicates.** New tasks initially selected all five directory contacts. Meeting the explicit two-speaker fixture required opening the assignment picker, clearing all, and selecting the two contacts by their full isolated emails. This control is functional and precise, but the default becomes risky after import because duplicate names are visually indistinguishable outside the email-bearing picker.
17. **A speaker account created through the CFP magic-link path does not accept the fixture password later.** The password form returned `Invalid email or password` for the exact Round 03 email and published fixture password. Portal access remained testable because `Email me a magic link` exposed a demo verification link in production. This is acceptable for the rubric's magic-link path, but an evaluator that only attempts the documented password can incorrectly conclude the portal is unreachable.
18. **The communications `{talk_title}` token resolves blank for a speaker with a linked accepted session.** Priya's per-recipient preview resolved her name, event, and portal path, but rendered `Your session is .` even though `SESS-1` is linked in both her organizer record and My Sessions. This makes an advertised merge field unsafe for real campaigns.
19. **Profile approval state becomes internally contradictory after an organizer logistics edit.** Priya's portal update produced two same-time pending-review versions and an Awaiting your review comparison. Saving unrelated travel notes then added an approved organizer version and changed Profile approval to Approved, while the Awaiting your review block and Approve/Reject controls remained visible. The organizer cannot tell whether the portal change is still pending or was implicitly approved.
20. **Task progress lacks a complete-only filter.** The assignment board's default `Has outstanding` filter and task-name selector are useful, but there is no inverse or explicit status filter for completed assignments. Mixed totals are visible at list level, so core progress tracking passes; the requested complete-only slice cannot be produced.
21. **Creating sessions and deliverable requirements leaves stale list/empty state until reload.** Saving SESS-4 returned to a one-session table; saving the first requirement returned to `Create your first deliverable`. Both new records appeared correctly after reload. This repeats the product-wide stale-success pattern and invites duplicate creation.
22. **Deliverable reminder counts mix session slots and speaker associations.** Each one-upload-per-session requirement correctly shows `0 of 2 sessions uploaded`, while its action says `Remind outstanding (3)` because SESS-1 has two speakers and SESS-4 has one. The differing denominators are defensible internally but unexplained in the UI and look inconsistent to an organizer.
23. **The file dashboard cannot express the rubric's per-speaker-per-task state because requirements are session-level.** The SESS-1 presentation row becomes Uploaded for both Priya and co-presenter Marcus after Priya uploads once, while Marcus separately has an Outstanding SESS-4 presentation row. Filtering Outstanding produced three session slots but `Remind outstanding (4)` because reminder recipients are counted per speaker association, not as unique people or visible rows. The data is internally consistent with one upload per session, but the dashboard and reminder count make it hard to answer the organizer's simpler question: which individual speaker still owes which file?
24. **The agenda's inline Add room button stopped responding to locator/DOM activation after the first room.** The control remained visible, enabled, and correctly labeled, but repeated semantic clicks and keyboard activation did nothing. A normal coordinate-based computer click on the same visible button opened the room-name field and allowed all remaining rooms to be added. This is not a data workaround—the same product UI was used—but it is a serious browser-evaluator trip-up on a required CRUD action.
25. **Agenda publication does not surface its attendee URL.** Publish succeeds and the status becomes Published, but `Agenda publication options` contains only `Unpublish agenda`; there is no Open public agenda, copy link, or preview action. The attendee route works and is well rendered, but an evaluator has to infer `/e/{eventSlug}/agenda` or discover it elsewhere.
26. **The agenda does not explain that content approval gates published sessions.** Immediately after publication, the public schedule showed one of four scheduled sessions because only SESS-1 was approved. The builder still said Published and gave no missing-content warning or link to Content. Approving the other three through Content made them appear dynamically, but the separate prerequisite is invisible from the publishing workflow.
27. **Public attendee pages expose the production Demo roles switcher.** Sessions, Speakers, Agenda, Itinerary, and Speaker Gallery all render a floating `Demo roles` control to anonymous viewers. It does not block the rubric, but it materially undermines production polish and signals a demo environment to judges.
28. **Internal evaluation sentinels are publicly visible in the speaker biography.** Priya's public list/gallery detail includes `SBEK-ORG-EDIT-01 SBEK-PORTAL-BIO-01`. The public surfaces correctly round-trip organizer and portal edits; the issue is that the evaluation fixture's persistence markers were stored as user content and consequently leak into attendee-facing copy.
29. **The public program contains only two speaker cards despite the fixture importing three named speakers.** This is internally correct because only Priya and Marcus are assigned to approved published sessions; Dana has no programmed session. It is a fixture/precondition gap worth preserving because a judge expecting three gallery cards may interpret the populated public surface as thin.
30. **The manually created SESS-4 has no public description or Show more control.** The session CRUD used during the chained agenda/content setup did not require or collect a description, so the card cannot satisfy the Sessions List's per-card description/expansion expectation. The other three proposal-origin sessions do render descriptions and expansion normally.
31. **Widget creation initially leaves a disabled empty state on screen.** Clicking Add widget disables both Add widget buttons but shows no progress indicator or editor until the asynchronous create finishes. The editor then appears and autosaves correctly. This repeats the product-wide delayed-success ambiguity.
32. **CRM hides CSV import in the empty state.** A fresh organization CRM exposes only Add contact even though the scenario's primary population path is CSV import. `Import CSV` appears only after at least one contact exists. The evaluator therefore had to manually create fixture contacts before it could test the advertised bulk import.
33. **Rapid CRM contact creation renders stale rows and counts.** Three successful adds produced three success toasts but immediately showed only two contacts. Reload revealed all three. This is the same stale-success defect seen across library, task, session, deliverable, and content create flows.
34. **CRM duplicate merge reports success before removing the duplicate from the view.** After confirming the irreversible merge, the toast said `Merged into Priya Raman`, but the table still showed four rows, both Priya records, and `Review duplicates 1`. Reload corrected it to three rows and one Priya. A reasonable evaluator may conclude the destructive merge failed and retry.
35. **CRM has no default sourcing stages.** The first Pipeline view has zero columns and requires the organizer to invent and configure the entire lifecycle before any contact can be enrolled. The capability is deep once configured, but the empty starting state adds significant setup and product-decision burden compared with a ready-to-use Researching/Identified/Contacted/Interested/Confirmed/Declined pipeline.
36. **Pipeline enrollment has a stale-success state.** Submitting Marcus disabled Add to pipeline but left the dialog open and the board at `0 cards`; only reload showed the persisted card in Identified. Stage moves themselves updated immediately and persisted correctly.
37. **CRM does not reconcile an existing event contact into cross-event history.** The event already contained the exact `marcus.speaker@sbek-test.example.com` identity from SPK-S1. CRM correctly prevented adding that email to DevFlow again, but Marcus's canonical CRM profile still reported `0 linked events` and offered only Forward Summit 2028. The organizer sees neither a usable handoff action nor an accurate existing connection.
38. **CRM campaigns can be forced onto the wrong event context.** Because DevFlow was unavailable in the CRM event picker, the `Speak at DevFlow Conf 2027?` campaign could only be associated with Forward Summit 2028. Personalization and logging worked, but campaign history now says `Forward Summit 2028` under a DevFlow subject. This is a real data-integrity and organizer-trust problem.
39. **Production email actions are Demo-only, not real delivery.** Confirmation, decision, invitation, reminder, general campaign, and CRM campaign surfaces all provide convincing success/log states, but Email Delivery rows are explicitly `Demo` and no real mailbox delivery is configured. Browser rubrics largely pass; strict manual email-delivery checks fail or receive partial credit.
40. **CRM custom metadata is per-contact typed key/value data, not a managed reusable field definition.** Text, Number, and Yes/no persist correctly and tags satisfy the rubric, but there is no organization-level dropdown schema with reusable options such as Speaker Type = Internal/External. This is good metadata depth, not full custom-field administration.
41. **Minor CRM copy polish is unfinished.** The UI renders `1 cards` and `1 contacts` instead of singular grammar. This does not affect functionality but is conspicuous in a judged walkthrough.
42. **The eval README and current YAML disagree on Public Widgets weight.** README says Public Widgets has 34 item-weight points and required total 182; the loaded `06-public-widgets.yaml` contains 35 points, making the current required total 183. This report scores against the actual pinned YAML while calling out the specification inconsistency.
43. **The first post-run ICS inspection used the wrong transport decoder; this is not a product issue.** TanStack server functions return a Seroval cross-JSON envelope whose string nodes contain transport-escaped control characters. Plain JSON extraction made valid CRLF delimiters look literal. The real client decoder restores them, and both the personalized export and widget feed are valid calendars. This entry is retained to make the corrected evidence chain explicit.

## Score

### Frozen read-only grade

Two scores are reported because the harness deliberately separates browser evidence from manual side effects:

| Area | Area weight | Browser verdict points | Browser area score | Strict points after manual reality | Strict area score |
| --- | ---: | ---: | ---: | ---: | ---: |
| Call for Papers | 20 | 38 / 38 judgeable | 100.0% | 36 / 38 | 94.7% |
| Abstract Management | 20 | 27 / 28 | 96.4% | 26 / 28 | 92.9% |
| Speaker Management | 15 | 31.5 / 33 | 95.5% | 29 / 33 | 87.9% |
| Content Management | 15 | 29.5 / 31 | 95.2% | 28 / 31 | 90.3% |
| AI Agenda | 10 | 18 / 18 | 100.0% | 18 / 18 | 100.0% |
| Public Widgets | 20 | 35 / 35 | 100.0% | 35 / 35 | 100.0% |
| **Required overall** | **100** | — | **97.9%** | — | **94.2%** |
| Optional Speaker CRM | +10 | 18 / 19 | 94.7% | 17.5 / 19 | 92.1% |

The **97.9% browser score** reflects what a browser judge can verify from persisted UI, explicit send/export confirmations, and round-trips. The **94.2% strict score** is the honest competition-readiness score after opening and validating the CSV, direct file downloads, ZIP, personalized ICS, and widget-feed ICS. It gives only partial/no credit where real email delivery or exact per-speaker deliverable semantics are not actually proven. Speaker CRM remains optional and does not change the required overall score; on a 10-point bonus interpretation it earns about **9.2 strict bonus points**.

### Exhaustive rubric verdicts

- **CFP:** CFP-01–07, 09–13, 15–18 pass. CFP-08 fails strict manual delivery because production is Demo-only. CFP-14 is partial strict: acceptance/rejection sends are composed, queued, confirmed, and logged, but not delivered externally.
- **ABS:** ABS-01–08, 10–13 pass. ABS-09 is partial strict because reminders are queued/logged but not delivered and missing feedback caused a duplicate. ABS-13's downloaded CSV contains the expected headers, all three rows, exact criterion values/comments, weighted totals, and assignment/completion state. ABS-14 fails: the first-pass surface exists but cannot run without an Anthropic key.
- **SPK:** SPK-01–05, 07–12, 15 pass. SPK-06 is partial strict because the invitation is Demo-only. SPK-10's exact current headshot download opens as the expected valid 256×256 PNG with matching bytes. SPK-13 is partial strict because the personalized bulk send is logged but Demo-only. SPK-14 is partial because `{speaker_name}`, `{event_name}`, and `{portal_url}` resolve while `{talk_title}` resolves blank for a linked accepted session. SPK-16 fails because no automated due-date reminder system was found.
- **CNT:** CNT-01–06, 09–14 pass. CNT-07 is partial because the dashboard is session-slot based rather than per-speaker-per-task and its visible rows/reminder counts use different denominators. CNT-08 is partial strict because outstanding reminders are explicitly queued but Demo-only. CNT-14's real ZIP passes integrity checks, contains exactly the two selected latest versions under the expected grouping paths, and byte-matches both direct downloads.
- **AIA:** AIA-01–08 all pass, including explicit speaker and room conflicts, persistence, live conflict clearing, reviewable auto-placement, and public handoff.
- **EMB:** EMB-01–16 pass. EMB-11's exact personal selection persists across reload, and transport-aware decoding verifies a standards-shaped ICS containing only the selected session. The separate saved-widget ICS feed is also valid.
- **CRM (optional):** CRM-01–09 and CRM-12 pass. CRM-10 is partial because the exact event speaker already exists by email but CRM reports zero linked events and does not permit/reconcile the handoff. CRM-11 is partial strict because multi-recipient personalization, confirmation, per-contact history, and overview history work, but delivery is Demo-only and the campaign is associated with the wrong selectable event.

### Bottom line

The required product is functionally excellent and the browser walkthrough should score in the high 90s. The remaining score loss is concentrated, not broad: real production email delivery, automated incomplete-task reminders, AI-first-pass credentials, per-speaker deliverable semantics, and CRM event-link reconciliation. CSV, direct downloads, ZIP, personalized ICS, and widget ICS feed are now byte/content verified. No product fix was made during or after this run.
