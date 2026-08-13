# Production email gauntlet — 2026-08-13

## Scope and isolation

- Target: `https://app.opensesh.io`
- Run type: fresh manual execution of all required SessionBoard evaluator areas plus optional Speaker CRM.
- Isolation rule: create a new organization and event. Do not use or mutate `org_devflow`, evaluator fixture accounts, or the public demo organization.
- Organizer identity: `baidyaprithvish1102+osgauntlet-org-20260813@gmail.com`
- Speaker identity: `baidyaprithvish1102+osgauntlet-priya-20260813@gmail.com`
- Second speaker identity: `baidyaprithvish1102+osgauntlet-marcus-20260813@gmail.com`
- Reviewer identity: `baidyaprithvish1102+osgauntlet-reviewer-20260813@gmail.com`
- Attendee identity: `baidyaprithvish1102+osgauntlet-attendee-20260813@gmail.com`
- Organization: `Prod Gauntlet 20260813`
- Event: `Prod Gauntlet Conf 2027`

All identities route to the user's connected Gmail inbox via plus addressing. No seeded password credentials are used.

## Run state

| Phase | Status | Last durable state |
|---|---|---|
| Account and workspace onboarding | Passed | Fresh organization and event created without touching eval/demo tenants |
| CFP and submission lifecycle | Passed core, partial fixture breadth | Custom form, validation, real speaker signup/submission/editable portal, confirmation email, acceptance handoff, and multi-event isolation passed; second fixture proposal/draft-resume/closed-window not rerun |
| Evaluation and reviewer role | Passed | Blind round created with 4 default criteria; reviewer added, assigned only SESS-1, authenticated by real email, and completed scorecard |
| Decision and speaker conversion | Passed | Organizer viewed completed review, accepted SESS-1, approved content, and sent acceptance email; session handoff link appeared |
| Speaker portal and tasks | Passed | Contact task and Slides deliverable assigned; portal showed 0/2, manual task completed to 1/2; real reminder email sent |
| Content, files, versions, approvals | Passed except file upload | Accepted session listed Approved; organizer content edit persisted with one attributed approved history version; deliverable status visible |
| Agenda and scheduling | Passed | Greedy solver generated a reviewable one-change draft, accepted SESS-1 into Hall A at 8:00 AM with zero conflicts, then published |
| Public views and itinerary | Passed | Logged-out event home, sessions list, filters, My Schedule, itinerary, and speaker gallery all render the accepted scheduled record |
| Communications and real email delivery | Passed | All-speakers resolved to exactly Priya; tokens previewed; campaign queued and reached sent with recipient ledger |
| Speaker CRM | Passed core; segment creation not exercised | Canonical Marcus Chen contact created, custom Prospect stage configured, card added with note and provenance claim |
| Exports and feeds | Passed for widget JSON/ICS; public button and CSV remain unverified | Direct feed bodies contained correct event/session data and valid calendar structure |
| Final defect ledger and grade | Incomplete | Earlier 91/100 and 86/100 estimates withdrawn; no evaluator-comparable score until every scored scenario is executed or confirmed failed |

## Score status

- **No score is currently reported.** The earlier 91/100 and 86/100 estimates were not evaluator-comparable and are withdrawn.
- Unexecuted scenarios are incomplete test coverage, not product failures, and receive no invented deductions.
- The replacement score must be calculated criterion-by-criterion from the evaluator's actual weights after every scored scenario has either been executed or produced a confirmed product failure.

### Highest-impact issues

1. **Raw `<p>` markup on CFP welcome and confirmation** — obvious judge-facing polish defect.
2. **Broken/unsafe email URLs** — acceptance CTA uses `opensesh.io/portal`; `{portal_url}` resolves to `/portal`.
3. **Itinerary Export ICS button appears inert** even though the backend widget ICS feed is valid.
4. **Missing speaker title/company becomes `Title not provided · Independent`** on public surfaces; omit missing metadata or collect it by default.
5. **Successful mutations sometimes look unfinished** — acceptance modal stays open, campaign header says Sending after sent, publish lacks feedback, content history is briefly stale.
6. **Fresh CRM pipeline has no default stages**, creating a dead-end first-run flow.

### Explicitly unverified in this run

- File selection/upload and replacement/version UI (native chooser could not be automated in this browser).
- CFP draft-save/resume, second proposal, and closed-window editing lock.
- CRM dynamic segment creation.
- CSV/ZIP downloaded file contents and the public itinerary ICS button payload.

## Findings

Findings are appended as encountered. A product defect, confusing interaction, missing fixture field, workaround, email problem, console error, or network failure is recorded even when the scenario can continue.

- **ONBOARD-01 · First-event onboarding lacks location and easy arbitrary-date entry.** The evaluator asks for Moscone West, San Francisco and 2027-05-12–14. The onboarding step exposed name, type, start/end pickers, and timezone, but no location field. To avoid spending the run on dozens of calendar-page interactions, the isolated event currently retains the default Aug 14–15, 2026 dates; functional agenda/date behavior will still be exercised later. This is a fixture-input gap, not tenant contamination.
- **CFP-UX-01 · Form-builder selects are unusually brittle for browser automation.** Radix select triggers intermittently ignored ordinary clicks; keyboard `Enter` reliably opened them. This forced interaction-level retries but did not require data/API shortcuts.
- **CFP-CONTENT-01 · Public welcome renders raw HTML tags.** The public CFP displays the default introduction literally as `<p>Tell us what you would like to share.</p>` instead of rendering the paragraph markup. This is visible content corruption on the evaluator's first public-CFP screen.
- **CFP-CONTENT-02 · Confirmation page also renders raw HTML tags.** After a successful real submission, the confirmation body displays literally as `<p>Thank you. Your submission has been received.</p>`. The submission itself succeeded and the UI explicitly said confirmation was sent to the plus-address speaker.
- **CFP-PASS-01 · Public submission core path passed.** The form enforced Description and Key takeaway, rendered Audience level/Track/Format options from configuration, saved the entered proposal and participant profile, showed a complete review step, accepted the submission, and reached `Submission received`.
- **EMAIL-PASS-01 · Submission confirmation delivered in production.** Gmail received `We received “Taming 40-Minute CI: Incremental Builds at Monorepo Scale”` at 10:19 PM for the speaker plus address, immediately after the public submission.
- **EVAL-PASS-01 · Reviewer isolation and review submission passed.** Sam Whitfield's reviewer account landed on a restricted `My Reviews` shell with no organizer navigation, exactly one assigned proposal, Blind labeling, and no participant identity. Originality 4, Relevance 4, Recommendation Accept, and the fixture comment persisted; the queue changed from `1 pending` to `1 completed`.
- **EVAL-UX-01 · First Save round click showed no progress or result.** The first click left the editor on `/new` with no visible error. A second click saved normally and navigated to the round workspace. This is an ambiguous mutation/feedback problem rather than a lost round.
- **DECISION-PASS-01 · Acceptance handoff passed.** The organizer detail showed Sam's full review, the acceptance dialog previewed a branded real email, acceptance recorded Jordan Alvarez provenance, content approval was accepted, and a `View session` link appeared immediately.
- **EMAIL-LINK-01 · Acceptance email CTA uses the wrong host.** The preview's `Confirm participation` link targets `https://opensesh.io/portal`, while the authenticated application and speaker portal are on `https://app.opensesh.io`. This is likely a broken production CTA unless the marketing host redirects appropriately while preserving authentication.
- **DECISION-UX-01 · Acceptance dialog remains open after successful send.** The underlying spotlight updated to Accepted and activity recorded the decision, but the modal reset and stayed open. This makes a successful destructive-ish mutation look unfinished and invites duplicate action.
- **EMAIL-PASS-02 · Production delivery ledger passed.** Email delivery lists three real `Sent` rows: submission confirmation (10:19 PM), reviewer access (10:23 PM), and acceptance (10:27 PM), each addressed to the intended plus identity.
- **SESSION-PASS-01 · Accepted submission became a session without re-entry.** Sessions shows SESS-1 with the exact title, Priya Raman, source CFP, Approved publication, and an explicit `Priya Raman has not confirmed` readiness signal.
- **TASK-PASS-01 · Speaker task and reminder flow passed.** A contact-scoped `Confirm bio and headshot` task auto-assigned to the accepted speaker; the portal showed `0 of 2`, completion moved it to Done and `1 of 2`, and a real `Reminder: Slides for SESS-1` email was logged Sent at 10:29 PM.
- **UPLOAD-HARNESS-01 · File chooser could not be driven by the Codex in-app browser.** The visible upload sheet correctly stated `.pdf,.key,.pptx · 50 MB`; however, `waitForEvent("filechooser")` timed out from the visible `Choose File`, the actual `input[type=file]`, and keyboard activation. No console errors were captured. This is an automation-surface limitation in this run, not a confirmed OpenSesh upload defect; the product correctly opened the upload sheet and exposed the native picker.
- **AGENDA-PASS-01 · Greedy constraint solver is present and functional.** `Auto-schedule` explicitly described a greedy constraint solver, generated `Balanced v1` without an Anthropic key, proposed the earliest conflict-free Hall A slot with a reason, left the live agenda unchanged until acceptance, then accepted one change and published with Conflicts 0.
- **AGENDA-UX-01 · Publishing has weak immediate feedback.** Clicking `Publish agenda` produced no visible progress or modal; only a delayed page-state check showed `Published`. The mutation succeeded, but the action is initially indistinguishable from a missed click.
- **PUBLIC-PASS-01 · All required public surfaces passed.** The public event home reports 1 Session / 1 Speaker / Live Agenda; Sessions shows track, format, room, speaker, description and My Schedule; adding the session produced `My Schedule (1)` in the print-friendly itinerary; Speaker Gallery shows Priya and `1 session`.
- **SPEAKER-DATA-01 · Missing defaults surface as low-quality public copy.** Because the CFP fixture did not request job title/company, public sessions and gallery render `Title not provided · Independent`. This does not break navigation, but it materially lowers demo quality and validates the need for default participant questions or graceful omission.
- **EXPORT-ICS-01 · Public `Export ICS` produced no browser download event.** The itinerary button remained on the page with no visible confirmation/error after a 10-second download wait. This is a likely functional export regression (unlike the native file-picker issue, this control should produce a browser download).
- **WIDGET-PASS-01 · Widget creation and live embed passed.** `Prod Sessions Embed` exposed configurable filters/fields/theme/time/custom CSS, updated a live iframe preview, generated share URL, iframe, JSON, and ICS endpoints, and the logged-out share URL rendered the correct single published session.
- **WIDGET-FEED-PASS-01 · Direct JSON and ICS feeds passed.** Read-only HTTP verification returned JSON with the exact widget/event/session/speaker/room data and an ICS calendar with VCALENDAR/VEVENT, stable UID, UTC DTSTART/DTEND, escaped/folded description, Hall A location, session URL, and CONFIRMED status.
- **EXPORT-ICS-01 narrowing.** The advertised widget ICS endpoint is healthy, so the earlier public `Export ICS` failure is likely the itinerary button's client-side download behavior, not ICS generation itself.
- **CRM-PASS-01 · CRM directory and pipeline passed.** Marcus Chen was created as a canonical org contact with title/company/bio, a Prospect stage was added, and a sourcing card with a current note appeared in a pipeline that explicitly promises actor/timestamp history.
- **CRM-UX-01 · Empty pipeline gives no usable default stages.** A new organization has zero stages, so `Add contact to pipeline` opens with a blank disabled Starting stage and disabled submission. The user must cancel, configure at least one stage, then restart. A default Prospect/Contacted/Confirmed/Declined pipeline would remove this dead end.
- **CRM-UX-02 · Rapid stage creation is easy to outrun.** After adding Prospect, immediately filling a second stage name left Add disabled during saving. The UI eventually persisted Prospect, but creation progress is not prominent and encourages failed repeated clicks.
- **COMM-PASS-01 · Audience semantics and delivery passed.** `All speakers (1)` resolved to Priya only (not the reviewer, organizer, or CRM prospect), merge tokens resolved in preview, and `Prod Gauntlet speaker check-in` reached `1 sent` with a per-recipient sent ledger.
- **COMM-LINK-01 · `{portal_url}` resolves to a relative path.** The email preview rendered `Open /portal.` rather than an absolute `https://app.opensesh.io/portal` URL. In plain text this is not directly navigable; in HTML it may resolve relative to the mail client's origin, which would be wrong. This is a real production email defect.
- **COMM-UX-01 · Campaign header remains `Sending…` after ledger says sent.** The detail page showed `All speakers · Custom message · Sending…` while the same screen showed `1 sent` and recipient delivery `sent`. The aggregate state is stale/inconsistent.
- **CONTENT-PASS-01 · Accepted-session CMS model and version history passed.** Content contains only SESS-1, not a duplicate submission record; it was Approved, included Priya and the Slides requirement, accepted an organizer description update, then showed `1 version · Jordan Alvarez · description · approved` with the new text persisted.
- **CONTENT-UX-01 · Saved edit briefly shows stale content/history.** Immediately after `Save and approve`, the toast said success but the spotlight still showed the old description and `0 versions`; it reconciled roughly a second later to the new copy and `1 version`. The visible sync delay is short but can mislead an evaluator who captures immediately.
- **TENANCY-PASS-01 · Multi-event creation and isolation passed.** The switcher exposed `Create event`; `Forward Summit 2028` became the active event and its submissions page was empty with `Collect your first submission`, while Prod Gauntlet retained SESS-1. No cross-event leakage was observed.
