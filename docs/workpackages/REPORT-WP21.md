# WP21 report — standardized pickers, person popovers, dates, and task peek

## What I built

- Added a shared `EntityCombobox` based on shadcn Command + Popover. It supports local or debounced server-backed search, single and multi-select values, selected-row fill, a quiet `Searching…` row, custom triggers, and footer actions.
- Replaced the task speaker checklist, reviewer Select, and event DropdownMenu with the shared searchable picker. Speaker search and event search use event-authorized server functions.
- Added the stock shadcn hover-card primitive and a dense `PersonHoverCard` with lazy event-scoped contact loading, workflow state, bio, speaker link, and session count.
- Attached person hover cards to requested dashboard/review tags, portal speaker references, speaker roster rows, entity picker options, agenda blocks/peek, and content session references. `AdminFileRequests` was intentionally untouched per the parallel-work exclusion.
- Added a clean date-only `DatePicker`, extracted the shared 15-minute `TimeSelect`, replaced the task native date input and agenda native time input, and added collision padding.
- Fixed task due-date round trips by deriving the initial date in the event timezone and saving the selected event-local date as an event-timezone instant.
- Added a compact task Sheet from the speaker spotlight with instructions, due date, state, speaker hover tag, linked session, waive action, and access to the shared `TaskTemplateDialog`.
- Tightened task template, assignment, and speaker spotlight rows to dense list-row styling.

## Files touched

- `apps/web/package.json`
- `pnpm-lock.yaml`
- `apps/web/src/components/ui/hover-card.tsx`
- `apps/web/src/components/forms/entity-combobox.tsx`
- `apps/web/src/components/forms/datetime-picker.tsx`
- `apps/web/src/components/app/person-popover.tsx`
- `apps/web/src/components/event-switcher.tsx`
- `apps/web/src/components/admin/portal-admin.tsx`
- `apps/web/src/components/admin/speakers-directory.tsx`
- `apps/web/src/components/evaluation/round-editor.tsx`
- `apps/web/src/components/agenda/rooms-view.tsx`
- `apps/web/src/components/agenda/schedule-editor.tsx`
- `apps/web/src/components/data-table.tsx`
- `apps/web/src/components/review-desk/submission-detail.tsx`
- `apps/web/src/server-fns/admin.ts`
- `apps/web/src/server-fns/portal.ts`
- `REPORT-WP21.md`

## Decisions and tradeoffs

- Kept the small `All speakers / Selected speakers` mode Select because it is an enum choice, then uses the entity combobox only for the selected-speakers mode. This preserves the requested concept and keeps entities out of Radix Select.
- Reused already-loaded reviewer data for client-side search; contacts and events use server-backed search because those collections are broader and already have an event authorization boundary.
- Used a Sheet for task peek because it preserves the existing speaker spotlight context and matches the app's spotlight-panel language without nesting another popover.
- Kept `PersonTag` independent and composable; hover behavior is applied by callers through `PersonHoverCard` rather than being baked into every tag.
- Saved date-only values at event-local noon. The task field is semantically a calendar date, and noon makes the chosen date stable when it is decoded back through the event timezone.
- No DB schema or migration changes were needed. No production or local data reset was performed.

## Undone / open verification

- The in-app browser runtime had no available browser session, so visual interaction checks could not be completed in this environment. The live app did respond successfully on port 3021 (`HTTP 200` after its redirect), but the Dana mutation/reload walkthrough remains manual.
- `AdminFileRequests` remains unchanged exactly as required, including its existing person rendering; the parallel work package owns that section.

## Verification completed

```text
pnpm check  # pass
pnpm test   # 11 files, 41 tests pass
pnpm build  # pass
curl -L http://localhost:3021/  # HTTP 200
```

The Vite+ commands ran directly; no fallback toolchain was needed.

## Manual verification steps

1. Start only the pinned server: `cd apps/web && pnpm dev -- --port 3021`.
2. Open `http://localhost:3021/`, sign in as seeded organizer Dana, and select the seeded event.
3. Go to `/admin/tasks`, edit a contact-scoped template, switch to `Selected speakers`, search/toggle people, choose a due date, save, reload, and confirm both selections and date persist.
4. Go to an evaluation round's Assignments tab, search the reviewer combobox, assign selected submissions, reload, and confirm persistence.
5. Open the event switcher, search events, switch events, and confirm `Create event` remains at the command-list footer.
6. Hover person tags on the dashboard, review detail, speaker roster, portal tasks/forms, agenda blocks, and session peek. Confirm the dense card appears after about 350 ms, does not shift layout, and flips without covering an open command input.
7. In `/admin/speakers`, open a speaker spotlight, click a task row, inspect its context Sheet, follow the session link, waive an open task, then choose `Edit task`, save an edit, and reload.
8. In the agenda schedule editor, confirm Start uses the same 15-minute Select as the date-time picker.

All changes are intentionally uncommitted. Nothing was pushed or deployed.
