# WP2d — Switch to the `new-york-v4` shadcn style: the one the demos actually use

Read `AGENTS.md` first. Prereq: WP2c merged (commit a193096).

## Why (root cause, understand before touching anything)

WP2c initialized `components.json` with style **`base-nova`** — the CLI's new default generation (Base UI primitives, denser metrics: `SidebarMenu gap-0`, `h-8` (32px) inputs/buttons). The user's canonical references — ui.shadcn.com/view/**new-york-v4**/dashboard-01, /login-04, /sidebar-03 — are the **`new-york-v4`** style (Radix primitives, `gap-1` menus, `h-9` (36px) inputs). The user compared our shell to those demos and correctly called the spacing wrong. Verdict (user, verbatim): "JUST DO WHAT SHADCN DOES EXACTLY" — anchored to the new-york-v4 demos. The registry still fully serves new-york-v4 (`https://ui.shadcn.com/r/styles/new-york-v4/<name>.json` — verified working).

## The job

1. **`components.json`**: set `"style": "new-york-v4"` (keep aliases, neutral base, css variables, lucide).
2. **Delete `src/components/ui/*` wholesale; reinstall every needed component** via `pnpm dlx shadcn@latest add <name>` against the pinned style. The installed files must be **registry-faithful: zero manual edits** beyond what `vp check --fix` formatting applies. If a component seems to need behavior changes, the change belongs in the consumer, not the ui file. (Note: WP2c modified registry transitions to custom easings — do NOT repeat that; registry classes stay as shipped. Repo-wide motion doctrine still applies to OUR components, not to `ui/*` internals.)
3. **Reinstall the blocks from new-york-v4**: `dashboard-01` (shell + dashboard content pattern) and `login-04`. Keep their composition and CLASSES verbatim; adapt only: nav labels/icons/routes, data wiring (real KPI counts, submissions table rows), brand slots, greenroom tokens (colors ONLY — never spacing/size/typography classes).
4. **Port all consumers from the Base UI API to the Radix API**: `render={...}` → `asChild` + child element; menu labels don't need `DropdownMenuGroup` wrappers in Radix (match whatever the v4 blocks do — copy their composition); check every file that imports from `@/components/ui/`: app-sidebar, nav-main, nav-secondary, nav-user, event-switcher, site-header, data-table, chart-area-interactive, section-cards, login-form, demo-role-switcher, user-menu, admin-shell, portal-shell, public-shell, page-placeholder, routes. `@base-ui/react` should end up REMOVED from package.json (grep proves no imports remain); add whatever `radix-ui` packages the installs bring.
5. **Remove WP2c's density tweaks in shell components**: custom `text-[11px]` group labels, any hand-tuned sidebar spacing — the v4 block's own classes are the spec now. The density pass (AGENTS.md) still governs OUR content surfaces (page bodies, tables we build), never block/ui internals.
6. Tabler icons in block source may be swapped for the lucide equivalents (our `iconLibrary`), as the shadcn CLI does automatically — that is the ONLY icon liberty.
7. Keep: TanStack `Link` integration for nav (via `asChild`), better-auth email+password + magic link login paths, seeded demo password, brand asset slots + the login-panel `ref` fallback fix from a193096, event switcher (v4 TeamSwitcher pattern), demo-roles widget, ⌘K palette, cookie-persisted sidebar state + ⌘B.
8. **Dev loop is local now** (AGENTS.md): Docker `opensesh-pg` on :5433; `pnpm db:reset` if you need fresh data. Do NOT touch `#PROD_DATABASE_URL`.

## UI settlement (user directives — this closes the UI phase; product work resumes after)

- **The dashboard stops being a component demo.** Keep: KPI cards (real counts) + submission-activity chart. **Replace the block's demo table** with a real, read-only "Recent submissions" table (TanStack Table, v4 table styles): columns Code (`SESS-n`), Title, Kind, Track, Status, Reviewer. **Delete**: row multiselect checkboxes, drag-reorder handles, Target/Limit inline-edit forms (toast fakes), the row-detail drawer, pagination if ≤20 rows shown (show latest 20, link "View all → Abstracts"). The block's demo table code leaves the repo entirely — real management tables are WP3–5's job; do not build management features here.
- **Status badges get FULL color backgrounds.** New `StatusBadge` in `src/components/app/status-badge.tsx`: solid fill from the greenroom `--status-*` tokens (pending/maybe/accepted/declined/withdrawn/draft), readable foreground (white or near-black per token, check both modes), `text-xs font-medium rounded-md px-1.5`, no icon spinners. Used everywhere a submission status appears (dashboard table, future WPs import it).
- **Reviewer = Linear-style person chip**, not a select: `PersonTag` in `src/components/app/person-tag.tsx` — small round avatar (initials fallback, 16–18px) + name, inline chip. Display-only for now ("Unassigned" muted state); assignment interactions land in WP4. No dropdown here.

## Acceptance

1. `pnpm check && pnpm build` clean; `pnpm seed:verify` green (no schema changes expected — if you think you need one, stop and say why in the report instead).
2. `grep -r "@base-ui" apps/web/src` → empty; `grep -rn "gap-0" apps/web/src/components/ui/sidebar.tsx` → empty (v4 ships gap-1).
3. Diff proof in report: for `ui/sidebar.tsx`, `ui/input.tsx`, `ui/button.tsx`, state "registry-identical post-format" or list every intentional diff (there should be none).
4. Visual: login page and admin shell match the v4 demos' spacing — 36px inputs, gap-1 menu rows, group labels at the block's own size. List remaining visible diffs (should be: colors/brand + our real dashboard table content).
4b. Dashboard shows the real read-only table (no checkboxes/drag/Target/Limit/drawer); status badges are solid-fill in both modes; reviewer column renders person chips with initials.
5. All five personas sign in (password AND magic link) and route correctly; demo-roles menu opens without errors; user menu opens; sidebar collapse/expand + ⌘B work.
6. Do NOT deploy (no CF auth in sandbox) — report when done; the operator deploys.
7. Zero-debt self-review.
