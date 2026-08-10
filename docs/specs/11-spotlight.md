# WP11 — Spotlight: Linear-grade master-detail across the admin

## North star

We are building the Linear of event planning software. Linear's inbox/issue pattern is the bar: clicking a row NEVER navigates you away, NEVER steals focus, NEVER loses your place. The detail opens beside the list; the list stays live, compact, and keyboard-navigable; closing it restores the dense table exactly where you were, with the row you had open still highlighted. No half measures.

This WP replaces every attention-grabbing side Sheet used for row detail with a **spotlight**: a non-modal detail panel in the page layout (NOT a Radix Sheet/Dialog — no overlay, no focus trap, no body scroll lock).

## The spotlight contract (build once, reuse)

Create a reusable layout primitive (e.g. `apps/web/src/components/app/spotlight.tsx`):

- Page area becomes a flex row: `<CollapsibleList>` + `<SpotlightPanel>`.
- **Open**: clicking a row sets `?spotlight={id}` in the URL (TanStack Router search param, `replace: false` so browser back closes it). The panel slides in (220ms, existing easing tokens) on the right at ~55% width; the table smoothly collapses to its compact column set.
- **Compact table state**: when a spotlight is open, the table renders only its identity columns (e.g. status dot + code + truncated title for desks) — one line per row, 32px tall, still scrollable, still clickable. Full/dense column set returns when the spotlight closes. Columns to keep per surface are listed below.
- **Selected row**: `bg-muted` + a 2px left accent border (`border-l-primary`) on the open row, in BOTH compact and dense states. After closing, the row keeps a fading highlight (~1.5s, reuse the WP6 pulse treatment) so the eye lands where it was.
- **Exact position**: opening/closing the spotlight must not scroll the list. On close, if the row is out of view (list scrolled meanwhile), `scrollIntoView({ block: "nearest" })`.
- **Keyboard**: `↑/↓` (and `j/k`) move the spotlight to the previous/next row in the CURRENT filtered/sorted order; `Esc` closes. Keyboard nav must not fight typing in inputs (ignore when an input/textarea/contenteditable has focus).
- **Non-modal**: no overlay dim, no focus trap. Clicking another row swaps the panel content in place (no close/reopen flicker).
- **Deep link**: loading a URL with `?spotlight={id}` opens the page with the panel already open and the row highlighted/scrolled into view.

## Surfaces to convert (all of them)

1. **Abstracts desk + Sessions desk** (`apps/web/src/components/review-desk/submission-table-page.tsx`): clicking a row opens the submission spotlight instead of navigating to `/admin/abstracts/$id`. The spotlight shows what the detail page shows (answers, speakers, decision panel with accept/decline, reviews roll-up, activity, email history) in a compact single-column layout — reuse/extract the detail page's sections, do not rebuild logic. Compact columns: status, code, title. The dedicated `/admin/abstracts/$id` route stays (deep links, "open full page" icon button in the spotlight header) — spotlight is the default interaction.
2. **Content page** (`portal-admin.tsx` AdminSessions): replace the `SessionPeek` Sheet with the spotlight. Compact columns: code + title + status.
3. **Speakers directory** (`speakers-directory.tsx`): replace the profile Sheet with the spotlight. Compact columns: avatar + name.
4. **Evaluation queue** if it uses row → sheet (check; convert if so).
5. **Agenda AI drafts sheet stays for now** (it is short config, not row detail) — out of scope.
6. **Portal (speaker side) submissions list**: same spotlight pattern for a speaker's own submissions (`portal-submissions.tsx`) — detail/edit opens beside the list.

Sheets that are actually forms (edit portal form, task template editor) are NOT spotlights — they are WP12's problem; leave them.

## Behavior details that make it Linear

- The list keeps its own scroll container; the spotlight has its own scroll. Page never scrolls (match the agenda page pattern: page owns height, children scroll).
- Spotlight header: mono code (or avatar+name), status badge, actions right-aligned (open-full-page, close X). h-11, border-b.
- Mutations from the panel (accept/decline, approve content, waive task) update the list row in place — no full refetch jank; TanStack Query invalidation is fine as long as scroll position and the open spotlight survive.
- The compact↔dense column transition must not jump scroll: keep row heights stable (32-36px both states) so the same row index stays under the cursor.
- Empty state: `?spotlight=` id not in the list (filtered out or deleted) → panel shows a quiet "Not in this view" with a clear-filters affordance; do not crash.

## Hard rules (as every WP)

- Worktree only, branch `wp11-spotlight`. NO git commit/push/deploy, NO prod/remote DB. Local DB `opensesh_wp11` (in `apps/web/.dev.vars` here), dev port ONLY 3011.
- Migrations untouched (this WP is UI/routing only — if you believe you need schema, you're wrong; stop and re-read).
- `pnpm check`, `pnpm test`, `pnpm build` green from repo root; `pnpm run db:reset` green.
- docs/DESIGN.md is binding: new-york-v4 primitives, dense rows, motion under 300ms with existing easing, reduced-motion respected.
- Do not touch `packages/domain` server repos except read-model additions if a surface is missing data for the panel (prefer reusing existing queries).
- Write `REPORT-WP11.md`: what was built, the spotlight contract as implemented, per-surface notes, keyboard map, verification evidence, known gaps.
