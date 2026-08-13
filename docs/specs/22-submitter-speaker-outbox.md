# WP22 — Submitter/speaker split, decision outbox, derived speaker pipeline

Fixes the status model at its root. Today every CFP submitter is stamped `participation: "speaker"` at contact creation (`packages/domain/src/server/cfp.ts` → `contactInput`), so the Speakers directory (which filters correctly: no submissions ∨ any accepted) shows 14 while the comms center addresses all 26 as "All speakers". Deciding a submission also renders+sends the decision email in the same transaction, and `contacts.workflowStatus` is a hand-edited label no logic reads or maintains. This WP: role becomes **derived**, decide and inform become **separate acts**, and the workflow badge becomes **computed**.

## The status-axis canon (authoritative for all surfaces)

Store only **provenance**, **decisions**, and **communication facts**. Everything user-facing is derived. No stored value may duplicate a derivable one.

**Contact (person, per event)**
- A1 Provenance (stored, `contacts.participation`): `submitter` | `speaker` | `organizer` — how the row came to exist. CFP flow creates `submitter`; direct adds (speaker dialog, CSV import, CRM add-to-event as speaker) create `speaker`; never changes on decision. Drop the column default — every insert states it.
- A2 Role "is a speaker" (derived, THE predicate): `participation = 'speaker'` ∨ participant on ≥1 `accepted` submission. One shared helper in `packages/domain` (SQL-level, e.g. exists-subquery builder in `repos/shared.ts`), used by: speakers directory, comms center, campaign/invite validation, `Contacts.listByEvent`, portal speaker surfaces, API `/v1/speakers`. Cancellation does NOT remove speakerhood (status stays `accepted` as historical fact); the pipeline chip shows it.
- A3 Confirmation (stored fact, `contacts.confirmedAt`): the speaker's own yes. Writers unchanged: portal confirm; accept when the event has speaker-confirmation off; admin override.
- A4 Onboarding progress (derived): outstanding tasks + outstanding file requirements + profile readiness (reuse the directory's existing readiness computation).
- A5 Profile review (stored, `contacts.profileReviewStatus`): unchanged.

**Submission**
- B1 Decision (stored, `submissions.status`): `draft → pending → maybe → accepted | declined | withdrawn`. Organizer-private.
- B2 Notification (stored, `submissions.notifiedAt`): has the decision been communicated. **Only the inform act writes it** — `decide` no longer does.
- B3 Session lifecycle post-accept (stored): cancellation/reinstatement (`sessionCancelledBy`), unchanged.
- B4 Content review (stored, `contentReviewStatus` + `approvedSnapshot`): unchanged.
- B5 Scheduling (agenda slot): unchanged.

**Communication**
- C1 Email delivery (`emailLog.status`): unchanged. Add emailType `portal_invitation` (see below).
- C2 Campaign lifecycle + per-recipient delivery: unchanged.
- C3 Audiences (derived segments over A×B): defined in "Comms center" below.

**Derived speaker pipeline chip** (replaces `workflowStatus` everywhere it renders — directory, person popover, speaker picker, API):
- `withdrawn`: has ≥1 accepted submission and ALL of them are cancelled with `cancelledBy = 'speaker'`.
- `ready`: `confirmedAt` set ∧ zero outstanding tasks ∧ zero outstanding file assignments ∧ profile ready.
- `onboarding`: `confirmedAt` set ∧ outstanding work remains.
- `invited`: no `confirmedAt` ∧ (portal invitation sent ∨ any decision informed).
- `added` (label "Not invited"): none of the above.
Submitter-provenance contacts who are not speakers get NO pipeline chip; where they appear (comms submitter segments, review desk) show their submission status instead.

## Schema (FLAT rule: edit schema → regenerate single init migration → `pnpm db:reset`)

1. `contacts.participation` → pg enum `contact_participation('submitter','speaker','organizer')`, no default.
2. DROP `contacts.workflowStatus` and the `speaker_workflow_status` enum. Delete `workflowLabels`/`workflowClasses`/`setWorkflowStatus`/`SpeakerWorkflowMutationRequest` and the dialog dropdown; the badge component renders the derived pipeline value instead.
3. `email_type` enum: add `portal_invitation`. `queuePortalInvitations` writes it and dedupes on `(contactId, type='portal_invitation')` — delete the subject-string match.
4. `email_status` enum: add `sending` (drain claim state; see "Delivery at scale").
5. `submissions.notifiedAt` semantics change only (no DDL): null = decision not yet communicated.

## Decide / inform split

**`ReviewDesk.decide` keeps** the transaction's side effects: status update, session materialization, task + file-requirement assignments, confirm-on-accept policy, activity log, content-review handling. **It loses**: email rendering, `emailLog` inserts, `deliveries`, and the `notifiedAt` stamp. Re-deciding while `notifiedAt IS NULL` is free (no `confirmRedecide` gate); the gate remains only for informed decisions.

**New `ReviewDesk.inform`** (+ server fn, staff-gated like decide): input `eventId`, `submissionIds`, optional `feedback` note. Validates each id: status ∈ {accepted, declined} ∧ `notifiedAt IS NULL` ∧ has a `submitterContactId` (manual sessions never enter this flow). Renders the existing decision email (`renderDecisionEmail`, feedback + confirmation CTA logic unchanged) addressed to **the submitter contact only** — decision emails no longer fan out to every participant. Stamps `notifiedAt` + inserts `emailLog` rows (`status: 'queued'`) in one transaction and logs an `informed` activity entry — **inform does NOT deliver inline**; it returns `{ queued: n }` immediately regardless of wave size. Idempotent on retry (same WHERE pattern decide uses today).

**Delivery at scale: Cloudflare Queues.** Every bulk mail path today loops `sendQueued` inline in the request (`Effect.forEach … concurrency: 5`) — a 1000-recipient wave would be one multi-minute request blowing Worker subrequest limits. Replace with the platform primitive:
- **Producer**: `wrangler.jsonc` gains a queue producer binding `MAIL_QUEUE` → queue `opensesh-mail` (+ typegen). Bulk senders transactionally stamp + insert `emailLog` rows (`status: 'queued'`), then enqueue `{ logId }` messages via `sendBatch` in chunks of ≤100. An enqueue failure is tolerable — rows stay `queued` and the sweeper re-enqueues.
- **Consumer**: same Worker, `queue(batch, env)` handler added to the entry object in `apps/web/src/server.ts` (exact pattern of the existing `scheduled` handler; consumer config on the same worker in `wrangler.jsonc`: `max_batch_size: 10`, `max_batch_timeout: 5`, `max_retries: 5`). Per message, sequentially (paces Resend's ~2 req/s single-POST transport): atomically claim the row (`queued → 'sending'`; add `'sending'` to `email_status`, FLAT rule) and deliver **through the existing `sendQueued` path** — the delivery policy (demo mode, `deliverableRecipient` fixture-domain suppression, demo-org log-only → `demo`) lives inside it and MUST keep applying; no bespoke send path. Outcomes: delivered → `sent`/`demo`, ack; transient failure (429/network) → `msg.retry({ delaySeconds })` with backoff, row back to `queued`; permanent rejection or retries exhausted → `failed`, ack (the email log IS the dead-letter ledger — no DLQ; the emails page's existing retry re-enqueues). At-least-once safe: a redelivered message whose row is no longer `queued` acks without sending.
- **Sweeper**: the existing cron triggers gain a mail sweep — re-enqueue `queued` rows older than 5 minutes (lost enqueues) and reset `sending` rows older than 5 minutes back to `queued` (crashed consumers). Nothing can get stuck invisibly: the comms pending card and `/admin/emails` show queued/sending counts.
- **Client**: inform (and campaign send) returns `{ queued: n }` immediately; the UI shows progress by polling the email-status counts (react-query `refetchInterval` while queued+sending > 0 — "Sending 250/1000…"). No client-driven drain loop; delivery proceeds server-side regardless of whether anyone keeps the tab open.
- **Local dev**: the Cloudflare Vite plugin runs queues in miniflare — producer + consumer work in `vp dev` unchanged; dev uses the demo transport so local waves resolve instantly to `demo`.
- **All bulk senders switch to stamp+queue+enqueue**: inform, speaker campaigns, portal invitations, reminder runs (they already insert queued rows — delete their inline send loops). Single-recipient transactional mail (magic links, confirmations, one-off cancel/reinstate) stays inline.
This is also the axes made honest: `notifiedAt` records the *act* of informing (B2); `emailLog.status` records *delivery* (C1). A decision is "informed" the moment the organizer commits the wave, even while the queue drains.

**Decision dialog**: buttons become "Accept" / "Decline" (not "…and send"). Add a checkbox "Also send the decision email now" (default OFF) which calls inform for the same ids immediately after decide; the feedback textarea shows only when it's checked (otherwise feedback is written at inform time). Helper copy: unsent decisions collect in the Submissions "To inform" tab.

**Where inform lives: the Submissions page.** Inform is the terminal act of the review arc, so it happens where deciding happens (Sessionize precedent: Inform Speakers sits in the sessions module, not the mail tool):
1. New status tab **"To inform (n)"** between Maybe and Accepted: all decided-not-informed submissions (accepted + declined together, status badges distinguish them), reusing the existing table, filters, and row selection. Count in the tab label; empty state "Every decision has been sent."
2. Rows in the Accepted/Declined tabs additionally carry a compact **"Not informed"** chip until `notifiedAt` is set.
2a. **To inform toolbar filters**: a segmented control `All (n) · Acceptances (n) · Declines (n)` scoping the table (two clicks to "select every acceptance": filter → header checkbox), plus a **"Selected only (n)"** toggle that filters the table to the current selection — that view is the wave review: spotlight-click through exactly the people who will receive mail. Deselecting a row in this mode drops it from view; the toggle shows live count and disables at zero.
2b. **Selection contract** (id-keyed row selection; pin with tests): opening/closing the spotlight NEVER changes selection (checkbox clicks stop propagation, row clicks only drive the spotlight); selection survives page changes, sub-filter switches, and the selected-only toggle; the header checkbox selects the entire *filtered* set across all pages (fix its aria-label — it currently claims "visible"); the toolbar always shows the true cross-page count ("n selected"). **Action buttons operate on selected rows matching the active filters, across ALL display pages** (`getSelectedRowModel`; note the list endpoint is unpaginated and pagination is a client-side display slice — it never scopes selection or actions). Selected rows hidden by a *filter* (e.g. sub-filter switched to Declines) are excluded from the action; rows on other display pages are always included (WYSIWYG-by-filter; the safe failure mode). Leaving the To inform tab clears selection so no invisible selection can feed a later bulk action.
3. **Review happens in the existing spotlight, not a dialog.** The table already wraps rows in `SpotlightLayout`; on the To inform tab, the spotlight for a row leads with a **"Decision email" card**: recipient (the submitter), subject, and the fully rendered body exactly as it will send. Above the preview, an editable **group note** field ("Note — applies to all N acceptances" / "…declines", scoped by the focused row's decision); editing it live-updates the previews of every row in that group. Clicking through rows = reviewing the wave person by person, Linear-style master-detail, zero extra chrome.
4. **Send is a toolbar bulk action on the selection** (enabled only for decided-not-informed rows): "Inform (n)" → a plain confirm restating the split ("Send 8 acceptance and 3 decline emails?") — the per-person review already happened in the spotlight, so the confirm stays trivial, and the restated split is the last guard against a filtered-down selection surprising anyone. Calls the inform server fn; toast reports sent/failed; rows leave the tab. Pagination is the existing client-side `usePagination` (it already follows `spotlightId` across pages); no infinite scroll, no new pager.

**Portal must not leak B1 before B2.** Define one projection: `portalStatus = 'pending'` when (status ∈ {accepted, declined} ∧ notifiedAt IS NULL) ∨ status = 'maybe'; otherwise the real status. Every speaker/submitter-facing surface uses the projection: portal status badges, acceptance-only artifacts (task list, file requests, confirm CTA, decision feedback, session details), withdraw availability (keyed off projected status, so an un-informed accept is still withdrawable), and any acceptance-triggered side channel (calendar invites fire at inform, not decide). `maybe` NEVER renders in the portal as anything but "In review" — today it leaks.

## Comms center (`/admin/communications`)

1. **Pending card** (new, top of page): the product's "pending communications" summary — read-only counts, one dense line each, no send buttons (the act lives on Submissions; two informing UIs would drift): "Accepted — not informed (n)" and "Declined — not informed (n)" each linking to the Submissions "To inform" tab, and "Awaiting confirmation (n)" (informed accepted, speaker unconfirmed) linking to that composer segment. Empty state: "Nothing pending."
2. **Audience segments** replace `recipientMode` in the campaign composer. Speakers (predicate A2): All speakers · Confirmed · Awaiting confirmation (informed, not confirmed) · Incomplete tasks · Selected (picker). Submitters (non-speaker, by provenance/decision): Awaiting decision (pending + maybe) · Declined (informed only). Each option shows a live count; the recipient preview lists the actual people. `center()` returns speaker rows and submitter rows separately, both via the shared predicate.
3. **Validation**: `createCampaign`/`queuePortalInvitations` validate requested ids against the chosen segment's eligible set (invitations: speakers only), not blanket `participation='speaker'`.
4. Copy: composer/empty states stop calling everyone "speakers" ("Add speakers before sending a campaign" → segment-aware). "All speakers" must now equal the directory count by construction.

## Other surfaces

- **Review desk list payload — slim it**: drop `description` and `reviewComments` from `ReviewDeskListItem` — the table never renders either, and the spotlight loads `getReviewDeskDetail` itself. The load-all + client-side-ops architecture is deliberate (Linear model; keeps select-all/filters/spotlight instant) and with a slim row holds to ~10k submissions (~500KB gzipped); do NOT server-paginate the admin list. (Public `/v1` API cursor pagination is a separate follow-up WP, not this one.)
- **Speakers directory**: query switches from its local filter to the shared predicate (visible set stays: 14 in seed). Submitter-only contacts do not appear. CSV import/export unchanged (import = direct add ⇒ `speaker`).
- **Review desk + sessions**: label the filing contact "Submitter" wherever it renders (list rows, spotlight, session detail); participant chips remain SpeakerBadge.
- **API `/v1/speakers`**: backed by the predicate; `workflowStatus`/`status` field becomes the derived pipeline value (same five strings, `added` replacing `invited`-by-default lies). Update the ApiEndpoint metadata + MCP tool description accordingly.
- **CRM**: untouched (org-level contacts are the deliberate any-audience channel).
- **Docs site**: NOT in this WP (guides are being edited on main); follow-up.

## Seed

- Set `participation` by provenance: CFP-origin personas `submitter`, directly-added/CSV/CRM-origin `speaker`, organizers `organizer`. Remove all `workflowStatus` writes.
- All seeded decided submissions get `notifiedAt` = decided-at (outbox starts empty; existing eval walkthrough traces keep their visible states). Unconfirmed-speaker gaps (`con_16`, `con_22`) stay via `confirmedAt: null` — they must surface as "Awaiting confirmation" and pipeline `invited`/`onboarding` per their task state.
- Check `docs/EVAL-100-PERCENT-SPEC.md` for any asserted speaker/recipient counts and keep them true (the 26-recipient "All speakers" count was a bug; segment counts are the new truth).

## UI rules

`docs/DESIGN.md` binding: dense rails, text labels, counts everywhere, confirmations on destructive acts, forms preserve values, no sheets. "To inform" is the existing submissions table + its existing spotlight (email preview panel) + one toolbar action with a plain confirm — no wizard, no new page, no composer dialog. Pipeline chip keeps the existing badge look (greenroom status tokens); no new colors.

## Constraints (HARD)

- Branch `wp22-audiences`. NO commit/push/deploy/prod DB. Local DB `opensesh_wp22`, port 3022 only, stop server after. Single regenerated init migration per FLAT rule; `pnpm db:reset` green. Don't touch `apps/docs`, `apps/landing`, or untracked files.
- `pnpm check` / `test` / `build` green. Unit tests: predicate (submitter-only excluded, direct-add included, accepted participant included, rejected-only excluded); decide writes no email and no `notifiedAt`; inform stamps + queues for submitter only, idempotent, refuses undecided/already-informed/no-submitter ids, returns without delivering; consumer claims atomically and is at-least-once safe (redelivered message for a non-`queued` row never re-sends), classifies transient (retry → `queued`) vs permanent (`failed`) outcomes; producer chunks `sendBatch` above 100; sweeper re-enqueues stale `queued` and resets stale `sending`; free re-decide before inform, gated after; portal projection (accepted+uninformed → pending, `maybe` → pending, artifacts hidden); pipeline derivation incl. `withdrawn` and `ready`; segment counts match memberships; selection contract (spotlight open preserves selection, actions scope to filtered selection).
- REPORT-WP22.md per AGENTS.md: decisions, assumptions, simpler-alternative notes.

## Acceptance (browser walkthrough)

1. Submit a CFP entry as a new person → they appear in NO speaker surface; comms "All speakers" count equals the directory count exactly.
2. Accept the submission (checkbox off) → session/tasks exist; portal still shows "In review"; no email in `/admin/emails`; "To inform" tab shows it with count 1, and the Communications pending card reflects it.
3. Re-decide to declined before informing → no confirm friction, no email, the "To inform" row follows.
4. On "To inform": click the row → spotlight shows the exact rendered email; type a group note → preview updates live; select + Inform → confirm → submitter (only) gets the decision email; portal now shows the decision; `notifiedAt` set; row leaves the tab; re-running sends nothing.
4a. Multi-page wave: with more rows than one page, header-checkbox select-all → "n selected" shows the cross-page total; flip pages and open spotlights → selection untouched; toggle "Selected only" → table shows exactly the wave; switch the segmented filter to Declines → Inform count drops to the visible selected declines only; confirm always restates the accept/decline split.
4b. Bulk wave: informing the whole selection returns immediately with rows stamped and messages enqueued; the toolbar shows progress ("Sending m/n…") by polling status counts until the queue empties; closing the page changes nothing — the queue consumer keeps delivering server-side, and the sweeper covers lost messages. No inform path walks pages.
5. Accept + "send now" checked → behaves like today's one-shot.
6. A `maybe` submission never reveals itself in the portal.
7. Directory chips show derived pipeline; nothing offers a manual status dropdown; a confirmed speaker with all tasks done + ready profile reads "Ready" with no admin action.
8. Campaign to "Awaiting decision" reaches pending submitters without them ever being called speakers.
