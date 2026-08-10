# WP11 — Spotlight report

## What was built

- Added a reusable non-modal `SpotlightLayout` and `SpotlightPanelHeader` in
  `apps/web/src/components/app/spotlight.tsx`.
- Converted the Abstracts and Sessions desks from row navigation to an in-place submission
  spotlight.
- Extracted the submission detail route into a reusable `SubmissionDetail`, so the full route and
  spotlight share answers, speakers, decisions, reviews, activity, email history, mutations, and
  dialogs.
- Replaced Content's `SessionPeek` Sheet with the shared spotlight.
- Replaced the Speakers directory profile Sheet with the shared spotlight.
- Converted speaker-portal submissions to a closed-by-default, URL-driven list/detail spotlight;
  detail editing, history, restore, and withdrawal remain in place.
- Inspected Evaluation. It is already an inline queue/editor and has no row-to-Sheet interaction,
  so the spec's conditional conversion does not apply.
- Left Agenda AI drafts and form-oriented Sheets unchanged.

No schema, migration, domain repository, production database, deploy, commit, or push was made.

## Spotlight contract implemented

- URL source of truth: every converted surface reads and writes `?spotlight={id}` through its
  TanStack Router search schema.
- History: mouse row opens use `replace: false`; close actions use `replace: true`; keyboard row
  swaps use `replace: true` so Back closes the initially opened spotlight instead of replaying a
  long j/k trail.
- Layout: a page-owned two-column grid collapses from full-width list to 45% list / 55% panel.
  The panel is ordinary page layout—no Radix Sheet/Dialog, overlay, focus trap, or body scroll lock.
- Motion: mouse-open collapse and panel entry use the existing `--ease-out` token at 220ms.
  Reduced-motion and keyboard-triggered changes disable movement and color transitions.
- Compact lists retain only their specified identity columns and keep 36px rows:
  - Abstracts/Sessions: status, code, title
  - Content: code/title, status
  - Speakers: avatar, name
  - Portal submissions: status, code, title
- Selection: the open row uses `bg-muted` and a 2px `border-l-primary` accent in both dense and
  compact states.
- Close recovery: the last row receives a 1.5s primary-tinted fading highlight after mouse close.
  Keyboard close uses the same temporary highlight without motion.
- Position: each surface assigns the reusable primitive its table/list scroll container. ScrollTop
  is captured before URL changes and restored in a layout effect. Close uses
  `scrollIntoView({ block: "nearest" })` only when needed. Deep links scroll the selected row into
  view on first layout.
- Panel/list scroll independently inside a viewport-height page; the document is not the list
  scroll surface.
- Changing rows keeps the panel mounted and swaps content without close/reopen flicker.
- Invalid or filtered spotlight ids render a quiet “Not in this view” state. Filtered desks expose
  “Clear filters”; unfiltered surfaces expose “Return to list”.
- Submission spotlights include the full-page icon action and keep the dedicated
  `/admin/abstracts/$id` route.
- Submission detail prefetch starts during spotlight navigation, while a quiet local panel fallback
  allows the compact list to open without waiting on the detail request.

## Per-surface notes

### Abstracts and Sessions

The current filtered and TanStack Table-sorted row model supplies keyboard order. Compact rendering
does not mutate persisted user column visibility. Decision/status mutations keep the URL and list
scroll container mounted while existing query cache updates/invalidation refresh row state.

### Content

The accepted/pending session order supplies keyboard order. Speaker cards, content history, restore,
and acceptance behavior were retained. Pending content/profile review dialogs remain dialogs because
they are decisions, not row-detail Sheets.

### Speakers

The current search-filtered order supplies keyboard order. Clearing search recovers a filtered deep
link. CSV import remains a dialog and is outside spotlight scope.

### Portal submissions

The page no longer selects the first submission implicitly. It opens with the dense list and creates
detail/edit state only when `?spotlight=` is present. URL changes, including keyboard changes, reset
the form answers to the selected submission. Saving, restoring, and withdrawing invalidate the
existing speaker-portal query without closing the spotlight or replacing the list scroll container.

## Keyboard map

Keyboard shortcuts are active only while a spotlight is open:

| Key | Action |
| --- | --- |
| `ArrowDown` or `j` | Next row in the current filtered/sorted order |
| `ArrowUp` or `k` | Previous row in the current filtered/sorted order |
| `Escape` | Close the spotlight |

Shortcuts are ignored when focus is in an input, textarea, select, or contenteditable element. They
do not move focus into the panel.

## Verification evidence

Environment:

- Branch: `wp11-spotlight`
- Database: `postgres://postgres:opensesh@localhost:5433/opensesh_wp11`
- Dev URL: `http://localhost:3011`
- Only this worktree's dev server was started on port 3011.

Commands completed successfully from the repository root:

```text
pnpm run db:reset
  Seed verification passed: status mix, one conflict, and org memberships.

pnpm check
  All packages formatted; no lint or type errors.

pnpm test
  3 files passed; 9 tests passed.

pnpm build
  Landing and web client/server builds completed successfully.

git diff --check
  No whitespace errors.
```

Authenticated local HTTP smoke checks returned 200 and seeded route data for:

```text
/admin/abstracts?status=all&spotlight=sub_01
/admin/sessions?status=all&spotlight=sub_01
/admin/content?spotlight=sub_01
/admin/speakers?spotlight=con_01
/portal/submissions?spotlight=sub_01
```

The organizer and speaker checks used local demo accounts against the reset local database.

## Decisions and tradeoffs

- The grid-column collapse is the smallest direct implementation of the required smooth table-width
  change. Panel entry itself uses only transform and opacity; the one layout transition is limited
  to the contract's compact/dense width change.
- Keyboard row swaps replace the current URL entry. Mouse row selection still pushes exactly as the
  contract requires, while repeated keyboard navigation does not create a history entry per row.
- The detail query is prefetched rather than awaited by list-route navigation. This preserves the
  instant compact-list response and uses a quiet panel-local loading state instead of suspending the
  full page.

## Known gaps

- No in-app or external browser was connected to this agent session, so automated visual, focus,
  pixel-position, and browser Back-button interaction checks could not be performed. Authenticated
  HTTP deep links, type/lint checks, tests, builds, and source-level contract checks passed. A final
  human browser walkthrough at `http://localhost:3011` should exercise click/open, Back, close
  highlight, scroll preservation, and all keyboard shortcuts before judging.
