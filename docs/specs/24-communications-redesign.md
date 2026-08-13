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

Route `/admin/communications` gains `tab` (campaigns | reminders | templates)
and keeps `spotlight`. Header: title + subtitle, primary CTA **New campaign**.

### Stat cards (always visible, above the tabs)

Overview-card language (CardDescription label, big tabular value, CardAction
badge, one-line human detail), semantic tone via the status tokens. Each card
is a click-through. The four cards are the four communication verbs:

| Card | Value | Detail / zero state | Tone | Goes to |
| --- | --- | --- | --- | --- |
| Decisions to send | acceptedNotInformed + declinedNotInformed | "3 acceptances · 1 decline" / "Every decision delivered" | pending amber when >0, green check at 0 | Submissions → To inform |
| Awaiting confirmation | informed ∧ unconfirmed speakers | "Nudge them with a campaign" / "Every informed speaker confirmed" | pending / ok | opens composer preset to `awaiting_confirmation` |
| Tasks due soon | todo assignments due within the reminder window | "Due within N days" / "Nothing due in the window" | pending / ok | Reminders tab |
| Outbox | queued + sending while active, else sent total | "2 sending · 12 queued" / "All delivered · N sent" · failed badged destructive | live / ok / destructive | /admin/emails |

### Campaigns tab (default)

SpotlightLayout table: Subject · Audience · Recipients · Delivery · Sent.
Delivery is a compact roll-up ("14 sent", "3 queued", "1 failed" destructive).
Row → spotlight: subject/body snapshot rendered in the real outreach frame,
audience + counts, per-recipient table (name, resolved subject, delivery
status), and **Use as new campaign** (opens the composer prefilled from the
snapshot — resend-to-failed without new server machinery). Empty state:
"Send your first campaign".

While the queue drains, the freshest campaign's Delivery cell ticks live off
the existing 1s poll — the send-progress affordance moves from a caption under
the pending box to the object it belongs to.

### Composer (dialog, decision-dialog anatomy)

- Left rail (18rem): Audience select (segments with live counts, grouped
  Speakers / Submitters; "Selected speakers" opens SpeakerPickerDialog),
  Template select (prefills subject/body; "Custom message"), Subject, Message
  (markdown) with merge-token chips, recipient count.
- Right: the **real rendered email** — `outreach({ eventName, logoUrl,
  subject: resolved, bodyHtml: freeformToHtml(resolvedBody) })` in a sandboxed
  iframe (min-h 480, flex-1), with a recipient switcher so resolution is
  previewed per person. Same anatomy as the decision/cancel dialogs.
- Footer: Cancel · **Send to N**. On send: close, land on Campaigns tab with
  the new row showing live delivery.

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
2. "New campaign" is the only composer entry; sending records a campaign and
   the Campaigns row shows live delivery until the queue drains.
3. A campaign spotlight shows the rendered snapshot and per-recipient
   delivery; "Use as new campaign" prefills the composer.
4. The reminder rule reads as a sentence, saves without a Save button, and
   "Run now" states its count; the due-soon card and the tab agree.
5. Templates are created/edited in the spotlight editor with a live branded
   preview; deleting asks first.
6. The composer previews the real outreach frame per recipient.
