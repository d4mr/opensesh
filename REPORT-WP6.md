# WP6 — Agenda report

## What was built

- `/admin/agenda` with URL-synced Rooms, List, and Conflicts views.
- A three-day, room-column schedule grid from 8:00 AM–7:00 PM in 15-minute slots.
- dnd-kit scheduling from the accepted/unscheduled pool, room/time moves, bottom-edge resizing, and remove-to-pool.
- Optimistic schedule mutations with an Undo toast for schedule, move, resize, remove, and list-popover edits.
- Pure, typed room-overlap and shared-speaker conflict detection with unit coverage.
- Conflict rings in the grid and detailed conflict cards with a jump-and-highlight action.
- TanStack Table list view with the same schedule editor and validation path used by the grid.
- Inline room creation from the final grid-column stub.
- Draft publication controls, an unpublished-changes marker, idempotent publish/unpublish behavior, and `/e/ai-engineer-nyc-2026/agenda` rendering only the last published snapshot.
- Session detail in a right-side peek sheet rather than inline grid expansion.

## Decisions and tradeoffs

- Publication uses one JSON snapshot on the event. This is smaller than maintaining a second set of published schedule rows and makes it impossible for later draft moves to leak onto the public agenda. The tradeoff is that querying individual published sessions in SQL is intentionally not supported in WP6.
- `events.agenda_dirty` tracks publication drift separately from `submissions.schedule_dirty`. The latter remains true for WP7 calendar-invite delivery even after publishing; clearing invite work cannot accidentally hide an unpublished-agenda warning.
- A pair can produce two conflict records when it shares both a room and a speaker. Each card therefore represents one actionable reason, not merely one overlapping pair.
- Grid movement uses dnd-kit transforms and a `translate3d` style. Resizing changes only the absolutely positioned block height because duration itself is the interaction.

## Operator walkthrough

1. Start from the seeded local database:

   ```sh
   pnpm db:reset
   cd apps/web
   pnpm dev --port 3006
   ```

2. Open [http://localhost:3006/login](http://localhost:3006/login), choose **Dana Organizer**, then click **Agenda** in the sidebar. Rooms is the default view and Oct 12 is selected.
3. Confirm **Conflicts 1**. In Hall A, `SESS-17` and `SESS-18` have destructive rings and warning icons.
4. Open **Conflicts**. Expect one **Room overlap** card naming both sessions, Hall A, and the overlapping time. Click **Jump to rooms**; Rooms opens on Oct 12 and both blocks pulse for two seconds.
5. Drag `SESS-18` from Hall A to Hall B at 10:30 AM. The conflict count drops to 0 immediately and an Undo toast appears.
6. Select **Oct 14**. Drag `SESS-31` (**Open models showcase**) from Unscheduled into any room at 9:00 AM. Drag its bottom resize handle down one slot; it becomes 45 minutes. Each action shows Undo.
7. Create a speaker conflict deliberately: return to **Oct 12** and drag `SESS-31` into Hall B at 12:00 PM, overlapping `SESS-20` in Workshop Studio. Expect a conflict in two different rooms naming **Kenji Sato**. Click Undo; the speaker conflict disappears and `SESS-31` returns to its prior Oct 14 slot.
8. Open **List**. In any row, click its schedule button, change room/day/start/duration, and save. The row updates optimistically and shows Undo.
9. Return to Rooms and click **Add room** in the final column. Enter `Studio B` and press Enter; the room becomes a schedule column.
10. Click **Publish agenda**. The draft badge becomes Published and the dirty marker clears. Open [http://localhost:3006/e/ai-engineer-nyc-2026/agenda](http://localhost:3006/e/ai-engineer-nyc-2026/agenda) and confirm it shows the published schedule.
11. Move a draft session without republishing and reload the public URL. The public time remains unchanged. Back in admin, **Unpublished changes** is visible. Click **Republish agenda** to update the snapshot, or use the adjacent menu to unpublish; the public route then shows “Agenda coming soon.”

## Schema changes

- `events.agenda_published_at timestamptz null`
- `events.published_agenda jsonb not null default '[]'`
- `events.agenda_dirty boolean not null default false`
- `submissions.schedule_dirty boolean not null default false`

The old migration directory was replaced by one fresh init migration at `packages/domain/migrations/20260810113313_skinny_nextwave/`, then the local `opensesh_wp6` schema was dropped/recreated, migrated, and seeded.

## Verification

- `pnpm db:reset` — passed; 32 submissions, 12 accepted, and exactly one seeded database overlap.
- Direct agenda read-model check — 12 accepted, 8 scheduled, 4 unscheduled, one room conflict between `sub_17` and `sub_18` in `room_a`.
- Direct publication check — repeat publish succeeded, public snapshot contained 8 sessions, repeat unpublish succeeded, public agenda became hidden, and all 8 draft slots remained intact.
- `pnpm test` — 4 conflict tests passed.
- `pnpm check` — passed.
- `pnpm build` — passed using Vite+.
- Authenticated HTTP check — local sign-in returned 200 and `/admin/agenda?view=conflicts` returned 200; the public agenda route returned 200.

## Motion and zero-debt self-review

| Before | After | Why |
| --- | --- | --- |
| Generic shared sheet used a 500ms open | Agenda peek sheet uses 250ms with `--ease-out` and a 200ms close | Keeps occasional drawer motion responsive and within the project doctrine |
| Registry buttons/tabs used `transition-all` | Transitions enumerate color, background, border, shadow, opacity, and transform | Prevents accidental layout-property animation |
| Drag position could have been stored in layout state | dnd-kit writes a direct `translate3d` transform and the overlay settles in 180ms | Keeps pointer movement compositor-friendly |
| Conflict navigation could silently switch views | Both affected blocks receive a two-second opacity pulse; reduced-motion keeps a static highlight | Explains where the conflict lives without animating layout |
| Session detail could expand inside a dense grid | A canonical right-side peek sheet preserves grid geometry | Matches the binding design pattern and avoids layout jumps |

No TODOs, dead compatibility paths, unchecked casts, raw SQL, new application packages, or production/remote database access were added.

## Known gaps

- No product acceptance item is intentionally omitted.
- This session had no attached in-app or external browser, so the visual dark-mode pass and Chrome DevTools 60fps performance recording could not be executed here. The implementation uses transform-only drag movement, but the operator should record the mid-grid drag in DevTools Performance during the walkthrough to close that verification gap.
