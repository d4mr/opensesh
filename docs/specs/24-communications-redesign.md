# WP24 — Communications, redesigned

## Why

The current page stacks five unrelated jobs on one scroll: a pending-items box,
a permanently-open campaign composer, the template list, the reminder rule, and
campaign history. Nothing is primary, the header CTA is "New template" (a
side-asset action), triage rows read as navigation instead of state, and the
composer previews markdown text instead of the email that actually ships.

The redesign applies the app's own pattern language — overview stat cards,
line tabs, SpotlightLayout lists, decision-dialog send surfaces — to the four
distinct jobs people bring to this page.

## Jobs to be done

1. **Triage** — "who am I supposed to contact right now?" → stat cards.
2. **Send** — "message this group, now" → a campaign: a deliberate act with a
   real preview, launched from a header CTA, recorded as an object.
3. **Audit** — "what did we send, did it land?" → campaign list + spotlight.
4. **Configure** — "set up the machine" → reminders (automation) and templates
   (content assets), each in its own calm tab.

Setup vs send is the axis: reminders are *configured* on their tab and *run*
explicitly; campaigns are *sent* from the composer and *read* from the list.

## Page anatomy

Three route states. `/admin/communications` gains `tab` (campaigns |
reminders | templates) and keeps `spotlight` (used by the Templates tab's
editor). `/admin/communications/new` is the composer.
`/admin/communications/$campaignId` is a sent campaign's page with a
`spotlight` param for its recipients. Header on the index: title + subtitle,
primary CTA **New campaign** → `/new`.

The navigation principle: lists of objects live at the top level; an object
whose detail is itself a collection gets a page; a spotlight only ever holds
one element's detail. Communications → campaign → recipient is three honest
levels, not one page with everything folded in — and creating a campaign is
just the `new` state of the same hierarchy, not a modal floating over it.

### Stat cards (always visible, above the tabs)

Overview-card language (CardDescription label, big tabular value, CardAction
badge, one-line human detail), semantic tone via the status tokens. Each card
is a click-through. The four cards are the four communication verbs:

| Card | Value | Detail / zero state | Tone | Goes to |
| --- | --- | --- | --- | --- |
| Decisions to send | acceptedNotInformed + declinedNotInformed | "3 acceptances · 1 decline" / "Every decision delivered" | pending amber when >0, green check at 0 | Submissions → To inform |
| Awaiting confirmation | informed ∧ unconfirmed speakers | "Nudge them with a campaign" / "Every informed speaker confirmed" | pending / ok | `/new?audience=awaiting_confirmation` |
| Tasks due soon | todo assignments due within the reminder window | "Due within N days" / "Nothing due in the window" | pending / ok | Reminders tab |
| Outbox | queued + sending while active, else sent total | "2 sending · 12 queued" / "All delivered · N sent" · failed badged destructive | live / ok / destructive | /admin/emails |

### Campaigns tab (default)

A plain table — Subject · Audience · Recipients · Delivery · Sent — where
Delivery is a compact roll-up ("14 sent", "3 queued", "1 failed" destructive).
No spotlight here: a campaign's detail is a *collection* (its recipients), and
a spotlight exists to detail a single element. Rows are links one level down.
Empty state: "Send your first campaign".

While the queue drains, the freshest campaign's Delivery cell ticks live off
the existing 1s poll — the send-progress affordance moves from a caption under
the pending box to the object it belongs to.

### Campaign page — `/admin/communications/$campaignId`

The app's deeper-nav pattern (`/admin/submissions/$id`,
`/admin/portal-forms/$formId`) applied to campaigns:

- Back link to Communications; header: subject snapshot as the title, meta
  line (audience · template name or "Custom message" · sent ‹timestamp›).
- Delivery roll-up chips under the header: sent / queued / failed, failed in
  the destructive tone. These tick live while the queue drains.
- Header action: **Use as new campaign** — opens the composer prefilled from
  the snapshot (resend-to-failed without new server machinery).
- Body: SpotlightLayout over the recipients — the list is a table (Recipient ·
  Resolved subject · Delivery), and each *recipient* is the single element a
  spotlight is for.

### Recipient spotlight (on the campaign page)

"What did this person actually get":

- Header: SpeakerBadge + delivery status chip; actions link to the speaker's
  profile and to the outbox entry (`/admin/emails?email=‹logId›`).
- Delivery facts: status, sent-at, failure detail when failed.
- Below, the exact artifact: their `resolvedSubject`/`resolvedBody` rendered
  in the real outreach frame in a sandboxed iframe — per-recipient snapshots
  already exist on `email_campaign_recipients`, so this is a pure render.

Reads come from the existing `CommunicationCenter.campaigns` payload (find by
id; the route loader ensures the same query) — no new server reads.

### Composer — `/admin/communications/new`

A page, not a dialog. The dialog anatomy fits confirm-and-send moments
attached to an existing object (decide, inform, cancel); composing a campaign
is authoring a new object from nothing — the page's primary creative act —
and it inherits the send dialogs' two-pane anatomy at page scale:

- Left rail: Audience select (segments with live counts, grouped Speakers /
  Submitters; "Selected speakers" opens SpeakerPickerDialog), Template select
  (prefills subject/body; "Custom message"), Subject, Message (markdown) with
  merge-token chips, recipient count.
- Right pane: the **real rendered email** — `outreach({ eventName, logoUrl,
  subject: resolved, bodyHtml: freeformToHtml(resolvedBody) })` in a sandboxed
  iframe, with a recipient switcher so resolution is previewed per person.
- Footer bar: Back to Communications · **Send to N**. On send:
  replace-navigate to the new campaign's page and watch delivery tick.

Entry points all funnel here, carried in the URL so prefills are
deterministic:

- **New campaign** (index header) → `/new`.
- **Use as new campaign** (campaign page) → `/new?from=‹campaignId›`,
  prefilled from the snapshot.
- **Awaiting confirmation** stat card → `/new?audience=awaiting_confirmation`.

No server-side drafts — sending stays one explicit act and the `draft`
campaign status stays unused. Instead the composer persists its state locally
per event (localStorage), so navigating away never eats a half-written
campaign; sending or discarding clears it.

### Reminders tab

One automation card per rule (today: task reminders):

- Sentence, not form soup: "Email every speaker with an unwaived task due
  within **N** days." Toggle = enabled (saves immediately); days input saves
  on change (small mutation, no Save button).
- Meta line: "Last ran ‹timestamp› · N due in the window right now".
- **Run now** stays the explicit send action, labeled with its count
  ("Send N reminders now"), disabled at 0 or when the window already ran.
- Quiet footer notes pointing at the manual surfaces: per-speaker nudges on
  the Tasks assignments board, per-requirement nudges on Deliverables.

### Templates tab

List rows (name, subject, updated) in SpotlightLayout → template editor in the
spotlight panel (house editor anatomy: autosave for existing, explicit Create
for new): Name, Subject, Body + merge-token chips, and a live outreach-frame
preview under the fields. "New template" button lives here, not in the page
header. TemplateDialog dies.

## Data changes (additive)

`CommunicationCenter.pending` gains:

- `dueSoonTasks: number` — todo, unwaived assignments with a due date inside
  the reminder window (rule's `daysBeforeDue`, defaulting to 7 when no rule).
- `failed: number` — failed rows in the event's email log.
- `sentTotal: number` — delivered count for the outbox card's calm state.

`CommunicationCenter` gains `logoUrl` only if the admin event context turns
out not to supply it (it does today — prefer the context).

No schema changes to campaigns, recipients, templates, or rules. No new
server actions: compose/send, template CRUD, rule save/run all exist.

## What dies

The always-open composer section, the pending-rows box, the inline
ReminderSettings card, the expandable history rows, TemplateDialog, and the
"New template" header CTA.

## Constraints

- Stock shadcn pieces, greenroom tokens, dense layout; no new dependencies.
- All delivery still flows through the queued mail path; no send semantics
  change anywhere in this WP.
- Segments and merge tokens unchanged.

## Acceptance

1. Landing on Communications reads state in one glance: four cards with
   correct counts, tones, and click-throughs; zero states are affirmative.
2. Every compose entry (header CTA, stat card, "Use as new campaign") lands
   on `/new` with its prefill in the URL; sending replace-navigates to the
   campaign's page, which shows live delivery until the queue drains; a
   half-written campaign survives navigation via local persistence.
3. Clicking a campaign navigates to its page: delivery chips, recipient
   table, and a per-recipient spotlight showing that person's delivery facts
   and their exact rendered email; "Use as new campaign" prefills the
   composer.
4. The reminder rule reads as a sentence, saves without a Save button, and
   "Run now" states its count; the due-soon card and the tab agree.
5. Templates are created/edited in the spotlight editor with a live branded
   preview; deleting asks first.
6. The composer previews the real outreach frame per recipient.
