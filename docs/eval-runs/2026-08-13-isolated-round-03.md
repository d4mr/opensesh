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
| Speaker 2 | Marcus Okafor — `sbek-speaker2+r03-20260813-001@example.com` | Added as a Round 03 co-presenter |
| Reviewer | Sam Whitfield — `sbek-reviewer+r03-20260813-001@example.com` | Created in Round 03 |
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
| CFP-S3 | Organizer assigns a reviewer; reviewer scores | Complete | `033`–`039`; round `6u-T1pevz5n35zzKKElXH`, only `SESS-1` assigned |
| CFP-S4 | Organizer decides, notifies, hands off, and closes the CFP | Complete | `040`–`052`; accepted session created, both decision emails logged, public CFP closed |
| ABS-S1 | Speaker seeds submissions with a co-author | Complete | `053`–`057`; Marcus persisted as Co-presenter, three proposals visible |
| ABS-S2 | Organizer configures rounds, pools, assignments, reminders | Complete | `058`–`067`; two independent rounds, exact 2 assignments, 2/0 baseline, reminder log |
| ABS-S3 | Reviewer scores blind; organizer checks aggregates and export | Complete | `068`–`080`; blind queue, exact stored reviews, weighted 3.33/5.00, sorts, 2/2, export |
| SPK-S1 | Organizer builds the speaker roster and assigns onboarding tasks | Complete | `081`–`092`; isolated Priya confirmed, fixture CSV imported, three tasks assigned to isolated Priya/Marcus, invite logged |
| SPK-S2 | Speaker completes onboarding in the portal | Complete | `093`–`101`; scoped portal, accepted session, persisted portal bio/headshot, tasks 2/3 complete |
| SPK-S3 | Organizer tracks progress and sends bulk communications | Complete | `102`–`109`; synced portal profile/file/tasks, 5-recipient resolved campaign, persisted travel notes |
| CNT-S1 | Organizer sets up content collection | Complete | `110`–`113`; two distinct sessions, two one-upload-per-session requirements, all outstanding |
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
- Progress showed Sam Assigned 2, Completed 2, Remaining 0, Completion 100%. Export CSV was triggered and the product confirmed `Exported 3 submissions`.
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
- Opened the isolated Priya record. It showed `SBEK-PORTAL-BIO-01`, Headshot Present, pending profile review, the newly uploaded `headshot.png`, 569 B, Priya Raman, date, and a Download control. The file control was clicked; the page remained healthy and no console error or error navigation occurred, although the browser's download-event observer did not receive an event within five seconds.
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

## Score

Not scored while the run is in progress.
