# WP2c — Shell rebuild: exact shadcn blocks + Vercel density

Read `AGENTS.md` first — note the two new UI rules (density; exact shadcn blocks). Prereq: WP2b merged. This WP replaces the hand-assembled shells with shadcn's official block structure and applies the density pass. User feedback driving it (verbatim intent): current shell is too airy; sidebar collapse trigger floats detached from the sidebar; icon-rail hover targets are tiny; "do things EXACTLY like the shadcn example shells."

## A0 — Full component regeneration (no legacy copies)

WP0 initialized `components.json` in backward-compat mode (the CLI had retired the old presets). The user's directive is explicit: current-generation shadcn, no halfway. So: **re-init `components.json` against the CURRENT registry** (current default preset; greenroom tokens override colors regardless — verify every `--sidebar-*`/token name the new generation expects is mapped from our greenroom values, both modes), **delete `src/components/ui/*` wholesale and reinstall every component fresh** via `pnpm dlx shadcn@latest add …` (the previously installed set + `sidebar` + anything the blocks pull in). No hand-edited legacy component files may survive; the diff should show regenerated files, not patches.

## A — Admin shell rebuilt from the official block

- **The shell is the `dashboard-01` block** (user-designated: ui.shadcn.com/view/new-york-v4/dashboard-01 — "THIS is the shell to use"). Install the whole block (`pnpm dlx shadcn@latest add dashboard-01`, current registry naming may differ — find it) and keep its composition intact: `AppSidebar variant="inset"` + `SiteHeader` (trigger inline — this is the canonical fix for our detached-trigger problem) + `SidebarInset` content area. Adapt nav/content only. Its dashboard page content (SectionCards KPI row, interactive chart, tabbed data table) stays in the repo as the pattern reference for the Dashboard page and all future tables — wire the KPI cards to real seed counts now if trivial, otherwise keep the block's structure with our labels and TODO-free placeholder numbers from a server fn. (Supersedes the earlier `sidebar-07` instruction; sidebar-07 remains a secondary reference for icon-collapse behavior.) Adapt its content to our nav (event card header → OS avatar + event name + dates; Program: Abstracts/Sessions/Forms/Evaluation/Agenda; Portals: Tasks/Portal Forms/File Requests; footer: Settings + user menu), keeping the block's **structure verbatim**: `SidebarProvider` + `AppSidebar` + `SidebarInset`, **`SidebarTrigger` inside the SidebarInset header row** (never a detached cell), breadcrumb beside it, `collapsible="icon"` with the block's own icon-rail behavior (full-size `SidebarMenuButton` hit areas with tooltips when collapsed — no tiny hover squares), cookie-persisted open state, `⌘B` keyboard toggle (block default) plus our existing ⌘K palette untouched.
- **Header recipe, verbatim from the block** (this is the fix for the detached-trigger complaint): one header row inside `SidebarInset` — `SidebarTrigger` as a small ghost icon button with `-ml-1`, then `<Separator orientation="vertical" className="mr-2 h-4" />`, then breadcrumb; right side: View portal + user menu. The trigger must NOT live in its own bordered cell/column; it sits inline like any toolbar button.
- Active route: `SidebarMenuButton isActive` exactly as the block does.
- **Event switcher = shadcn's native TeamSwitcher pattern, verbatim** (the `SidebarHeader` workspace-selector from the official block/docs): dropdown with `ChevronsUpDown`, event avatar + name + date subtitle; single event today, so the dropdown lists just it (checked) — the full affordance ships, the data catches up later.
- **`SidebarRail` + native drag-resize — REQUIRED**: the current shadcn sidebar generations are natively resizable; install the component as shipped and wire the rail so drag-resize AND click/⌘B collapse both work. Write NO custom resize code — if resize doesn't work, you installed the wrong/old component; fix the install, don't polyfill. Persist the user's width alongside the open state.
- **Sidebar footer = `NavUser` card** (avatar + name + email + `ChevronsUpDown`, the block's pattern) as primary identity location; group labels and menu rows at the block's exact type sizes (labels `text-xs`, rows `text-sm`).
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
