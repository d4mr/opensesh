# WP7 — Mail and calendar report

## What was built

- A durable `Mail` pipeline that records every message as `queued` before delivery and then records `demo`, `sent`, or `failed`, provider id, and provider error. Provider failure is data, not a parent-flow failure.
- Three config-selected layers with one interface:
  - `DemoLive`: database-only proof, no external call.
  - `CloudflareMailLive`: native `EMAIL` send binding, HTML + text, raw ICS attachment.
  - `ResendLive`: REST fallback using `RESEND_API_KEY`, with no SDK dependency.
- Typed email-safe templates for confirmation, magic link, accepted, declined, task reminder, and calendar invite. Decision feedback is rendered in the stored HTML preview.
- A zero-dependency `VCALENDAR`/`VEVENT` builder using UTC timestamps, `METHOD:REQUEST`, stable session UID, sequence, escaping, CRLF, and UTF-8-safe 75-octet folding.
- Manual calendar delivery on `/admin/agenda` through the self-contained `CalendarInviteAction`. The existing agenda placeholder only mounts the action; it was not redesigned.
- Per-speaker and bulk task reminders on the Tasks assignments board.
- `/admin/emails`, linked as **Email delivery** in the admin sidebar: dense table, sandboxed stored-HTML preview, plain text, raw ICS, ICS download, provider failure, and optimistic retry.
- A local `pnpm mail:verify` integration check covering DEMO calendar sends, reschedule sequence, task reminders, provider failure isolation, and recovery retry.

## Decisions and tradeoffs

- ICS dates are UTC with `X-WR-TIMEZONE` metadata. This avoids shipping incomplete `VTIMEZONE` rules and is the pragmatic compatibility path for Gmail, Apple Calendar, and Outlook; the email body still renders the session in the event timezone.
- `email_log` is the replay source for the viewer and retry. It stores recipient, HTML, text, raw ICS, sequence, provider, provider id, and error. The old unique constraint was removed because a reschedule must create a new invite attempt.
- Calendar delivery remains organizer-triggered. Dragging/scheduling never sends email automatically.
- A dirty schedule advances sequence only when the current sequence was already delivered. If WP6 has already advanced `ics_sequence`, WP7 detects that and does not increment twice.
- Resend uses its documented REST attachment shape (`content` Base64 + `filename`) instead of adding the Resend SDK.

## Walkthrough script

1. Reset the local-only database and start the app on the required port:

   ```bash
   pnpm db:reset
   cd apps/web && pnpm dev --port 3007
   ```

2. Open `http://localhost:3007/login`, choose the Dana Organizer demo persona, then open `http://localhost:3007/admin/emails`. The four seed messages prove the table and HTML preview.
3. Open `http://localhost:3007/admin/sessions`, choose a pending session, accept it with feedback, then return to **Email delivery**. The new accepted message is `Demo`; preview it and confirm the feedback block is rendered.
4. Open `http://localhost:3007/admin/agenda`. The action reports affected scheduled speakers. Click **Send calendar invites**; the count optimistically clears. Return to **Email delivery**, open a Calendar invite, inspect **Raw ICS**, and click **Download ICS**.
5. Open `http://localhost:3007/admin/tasks`, choose **Assignments board**, and use either a row-level **Remind** or **Remind all outstanding**. Confirm the stored task list in **Email delivery**.
6. Failure/retry proof without provider credentials:
   - In local `.dev.vars`, set `DEMO_MODE=0` and `MAIL_PROVIDER=resend`, leave `RESEND_API_KEY` unset, and restart port 3007.
   - Accept another pending submission. The decision still succeeds and its email is `Failed` with a retry action.
   - Restore `DEMO_MODE=1` and `MAIL_PROVIDER=demo`, restart, then click **Retry**. The same row becomes `Demo`.

## Real-send config swap

No provider credential was available in this worktree, so no real inbox was touched.

Cloudflare Email path:

```text
DEMO_MODE=0
MAIL_PROVIDER=cloudflare
MAIL_FROM=hello@opensesh.io
```

Keep the existing `send_email` binding named `EMAIL`. Before an operator deploys or performs a remote send, `opensesh.io` must be onboarded for Cloudflare Email Sending and `MAIL_FROM` must use that domain.

Resend fallback path:

```text
DEMO_MODE=0
MAIL_PROVIDER=resend
MAIL_FROM=hello@opensesh.io
RESEND_API_KEY=<secret>
```

The swap is config-only. Restart the Worker/dev process after changing configuration.

## Schema and WP6 integration note

The single flat init migration was regenerated at:

`packages/domain/migrations/20260810113331_certain_mordo/migration.sql`

Submission columns added:

- `ics_sequence integer not null default 0`
- `schedule_dirty boolean not null default false`

WP6 may add overlapping columns. Keep exactly one definition of each. Its schedule mutation may either:

- set `schedule_dirty=true` and let the mail action advance `ics_sequence` when a current delivery exists; or
- advance `ics_sequence` itself and also set `schedule_dirty=true`.

WP7 recognizes both forms and avoids a double increment. New schedules do not require `schedule_dirty=true` because the absence of a successful current-sequence invite already makes each speaker affected.

`email_log` now also stores `recipient`, `html_body`, `ics_content`, `ics_sequence`, `provider`, `provider_id`, and `error`; its status enum includes `demo`.

## Verification evidence

Commands run successfully:

```bash
pnpm db:reset
pnpm mail:verify
pnpm check
pnpm test
pnpm build
```

`pnpm mail:verify` proved:

- 11 initial calendar invites stored and delivered in DEMO mode.
- A reschedule dirtied all speakers on one session and resent with `SEQUENCE + 1`.
- 13 task reminders stored and delivered in DEMO mode.
- Intentional provider failure left the decision accepted, stored a failed email, and recovered after retry.

`pnpm test` passes 3 ICS tests: fixed UTC output, escaping, and UTF-8-safe 75-octet folding.

## Known gaps

- No `RESEND_API_KEY`, verified Cloudflare sending domain, or operator-controlled test inbox was available, so the requested real accepted-email/calendar-invite inbox proof remains for the operator.
- No Browser backend was connected in this session, so screenshot-level visual QA of `/admin/emails` was unavailable. Strict UI type/lint checks and the production client/server build pass.
- The generated ICS was validated by unit and local integration checks, including stored raw content and reschedule sequence, but it was not imported into an external calendar application in this session.
