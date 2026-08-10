# WP2c — Shell rebuild: exact shadcn blocks + Vercel density

Read `AGENTS.md` first — note the two new UI rules (density; exact shadcn blocks). Prereq: WP2b merged. This WP replaces the hand-assembled shells with shadcn's official block structure and applies the density pass. User feedback driving it (verbatim intent): current shell is too airy; sidebar collapse trigger floats detached from the sidebar; icon-rail hover targets are tiny; "do things EXACTLY like the shadcn example shells."

## A — Admin shell rebuilt from the official block

- `pnpm dlx shadcn@latest add sidebar-07` (collapsible-to-icon sidebar block; if the current registry offers a closer admin-shell block, say so and use it). Adapt its content to our nav (event card header → OS avatar + event name + dates; Program: Abstracts/Sessions/Forms/Evaluation/Agenda; Portals: Tasks/Portal Forms/File Requests; footer: Settings + user menu), keeping the block's **structure verbatim**: `SidebarProvider` + `AppSidebar` + `SidebarInset`, **`SidebarTrigger` inside the SidebarInset header row** (never a detached cell), breadcrumb beside it, `collapsible="icon"` with the block's own icon-rail behavior (full-size `SidebarMenuButton` hit areas with tooltips when collapsed — no tiny hover squares), cookie-persisted open state, `⌘B` keyboard toggle (block default) plus our existing ⌘K palette untouched.
- **Header recipe, verbatim from the block** (this is the fix for the detached-trigger complaint): one header row inside `SidebarInset` — `SidebarTrigger` as a small ghost icon button with `-ml-1`, then `<Separator orientation="vertical" className="mr-2 h-4" />`, then breadcrumb; right side: View portal + user menu. The trigger must NOT live in its own bordered cell/column; it sits inline like any toolbar button.
- Active route: `SidebarMenuButton isActive` exactly as the block does.
- Close the remaining deltas visible vs the block's preview: event switcher gets the up/down chevron affordance (`ChevronsUpDown`, right-aligned, like the block's team switcher — non-functional single-event for now is fine, the affordance is the point); **sidebar footer user card** (avatar + name + email + chevron, the block's `NavUser` pattern) replacing/duplicating the top-right user menu as the primary identity location; group labels and menu rows at the block's exact type sizes (labels are `text-xs`, rows `text-sm` — ours currently render larger/looser).
- Portal + public + login layouts: light density pass only (below) — their centered structure is fine; login should match the `login-03`-style card proportions if it deviates.

## B — Density pass (Vercel-grade)

- Admin content surfaces: `text-sm` base (13–14px), page titles `text-lg font-semibold` (not display sizes), page header block ≤ 48px tall, content container `p-4`/`p-6` max — kill any hero-ish vertical padding.
- Sidebar: the block's default paddings/sizes are correct — do not inflate them; nav label 11px uppercase muted; menu rows the block's height (32px), full-width hover.
- Placeholder pages: compact header (title + one-line description in one row where it fits) — still placeholders, but dense ones.
- Demo-roles widget: keep, restyle to match density (smaller, `text-xs` menu labels + persona sublines).
- Add nothing decorative. No new animation beyond what AGENTS.md already mandates.

## Acceptance

1. `pnpm check && pnpm build` clean; deploy; prod verified.
2. Visual parity with the shadcn block: trigger sits in the inset header next to breadcrumb; collapsed rail shows icon buttons with tooltips + full hit areas; expanded/collapsed state persists across reloads; ⌘B toggles.
3. Admin pages read dense: header ≤48px, text-sm body, no dead vertical space (compare against ui.shadcn.com/blocks sidebar-07 preview side-by-side and state any deviation + why).
4. All five personas still route correctly; ⌘K unchanged.
5. Zero-debt self-review; report what was replaced vs kept from the old shell.
