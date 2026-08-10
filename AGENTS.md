# opensesh.io — Agent Contract

Open-source clone of Sessionboard's Program module (conference CFP → review → speaker portal → agenda → publish). Competition entry; judged on a browser walkthrough, product taste, and speed. Deadline-critical: build exactly what the spec says, nothing more.

## Think before coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**
- State assumptions explicitly. If multiple interpretations exist, pick the simplest and note the choice in your report.
- If a simpler approach exists than what the spec implies, say so in your report — but build the spec.

## Simplicity first (zero-debt policy)

**Minimum code that solves the problem. Nothing speculative.**
- No features beyond the spec. No abstractions for single-use code. No "flexibility" nobody asked for. No error handling for impossible states.
- If you write 200 lines and it could be 50, rewrite it.
- No TODO comments — finish it or report it as open. No dead code, no commented-out code.
- Do not add dependencies beyond those the spec lists (plus whatever the shadcn CLI itself vendors in).

## Stack (fixed — do not substitute)

- **TanStack Start** (`@tanstack/react-start`) on **Cloudflare Workers**, SPA mode (`ssr: false` default). TanStack Router (file routes), TanStack Query (all server state), TanStack Table (lists), TanStack Form (forms).
- **Effect v4 beta — pinned `effect@4.0.0-beta.106`**. The Effect monorepo is vendored at `vendor/effect` at the same tag. **v4 ≠ v3 ≠ your training data.** For any Effect API question, read `vendor/effect/packages/effect/src` and `vendor/effect/.patterns/` first. Never write Effect code from memory.
- **Database: D1, treated as a normal SQL DB.** **Drizzle owns schema and migrations**: `drizzle-orm@rc` + `drizzle-kit@rc`, `drizzle-kit generate` → `wrangler d1 migrations apply`. Queries go through the official Effect integration `drizzle-orm/effect-d1` (fallback, only if the WP0 gate failed: stable `drizzle-orm/d1` wrapped in `Effect.tryPromise` inside the repo layer). No Durable Objects. Backend code runs in the Worker, in `createServerFn` handlers that run Effect programs through the shared runtime helper.
- **better-auth** for auth (magic links, Drizzle adapter). **Cloudflare Email** `send_email` binding for mail (dev: log-only Mail layer).
- **Tailwind v4 + shadcn/ui**: components are installed with the **shadcn CLI, exactly as shipped** (`pnpm dlx shadcn@latest add <component>`), then modified in `src/components/ui/` only when a spec requires it. Never hand-roll a lookalike of a component shadcn ships. Theme tokens: `docs/themes/greenroom.css` (light+dark) — wire once into the global stylesheet; never hardcode colors in components.
- pnpm. TypeScript strict.

## Effect rules (src/server/**)

- Every domain operation: `Effect` with typed failures via `Data.TaggedError` (`NotFound`, `Forbidden`, `FormClosed`, `SubmissionLimitReached`, `ScheduleConflict`, …). **No `throw`, no naked `Promise`, no `any`, no `@ts-ignore`, no unchecked `as`.**
- Services via `Effect.Service` + Layers (Db from the D1 binding, Mail, Ics, Clock where it matters). Env/config via `Config`. `Effect.runPromise` is called in exactly one place — the server-fn runtime helper — where tagged errors are exhaustively `Match`ed to `{ status, message }`.
- Drizzle table definitions are the DB truth; `effect/Schema` models are the domain truth (decode drizzle rows at the repo boundary). One schema drives RPC input validation, form validation (via `Schema.standardSchemaV1`), and API responses. No hand-written duplicate types.

## UI rules

- Status colors come from the `--status-*` tokens (pending/maybe/accepted/declined/withdrawn). Semantic, never repurposed.
- Session codes (`SESS-4`) render in mono with `tabular-nums`.
- Motion doctrine (from Emil Kowalski's design-engineering skill — full text at `~/.agents/skills/emil-design-eng/SKILL.md`):
  - Curves, declared once: `--ease-out: cubic-bezier(0.23,1,0.32,1)`; `--ease-in-out: cubic-bezier(0.77,0,0.175,1)`. Never built-in `ease-in`.
  - Durations: press 100–160ms · popover 125–200ms · dropdown 150–250ms · modal/drawer 200–300ms. Nothing over 300ms.
  - Every pressable: `:active { transform: scale(0.97) }`. Enters via `@starting-style`, from `scale(0.95)`+opacity, never `scale(0)`. Popovers scale from trigger origin.
  - CSS transitions over keyframes (interruptible). Animate `transform`/`opacity` only. `transition: all` is banned. Hover behind `@media (hover: hover)`. Respect `prefers-reduced-motion`. No animation on keyboard-triggered actions.
- Speed is a judged feature: optimistic updates on every mutation, no spinner theater, instant-feeling navigation.

## Commands

- `pnpm dev` · `pnpm typecheck` (tsc --noEmit) · `pnpm build` · `pnpm deploy` (wrangler) · `pnpm seed`
- A work package is done only when `pnpm typecheck && pnpm build` pass and the spec's acceptance list is verified.

## Reporting

End every session with: what you built, decisions made (with the tradeoff you saw), anything left open, and the exact commands/URLs to verify. Commit with conventional messages as you complete coherent chunks — never one giant commit.
