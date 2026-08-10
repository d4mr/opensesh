# Winning Strategy — How to Be Top 1 of 100+

## The judging reality

- AIE team (not swyx) walks through each deployed site following the video's flow. With dozens of submissions, each gets **minutes, not hours**. First impressions decide; a single broken step in the core loop is elimination.
- Tiebreaker is explicit: **"subjective judgment calls for the product that we would actually use/buy."** This is a product-taste contest wearing a feature-checklist costume.
- Most entries will be: generated admin UI, stubbed emails, empty database, broken drag-drop, cold-start spinners. The bar to be memorable is lower than it looks — but only if the fundamentals are flawless.

## The four bets, in priority order

### 1. A flawless core loop beats a bigger feature list
The 8-step acceptance test in the PRD must work **every single time**, including on a judge's phone, in incognito, at a cold start. Budget the last full day for walkthrough hardening, not features. Every feature we add after the loop works is risk; every feature added before it works is negligence.

### 2. Speed is the emotional differentiator
swyx mocks Sessionboard's slowness twice in a 10-minute video — it's why this competition exists. The clone must *feel* insultingly fast in contrast:
- Server-rendered pages on Cloudflare edge + D1; no SPA hydration waterfalls, no skeleton-screen theater.
- Optimistic UI on every mutation (status changes, drag-drop, task check-off).
- Instant search/filter on lists (client-side over already-loaded data at demo scale).
- Target: every interaction < 100ms perceived. Judges should *notice* the speed within 30 seconds.

### 3. Judge experience: make evaluation effortless
Judges evaluating dozens of sites will love whoever respects their time:
- **Pre-seeded realistic demo event** — a plausible AI conference: real-sounding tracks (RAG, Agents, Evals, Infra), ~30 realistic submissions across all statuses, speakers with bios/headshots, a partially-built agenda **with one visible conflict to discover**, the hotel + flight tasks. Zero lorem ipsum. The walkthrough should feel like touring a live conference, not an empty app.
- **One-click role switching** — "View as organizer / reviewer / speaker" without credential juggling (magic links shown inline in demo mode).
- **In-app email viewer** — every sent email (confirmation, acceptance, ICS invite) visible in an activity log with rendered preview, so judges see emails worked without checking an inbox. Real sending still works via Resend for their own test submissions.
- **README with the walkthrough script** — map each video step to a URL. Make the grading rubric trivially checkable.

### 4. Two or three "we'd actually buy this" moments (the tiebreaker)
Judgment calls no checklist demands, chosen because *this specific customer* needs them:

1. **Sessionboard migration import** — "Kill My SaaS" means leaving Sessionboard, and day-one data migration is the real switching cost. Import via their public API token or CSV export (their export formats are documented in our research). Even a solid CSV import of sessions/speakers is a statement: *this replaces Sessionboard on Monday.*
2. **API that could power ai.engineer today** — we verified their site bakes schedule data into a Next.js build (566 sessions in pageProps). Ship `GET /sessions` + `GET /speakers` shaped for that use, and include a tiny demo page consuming it — proof their manual export step disappears.
3. **Fix Sessionboard's own annoyances on camera** — defaults that bite in the video (speaker minimum defaults to 1, not 2), instant form preview while building, undo on status changes, ⌘K everywhere. Small, visible, memorable.

Ideas that specifically demo well, ordered by effort-to-wow ratio: conflict detection that highlights live during drag; decision emails with reviewer feedback attached (swyx called this out as the bonus he wants); the review copilot agent drafting the decision email (only after everything else works).

## What NOT to spend hours on
Custom dashboard builders, saved views, XLSX import, week/month agenda views, email themes, portal theming, multi-round evaluations, blinded review, AI evaluators, replicating ai.engineer's public site design. Every hour here is stolen from loop-hardening and seed-data quality.

## Competitive positioning summary
Most entries: feature-complete-ish, generic, fragile, empty.
Ours: **fewer features, all bulletproof, insultingly fast, pre-populated with a believable conference, plus a migration path** — the only entry that feels like a product decision, not a hackathon output.

## Execution order (3 days)
1. **Day 1**: schema + auth + event/form builder + public CFP wizard + submissions table. Seed script from the start (it doubles as test data).
2. **Day 2**: reviews, accept side-effects (speaker/tasks/emails/ICS), speaker portal, agenda drag-drop + conflicts, embeds.
3. **Day 3 morning**: API + import + agent (in that order, cut from the back).
4. **Day 3 afternoon/evening**: freeze features. Full walkthrough runs ×5 (desktop, mobile, incognito, cold start, judge-fresh eyes). Polish seed data, README, deploy checks.
