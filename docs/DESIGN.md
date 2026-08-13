# opensesh UI design reference

Distilled from the wizard/editor/nav passes. This is the taste document: when a
surface feels off, the answer is usually already in here. AGENTS.md §"UI rules"
holds the hard constraints (density, flat UI, motion doctrine); this file holds
the *judgment* — how those constraints combine into actual layouts.

## 0. The north-star question

**"Given this data and this UX intent, what would the Linear team do?"**

Drop priors. Never inherit a layout because a component library, an earlier
iteration, or a generic SaaS pattern suggests it. Restate (a) what data the
surface shows, (b) what the one job of the visitor is — then design the
smallest, quietest layout that does that job. The wizard rebuild is the
reference case: a "card with step dots and a banner" became a focused full-page
flow, because a speaker landing from a conference site has exactly one job.

## 1. Surface anatomy

- **Focused flows (public wizard, auth, onboarding):** full-page flat layout on
  `bg-background`. One narrow column (`max-w-xl`), thin `h-12` header with
  brand + context, `border-b`. No Card. No gray page wash behind a white box.
- **Hierarchy comes from type, not boxes.** Step/page title is a real heading
  (`text-xl font-semibold tracking-tight`); instructions are its subtitle
  (`mt-1.5 text-sm text-muted-foreground`). Never a CardHeader with a border
  when a heading will do.
- **Boxes earn their border.** A bordered container is for *grouping repeated
  or enumerable things* (a speaker sub-form, a review dl, a submissions list,
  a checkbox group) — never for "this is the content area".
- **Metadata is a quiet line, not a banner.** "Submissions close Sep 14,
  11:59 PM EDT. Up to 3 per person." as `text-xs text-muted-foreground` in
  flow. Banner boxes (`bg-muted/40 border` strips of prose) are banned.
- **Density (AGENTS.md):** admin = Vercel-dense. Public flows may breathe a
  little more, but spacing is still spent on grouping, not inflation.

## 2. Recurring patterns (use these, don't reinvent)

- **Footer rail** — every multi-step surface ends in the same rail:
  `mt-6 flex items-center justify-between border-t pt-4`; Back is
  `variant="ghost"` left; the primary action sits right. One primary per rail.
- **Segmented progress rail** — `h-1 flex-1 rounded-full` segments in a
  `flex gap-1` row; text line above: `Step N of M · Name` left, quiet meta
  right. Filled = `bg-primary`; visited-but-ahead = `bg-primary/30`; untouched
  = `bg-muted`. Segments before the current step are clickable (jump back) with
  a hover tint; hover shows a floating tooltip that *slides* between segments.
  No numbered dot-trains, ever.
- **Sync whisper** — autosave state ("Saving… / Saved") replaces the meta text
  in place (`aria-live="polite"`), Linear sync-status style. No toasts for
  saves, no spinners.
- **List rows** — one bordered rounded-lg container, `divide-y`, rows are
  full-width buttons/links: `px-3 py-2.5 text-left transition-colors
  hover:bg-muted/50`. Primary datum `text-sm font-medium`, secondary
  `text-xs text-muted-foreground` (codes in mono `tabular-nums`).
- **Selected row fill** — selection state fills the whole row
  (`rounded-sm px-2 py-1.5` + `bg-muted` when selected, `hover:bg-muted/60`),
  container tightens to `p-1.5 gap-0.5`. Applies to checkbox groups and any
  pick-list.
- **Grouped repeatables** (speaker N, question N): bordered section,
  `h-10` header strip (`border-b bg-muted/40 pl-3 pr-1.5`) holding a
  `text-[13px] font-medium` label + ghost icon actions; content padded `p-4`.
  Add-another is a ghost `size="sm"` muted button under the list, not a big
  outlined block.
- **Overline labels** for list sections: `text-[11px] font-medium uppercase
  tracking-wider text-muted-foreground`.
- **Form dialogs mount on demand** — `{open ? <SomeDialog open … /> : null}`.
  A closed dialog holds no state: every open re-seeds its `useState`
  initializers from current data. Never keep a stateful form dialog mounted
  with `open={false}` — its draft leaks into the next open (the create-task
  dialog shipped this bug), and a `key` prop only papers over the edit path.
  Internal resets on success may stay (they keep the component correct under
  either mounting style), but mounting is the guarantee.
- **Review/summary** — `dl` in a bordered rounded-lg with `divide-y`;
  `grid sm:grid-cols-[160px_1fr]` rows; dt `text-xs text-muted-foreground`,
  dd `text-sm`. Always resolve ids to display names — raw ids on screen are a
  bug by definition.
- **Terminal states** (success, sent, empty, error pages): centered narrow
  block, icon in a `size-11` circle (`wizard-pop` entrance), heading
  `tracking-tight`, muted supporting prose, one primary action. No card.

## 3. Motion (the applied version of the doctrine)

Tokens: `--ease-out: cubic-bezier(0.23,1,0.32,1)`. Nothing over 300ms.
Transform + opacity (+ colors). `transition: all` banned. Reduced motion turns
everything off. Utilities already exist in `styles.css` — reuse them:

- `.wizard-step` — step/pane entrance: 220ms rise from `translateY(6px)` via
  `@starting-style`; re-key the wrapper (`key={step}`) to re-trigger.
- `.wizard-fields > *` — one-shot field cascade: 240ms, 40ms stagger steps,
  capped at nth-child(5+). Keyframes with `backwards` fill (not transitions)
  so delays don't pollute later state changes.
- `.wizard-pop` — icon/emphasis entrance: 260ms from `scale(0.85)`.
- `.pressable` — compact clickables only (buttons, chips, icon targets):
  `active: scale(0.97)` at 120ms.
- `.pressable-row` — row- and card-shaped clickables (full-width rows, table
  rows, cards, wide trigger fields). Never scale these: 3% of a 1400px row
  reads as the element snapping inward. Press feedback is an instant
  `bg-muted` tint (one step past hover) that fades out on release.
- `.conditional-field` — reveal/hide at 150ms (max-height + opacity).
- **Sliding indicators** (nav pill, rail tooltip): ONE persistent element that
  moves, never per-item backgrounds toggling. Measure the active target
  (`offsetLeft/offsetWidth`, `useLayoutEffect` so first paint is already
  positioned — mount must not animate), transition `transform` + `width`
  (200ms); a ResizeObserver keeps it honest. Text color on items transitions
  200ms so it tracks the pill.
- Color/fill state changes (progress segments, row fills): `transition-colors`
  200–300ms with `--ease-out`.

## 4. Color & status

- Status is always the `--status-*` tokens: solid full-color badge backgrounds
  with their `-foreground` pair, plus the circle-family lucide icon set
  (draft CircleDashed, pending Loader, maybe CircleHelp, accepted CircleCheck,
  declined CircleX, withdrawn CircleMinus, open CircleDot, closed CircleSlash).
  Badge = `gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium capitalize` +
  `size-3` icon.
- People render as Linear-style person tags, not bare selects.
- Everything must hold up in dark mode — tokens only, no hex in components.

## 5. Editors & text surfaces

All rich text goes through `components/forms/rich-text-editor.tsx` (TipTap
StarterKit): markdown input rules live, compact single-row toolbar in a
`h-8 border-b bg-muted/40` strip, `size-6` ghost icon buttons with `bg-muted`
active states. Content typography is the dense `.rte-content` scale in
`styles.css` — extend that, never inline prose styles. SSR needs
`immediatelyRender: false`.

## 6. Micro-copy

Sentence case, specific, quiet. "Closes Sep 14, 11:59 PM EDT" not
"Deadline information". Headings are contextual — "Welcome back" (signed in)
vs "Sign in to continue" (signed out), not a static section name. Instructions
live in subtitles; inputs rarely need FieldDescriptions on top of that.
Character counters `text-xs text-muted-foreground tabular-nums`, right of the
label.

## 7. The do-not list

- No card-in-card, no content Card on a gray wash.
- No numbered dot-train step indicators.
- No banner/callout boxes for routine metadata.
- No harsh shadows anywhere; floating elements only (demo-roles button,
  tooltips, popovers) get elevation, and it comes from the flattened scale.
- No raw ids, enum values, or codenames in user-facing text.
- No spinner theater; pending states are whispers or skeletons.
- No animation on keyboard-triggered actions; no mount animation for
  positioned indicators.
- No airy hero spacing on admin surfaces.

## 8. Permissions

Access is derived, never stored. An organization owner or admin is an admin of
every event in the organization — no fan-out rows, no sync. `event_members`
holds only explicitly-invited per-event staff: reviewers, and event-scoped
admins for people who are not org admins. It is a roster (who was invited to
staff this event), never a gate; deleting a roster row revokes an invitation,
it does not change what org admins can do.

All access checks go through `requireEventAccess(eventId, required)` in
`packages/domain/src/server/current-user.ts`, which recomputes the answer per
target event from `CurrentUserValue` (org role + per-event member roles).
Repositories take pre-authorized inputs and make no access decisions.

Action attribution (who wrote a note, uploaded a file, reviewed a submission,
overrode a score) is recorded against `users.id` directly. Only the
reviewer-staffing tables — `reviewer_tracks`, `review_round_members`,
`review_assignments` — keep `event_members.id` foreign keys, because they
describe the roster itself.

## 9. Data freshness

Every query key is built from the canonical tree in
`apps/web/src/lib/query-keys.ts` — never a literal anywhere else (a guard test
pins this). Keys mirror the resource paths they cache: `["viewer", …]`,
`["org", …]`, `["event", eventId, …]`, `["public", …]`, and `["immutable", …]`
for content-addressed blobs.

After any successful mutation the client calls `invalidateAfterMutation`
(`apps/web/src/lib/after-mutation.ts`), which marks every affected read stale
in one shot, scoped by that tree: a write that is provably local to one event
skips the other events' subtrees; writes that touch shared org contacts
(speaker edits, CSV import, Accelevents sync) invalidate everything; the
immutable branch is never invalidated. Queries with observers on screen
refetch immediately; everything else refetches on its next mount. There is
deliberately NO per-mutation list of query keys — hand-kept lists developed
gaps twice (V2-008, V3-008).

Optimistic updates stay layered on top of this floor: surfaces that need
instant feedback (pipeline drag, task completion, email retry, agenda drag)
still `cancelQueries` + `setQueryData` + roll back on error, then settle with
the scoped invalidation.

While a refetch or mutation is in flight past ~300 ms, the `SyncIndicator`
(`apps/web/src/components/app/sync-indicator.tsx`) fades a small spinner into
the shell header — admin and portal both. It hides instantly when the cache is
settled. Never add per-surface "refreshing…" text; the indicator is the one
sync affordance.

The selected admin event is a cookie (`opensesh-event-id`, read/written via
`apps/web/src/lib/active-event.ts`), never localStorage: route loaders prefetch
on the server during SSR and on the client during navigation, and both must
resolve the SAME event the layout renders. Loaders resolve it with
`resolveActiveEvent(events, context.activeEventId)` from the `/admin` route
context — never `events[0]`.

## 10. The submissions → sessions pipeline

A session IS an accepted submission — one `submissions` table, no `kind`
column, no session copy. The two admin surfaces are lenses over it:
**Submissions** shows every row born from a CFP form (`source_form_id IS NOT
NULL`) across its whole lifecycle; **Sessions** shows every accepted row —
CFP-origin and manually added (`source_form_id IS NULL`) alike. Origin is
encoded solely by `source_form_id`; never reintroduce a discriminator column.

Acceptance is a decided fact and stays on record. From `accepted` the only
exits are the session's own lifecycle: **cancel** (sets `cancelled_at` +
`cancelled_by` — organizer or speaker — as data, not a status enum) and
**reinstate** (clears them, reopens the tasks the cancellation waived, and
flags the schedule for fresh invites). You cannot decline a session, and the
desk refuses status changes on accepted rows. The schedule is KEPT on
cancellation — it is the record of what was planned — and everything that
feeds public surfaces filters on the one active-session predicate
(`status = 'accepted' AND cancelled_at IS NULL`, `activeSession` in
`packages/domain/src/server/repos/shared.ts`). Never write that condition
inline.

Sessions have no stored state beyond that: readiness (speakers confirmed,
scheduled, deliverables, tasks, publication) is always derived in the read
model, never persisted. Speaker confirmation is the speaker's own act (portal
CTA, driven by the event's `speaker_confirmation_enabled` setting); when the
setting is off, accepting confirms speakers automatically, as before.

History is constructible, not reconstructed: transitions that overwrite
columns (status changes, decisions, schedule moves, cancel/reinstate,
content approval) append to `submission_activity` with actor provenance; the
timeline read model (`packages/domain/src/server/repos/timeline.ts`) merges
that log with the facts already stored elsewhere (emails, edit history, file
versions, task completions, confirmations). Never dual-write an activity row
for something another table already records. Seeded history must sit in the
PAST relative to the demo day — only deadlines, the CFP close, and the event
itself live in the future — or live actions sort under seeded ones and the
timeline reads as nonsense.
