# WP2e — Performance: one round trip per interaction, SSR the established way

Read `AGENTS.md` first. Prereq: commit e747f12. User mandate (verbatim intent): "under 100ms ON PROD is the requirement"; "let's not do ANY hacks. let's only do ESTABLISHED patterns that the framework allows. tanstack start is FAMOUS for being EXTREMELY fast."

## Measured reality (2026-08-10, prod, from a BOM client; DB = PlanetScale aws-us-east-1 via Hyperdrive; worker `cf-placement: local-BOM`)

- Static/edge responses: ~110ms (this is the floor for a BOM→edge round trip).
- get-session WITH cookieCache (already shipped): 111–136ms — optimal, do not touch.
- Authed document request `/admin`: up to ~670ms — the `CurrentUser` layer runs 2 sequential batches of queries (events+orgMembers, then eventMembers+contacts), each batch a cross-ocean RTT.
- Pre-fix history for context: per-request postgres clients + no session cache + N+1 bootstrap = 1.3–7s. Those multipliers are fixed (memoized client, cookieCache, cached route guards). What remains is QUERY COUNT.

The physics: any DB round trip from a BOM-placed worker costs ~230ms. Smart Placement (enabled) should eventually relocate the worker next to the DB, making each query ~2ms — but we do NOT rely on it. The rule that makes us fast everywhere:

**RULE: any read-path server fn = at most ONE database round trip. Write paths: one round trip plus the write.**

## The work

1. **Collapse `CurrentUser` to one query** (`packages/domain/src/server/current-user.ts`): a single drizzle query joining events (by slug) → organization_members (by user) → event_members (by event+user) → contacts (by event+email), returning everything the current shape needs. Keep the exact same service interface and decoded result. Drizzle query-builder joins only (dialect hygiene). This alone cuts every authed server fn by ~50% from far clients.
2. **Audit every server fn for round-trip count** (`apps/web/src/server-fns/*`): list them in the report with their query count. Any read fn above ONE round trip gets collapsed (joins or a batched `Promise.all`/`Effect.all` — note `Effect.all` batches count as one round trip only if truly concurrent; with the pooled client max=5 they are). getAdminBootstrap, getDashboard, portal/home fns are the suspects.
3. **SSR the established TanStack Start way.** Today we're in a worst-of-both hybrid: `spa: { enabled: true }` in vite config, yet guarded routes still execute `beforeLoad` server-side on document requests, then the client re-fetches everything after hydration (double round trips, blank-then-pop UI). Go full framework-blessed SSR:
   - Remove the `spa` flag; run Start's default SSR.
   - Adopt the official TanStack Start + Query integration (`setupRouterSsrQueryIntegration` from `@tanstack/react-router-ssr-query` — check the vendored/current package name) so loader-fetched data dehydrates into the document and hydrates into the SAME queryClient — zero client re-fetch on first paint.
   - Route data moves into route `loader`s using `queryClient.ensureQueryData` (staleTime per WP2c fix stays); components read via `useSuspenseQuery` with the same keys. Follow the CURRENT official docs/examples — read them, do not work from memory.
   - Keep the cached guard pattern from e747f12 (cookieCache session + queryClient-cached viewer) — client-side nav must stay instant (~20ms, no network).
   - `router.tsx` pending components stay.
4. **Do NOT**: add caches with invalidation debt (no KV/DO caching layers), change the DB driver, add regional pinning hacks, or touch registry ui/* files. Established framework + SQL patterns only.

## Acceptance

1. `pnpm check && pnpm build`; `pnpm seed:verify` + `pnpm cfp:verify` green.
2. Report a table: every server fn → DB round trips before/after. No read fn above 1.
3. Local timing proof: with the dev server against local pg, log server-side timing for getStaffViewer, getAdminBootstrap, getDashboard — each should execute its DB work in ONE pool checkout.
4. First-load: document response for /admin (authed) renders the dashboard WITH data server-side (view-source shows content, not an empty shell), and the client does NOT refetch on hydration (network tab: no duplicate server-fn calls). Describe how you verified without a browser (e.g. curl the document and grep for seeded submission titles; count serverFn requests in dev logs during one load).
5. Client-side nav between admin sections performs ZERO network requests when guards are cached (assert from dev-server request logs).
6. All five personas still sign in and route correctly (password path).
7. Do NOT deploy; do NOT commit (operator does both). Never print `.dev.vars`.
