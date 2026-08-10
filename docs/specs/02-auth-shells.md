# WP2 — Auth (better-auth) + app shells

Read `AGENTS.md` first. Prereqs: WP0 (scaffold, D1+Drizzle+Effect pattern) and WP1 (domain schema, repos, seed) are merged. Extend, don't redesign.

## Part A — Auth

**better-auth** (latest 1.x) with the **magic-link plugin only**. No passwords, no OAuth.

- Storage: better-auth's **Drizzle adapter** over the same D1 database. Generate its schema via better-auth's CLI (`npx @better-auth/cli generate`) into `src/db/auth-schema.ts`; migrate via our normal drizzle-kit flow. Auth tables live alongside domain tables; do not hand-write them.
- Mount: better-auth handler on a TanStack Start server route (`/api/auth/$`), client via `better-auth/react` (`createAuthClient`) — check better-auth docs for the current TanStack Start integration recipe (they document one; follow it rather than inventing).
- Magic-link delivery: through our `Mail` Effect service (WP1 `email_log` table). **Dev/demo mode (`DEMO_MODE=1` env): don't send — write to `email_log` and ALSO return the link so the UI can show it** (see role switcher below). Production path sends via the `send_email` binding (stub the provider call behind the service; WP7 finishes real delivery — but the service interface and email_log recording are yours).
- Identity model: better-auth `user` = any human (admin, reviewer, speaker). After auth, our domain role comes from `event_members` (admin/reviewer) or `contacts` (speaker) matched by email. `src/server/auth.ts`: Effect service `CurrentUser` — resolves session → `{ userId, email, roles: { admin: boolean, reviewer: boolean, contactId?: string } }`, typed `Unauthenticated`/`Forbidden` errors. Server fns declare required role via the runtime helper (`run(effect, { require: 'admin' })` or similar — keep it one option, not a framework).
- Seed users from WP1 (`demo@opensesh.io`, `reviewer@opensesh.io`) plus every seeded contact email must be able to log in via magic link (better-auth `signIn.magicLink` creates users on demand — verify flag).

## Part B — Shells (layout only; feature pages come in WP3–6)

Three route groups with layouts, using **installed shadcn components exactly** (`sidebar` and `command` components via shadcn CLI — install them; also `avatar`, `sheet`, `breadcrumb` if needed):

1. **Admin** (`/admin/*`, requires admin or reviewer): left sidebar (shadcn `sidebar` component) — event name header ("AI.Engineer Sandbox — NYC 2026" from DB), nav groups exactly: Dashboard · PROGRAM: Abstracts, Sessions, Forms, Evaluation, Agenda · PORTALS: Tasks, Portal Forms, File Requests · Settings. Topbar: ⌘K trigger (cmdk via shadcn `command` — navigation-only palette: jump to nav items; instant, **no open/close animation** per AGENTS.md), "View portal" link, user menu (email, theme toggle light/dark via `next-themes` pattern, logout). Placeholder pages: each nav item renders its title + an empty-state line so navigation is demonstrable.
2. **Portal** (`/portal/*`, requires session): centered header with event name, pill nav Home / Submissions / Profile / Tasks (active state), user menu. Placeholder pages.
3. **Public** (`/submit/*`, `/e/*`): minimal centered layout, event branding header, no auth.

- Login page (`/login`): email input → magic link sent → "check your email" state; in DEMO_MODE show the link inline (see below).
- **Demo role switcher**: in DEMO_MODE only, a small fixed-corner widget (shadcn `dropdown-menu`) listing: Dana (admin) · Rey (reviewer) · 3 interesting seeded speakers (one with tasks complete, one with pending tasks, one missing bio). Selecting one signs in as them instantly (server fn that mints a session via better-auth's API or generates+consumes a magic link server-side). This is the judges' keys to the whole app — it must be flawless and obvious.
- Root route `/`: redirect — admins → `/admin`, speakers → `/portal`, anonymous → `/login`.

## Motion/polish bar for this WP

Shell only: sidebar active-state transitions (150ms, `--ease-out`), pressables get `.pressable`, ⌘K opens instantly (no animation), theme toggle without flash (class strategy). Nothing else — resist decorating placeholders.

## Acceptance

1. `pnpm typecheck && pnpm build` clean; migrations apply from zero (auth tables included); `pnpm seed` still green.
2. Full flow in `pnpm dev`: login as demo@opensesh.io via magic link from the UI (DEMO_MODE inline link) → lands on `/admin`, sidebar + ⌘K work, all placeholder routes render; role switcher jumps between all 5 personas; speaker persona lands on `/portal`; anonymous hitting `/admin/*` → `/login`; reviewer sees admin shell (scoping to queue comes later).
3. Deployed to workers.dev with DEMO_MODE=1 and the same flow works remotely.
4. No `throw`/`any` in `src/server/`; auth checks only via `CurrentUser`/runtime helper (grep-verifiable).
5. Zero-debt self-review; report better-auth version, integration decisions, session cookie config, anything the WP3–7 specs should know (e.g. how to read `CurrentUser` in a server fn).
