# Sessionboard Clone — Product Requirements

> "Kill My SaaS" competition. Deadline **Wed Aug 12, 10 PM PT**. Prize $10k, judged by AIE team on a walkthrough of the deployed site; tiebreaker = product judgment. Full source notes in `research/SOURCES.md` + `research/image-notes-*.md`.

## One-line product

An open-source clone of Sessionboard's **Program** module: run a call-for-speakers, review submissions, accept speakers, onboard them through a self-service portal with tasks, build a conflict-free schedule, and publish it — fast.

## What we are NOT building

Payments (annotated "NOT NEEDED"), Accelevents integration (swyx: skip), CRM, Marketing, Awards, AI evaluations / content remix, multi-language, SMS. Reports/dashboards are best-effort nice-to-have.

## Roles

| Role | Access |
|---|---|
| **Organizer (admin)** | Full admin UI — the judging priority |
| **Reviewer** | Assigned tracks' submissions, review queue only |
| **Speaker/submitter** | Public CFP form + their speaker portal |
| **Public** | Embeds (agenda, speaker gallery) — no auth |

## The core loop (must all work end-to-end)

1. Organizer configures **event** → builds a **submission form** → shares public link.
2. Speaker submits via the **public CFP wizard** → gets confirmation email + portal access.
3. Submissions land in **Abstracts**; reviewers review by track; organizer sets decisions.
4. **Accepting** a submission auto-creates the speaker record, confirms the session, assigns onboarding **tasks**, and sends the decision email.
5. Speaker completes tasks in the **portal** (hotel form, flight reimbursement form, bio/headshot).
6. Organizer drags sessions onto the **agenda** (day/room grid, conflict detection).
7. Public **embeds** show the agenda + speaker gallery; scheduled speakers get **calendar invites**.

---

## F1. Event configuration (must)

- Fields: name, slug (drives public URLs), type, website URL, location, timezone, starts/ends at, theme text (≤1000 chars), logo + background image.
- Event-level default submission limit (Sessionboard shows "Event max: 3").
- Library scoped to event: **tracks** (colored), **tags**, session **formats**, **levels**, **rooms**.
- Event team: invite admins and reviewers; reviewers get one or more tracks.

## F2. Submission form builder (must)

Admin wizard mirroring Sessionboard's 7 steps (minus Payments):

1. **Setup** — collect Abstracts or Sessions; toggle Participants step.
2. **Welcome** — internal name, external title, page heading (≤15 chars, becomes public step label), rich-text welcome message with show/hide toggle.
3. **Abstract questions** — section title/heading/instructions + field list: label, type (text 255 / rich-text 5000 / email / phone / dropdown / checkbox / file), required toggle, drag reorder. **Locked system fields**: Title (abstract), First/Last Name + Email (participant). Dropdowns can bind to library (Format, Track, Tags, Level).
4. **Participant questions** — same field model + participant roles config (enabled roles, per-role min/max). *Don't repeat swyx's bug: default speaker min = 1.*
5. **Form settings** — close date (**"kinda impt"**: closes form + shows date banner publicly), submission limit (form-level overrides event default), allow-multiple-drafts toggle, customizable success-page message (**"make sure this works"**), auto-redirect to portal after 10s.
6. **Notifications** — submitter confirmation email, ON by default, customizable template (**"must have"**); admin new/updated-submission alerts (nice to have).

- **Conditional logic (basic is fine, per swyx):** per-field "show when {other field} {equals|is one of} {value}".
- Form list page: cards with status Open/Closed, submission/draft counts, close date; duplicate ("Copy from"); View Form / Copy Link.

## F3. Public CFP wizard (must)

Route: `/submit/{event-slug}/{form-id}`. Five steps: **Welcome → Account → Submission → Participant → Review**.

- Banner: close date + "Submission Limit: N submissions per user".
- Account step: email → magic-link/OTP auth (creates the contact; no separate signup flow).
- Submission + Participant steps render the built form with validation, required fields, char counters, conditional logic; supports 1–N participants per role within min/max.
- Review step: read-only summary → Submit.
- Draft save; submission limit enforced (drafts count, matching Sessionboard).
- Success page: custom message + confirmation email + auto-redirect to portal.
- Mobile-friendly, fast.

## F4. Submissions management — Abstracts (must)

- Table of submissions: status tabs with counts (**Pending / Maybe / Accepted / Declined / Withdrawn / Drafts**), search, sort, filter, column picker, CSV export (import + XLSX nice-to-have).
- Columns from the shared session field catalog: status, source (form name or "Manual"), title, description, format, track(s), tags, level, speakers, submitter, rating, notified, created/submitted at.
- Inline status editing from the row; bulk select.
- Manual "+ Add Abstract" / "+ Add Session" drawer (details + participants tabs).
- Submission detail view: all answers, speakers, review scores/comments, activity, email history.
- **Decision workflow (swyx minimum): unreviewed → approve / maybe / deny.**
  - On **accept**: auto-create/confirm speaker records, mark session accepted (eligible for agenda), auto-assign onboarding tasks, send templated acceptance email. `notified` flag tracks whether the decision email went out.
  - On **decline**: templated decline email.
  - **Bonus (build if time):** compose email to speaker from inside the app; attach feedback/requested changes to the decision email.

## F5. Evaluations / review (must, minimum viable)

- Reviewers are assigned **one or more tracks**; submissions carry one or more tracks; a reviewer's queue = pending submissions in their tracks (swyx: this IS the category routing).
- Review = decision (approve/maybe/deny) + optional 1–5 score + comment, one per reviewer per submission.
- Organizer sees aggregate per submission (votes, avg score) and review-progress counts.
- Skip: multi-round plans, blinded review, weighted rubrics, AI evaluators.

## F6. Speaker portal (must)

Portal for authenticated speakers: **Home / Submissions / Profile / Tasks** nav.

- **Home**: My Submissions cards (`SESS-n — title`, format, status badge), profile summary, tasks summary.
- **Submissions**: list + view/edit own submissions (until form close date); status visible (accepted or not is "a key part").
- **Profile**: bio (rich text ≤5000), first/last name, salutation, honorific, pronouns, gender, headshot upload, LinkedIn/Twitter/Facebook/Website URLs.
- **Tasks**: grouped "My Tasks" (contact-scoped) vs "Submission Tasks" (per accepted session); each task = title, instructions, status (todo/done), optional linked form or file upload; manual check-off.
- Admin can preview/impersonate portal ("View Portal" / "Back to Admin Mode").

## F7. Portal tasks, forms, file requests (must)

Admin side (Portals section):

- **Tasks**: title, instructions, scope (Contact | Submission), optional linked form/file request, auto-assign-on-accept flag. **Seed the two must-have templates: (1) Hotel stay requirement form, (2) Flight reimbursement form.** Optional templates: finalize talk description, finalize bio/photos, announce participation, invite colleagues with discount.
- **Portal forms**: 3-step builder (name/title/type → sections with rich-text instructions + fields → settings w/ confirmation email). Responses viewable/exportable by admin.
- **File requests**: title, type, instructions; uploads collected for admin download (stored on the request, not the record — matches Sessionboard).
- Admin task dashboard: who has outstanding tasks (feeds the "real-time speaker readiness" requirement).

## F8. Agenda / schedule builder (must)

swyx: "day/room + drag-and-drop + conflict detection is enough."

- Pool of accepted-but-unscheduled sessions + scheduled grid.
- **Day view and Rooms view** (rooms × time grid); drag-and-drop to place/move/resize; set start/end + room on a session.
- **Conflict detection**: same room overlap; same speaker double-booked. Conflicts view/badge listing all conflicts.
- List view with the standard table framework. (Week/Month views: skip.)

## F9. Communications (must, MVP-grade)

Real email sending via **Resend or Cloudflare Email** (swyx: must work on MVP basis):

- Transactional: submission confirmation, magic-link auth, acceptance/decline (templated, editable, with optional personal feedback), task reminder.
- **Calendar invites**: when a session is scheduled, speaker gets an email with **ICS attachment** (Gmail/Outlook/iCal compatible) with title, time (event timezone), room, description. Re-send on reschedule.
- Email log per contact (what was sent when).
- Skip: campaigns, SMS, email themes.

## F10. Public embeds (must)

Mobile-friendly public pages + embeddable versions (iframe snippet with "Get Code"):

- **Agenda / schedule itinerary** (by day/track, links to session detail).
- **Speaker gallery** (headshot, name, title/company, bio) + speaker list.
- **Session list**.
- Auto-updates from live data; fast; no auth. URL-param filters (e.g. `?speaker=`) nice-to-have.

## F11. Dashboard (nice to have, best efforts)

- KPI cards (submissions, accepted speakers), submission-status counts, "Also check" insights (accepted sessions missing a time slot, submissions awaiting decision, speakers missing bio/headshot), recent submissions table, per-form progress.
- Skip: custom dashboard builder, template gallery, pacing comparisons.

## F12. API (bonus)

Token-auth REST mirroring Sessionboard's public API shape: `GET /events`, `GET/search /sessions`, `GET /speakers`, paginated (`currentPage/pageSize/totalPages/totalResults`, default 25 max 100). Read-only is enough.

## F13. Agent (small, per swyx)

One genuinely useful agent in the admin UI, e.g. review copilot: summarize a submission, flag near-duplicates, draft the acceptance/decline email with feedback. Admin UI comes first; do this last.

---

## Non-functional requirements

- **Speed is a judged feature** ("we do not want slow SaaS", brief mocks Sessionboard's slowness twice). Target: <200ms server responses, instant-feeling navigation, no spinner-heavy SPA waterfalls.
- Bonus points: Cloudflare infra; Airtable persistence; Forge hosting; API.
  - Recommendation: **Cloudflare Workers + D1 (SQLite)** — takes the infra bonus and the speed bonus; Airtable as primary DB would sacrifice speed (rate limits, latency) for a mild bonus. Optional one-way Airtable export if time permits.
- Open-source repo + deployed site + walkthrough-testable by judges.
- Seed data: demo event pre-loaded so judges can walk through immediately (mirror the video: tracks 1–2, Tag A, a few submissions in each status, the two must-have tasks).

## Acceptance test (what judges will do, from the video)

1. Create/edit event settings. 2. Build a form, set close date, open public link. 3. Submit as a speaker (incognito), get confirmation email, land in portal. 4. See submission in Abstracts; review + accept it. 5. Speaker sees Accepted + tasks; completes hotel/flight forms; updates bio. 6. Drag session onto agenda; see a conflict flagged. 7. View public agenda + speaker gallery embed. 8. Receive calendar invite.
