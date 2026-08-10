# WP7 — Mail: Cloudflare Email delivery, templates, ICS calendar invites, email viewer

Read `AGENTS.md` first. Prereqs: WP0–WP2 merged (WP1's `Mail` service stub + `email_log`). This WP makes email REAL — swyx: "emails/calendar invites should work on an MVP basis". Other WPs (3/4/5) call `Mail`; keep the interface stable, upgrade the internals.

## A — Delivery

`Mail` Effect service, three layers:
- **CloudflareMailLive**: `send_email` binding (`env.EMAIL.send({...})`), html + text always both. Config: `MAIL_FROM` (e.g. `hello@opensesh.io`). Skill notes: binding must exist in wrangler.jsonc; from-domain must be onboarded (`wrangler email sending enable opensesh.io`) — if the domain isn't onboarded yet at your run time, implement + verify with the ResendLive fallback (below) or DEMO layer and mark the CF path clearly in the report; the swap is config, not code.
- **ResendLive** (fallback, ~30 lines): Resend REST, `RESEND_API_KEY` secret. Same interface.
- **DemoLive** (DEMO_MODE): no external call — email_log only, `status='demo'`.
Every send (any layer) records to email_log first (`queued`) then updates (`sent`/`failed` + provider id/error). Failures are typed (`MailError`) and NEVER break the parent flow (accept still succeeds if mail fails — log + surface in UI as failed send with retry button).

## B — Templates

`src/server/mail/templates/` — typed functions (subject, html, text) over a tiny layout (logo text header, greenroom green accent, footer "opensesh — {event name}"; tables-for-layout email-safe HTML, no framework): `confirmation` (submission received), `magicLink`, `accepted` ({{feedback}} block when present), `declined` (same), `taskReminder` (outstanding task list + portal link), `calendarInvite` (session scheduled: title/time-in-event-TZ/room + "add to calendar" text; ICS attached). Placeholders resolved server-side; missing placeholder = type error, not runtime surprise.

## C — ICS

`src/server/mail/ics.ts` (~40 lines, zero deps): VCALENDAR/VEVENT builder — UID `sess-{id}@opensesh.io`, DTSTART/DTEND with `TZID` (event timezone, include VTIMEZONE or use UTC — verify Gmail+Apple Calendar+Outlook accept it; UTC conversion is the pragmatic path), SUMMARY, LOCATION (room), DESCRIPTION (description + portal link), `METHOD:REQUEST`, SEQUENCE bumped on reschedule (store `ics_sequence` on submission; add column if missing). Unit-test the output (fixed timestamps, escaping, line folding at 75 octets).

## D — Wiring + send triggers

- WP2 magic links, WP3 confirmations, WP4 decision emails switch from log-only to real `Mail` (touch only the layer wiring if WP1's interface held).
- **Calendar invites**: "Send calendar invites" action on `/admin/agenda` (badge: n scheduled speakers un-invited or schedule-dirty) → sends `calendarInvite` + ICS to each affected speaker; per-speaker resend on reschedule (SEQUENCE+1). Auto-send stays OFF (organizer clicks — deliberate product choice: no invite spam while dragging).
- **Task reminders**: "Remind" button on WP5's assignments board (per speaker w/ outstanding tasks + bulk "remind all outstanding"). No cron.

## E — Email viewer (judge-facing proof)

`/admin/emails`: table (to, type badge, subject, status incl. demo/failed, sent at) + preview dialog rendering the stored HTML (iframe-srcdoc) with ICS attachment indicator + raw ICS view. Retry on failed. This page is how judges verify email works without an inbox — link it from the README walkthrough.

## Acceptance

1. `pnpm typecheck && pnpm build && pnpm test` (ICS tests); seed green.
2. DEMO walkthrough: accept a submission → email in viewer with feedback rendered; schedule its session → send invites → email w/ ICS attachment; download ICS and import into a calendar app locally (or validate with an ICS validator) — screenshot/paste validation in report; remind a speaker with outstanding tasks.
3. Real-send proof: with ResendLive or CloudflareMailLive configured (whichever is available at run time), send one real accepted-email + one calendar invite to a test address you control; paste headers/screenshot evidence in report; Gmail renders html fine, ICS shows as calendar attachment.
4. Mail failure path: break the provider config, accept a submission — accept succeeds, email shows failed + retry works after fixing.
5. Zero-debt self-review.
