# Eval-driven priorities (from the official eval kit)

Source: forge.smol.ai/swyx/killmysaas-evals — 96 rubric items, 7 areas. Weights: CFP 20, Abstract Mgmt 20, Speaker Mgmt 15, **Content Mgmt 15**, AI Agenda 10, Public Widgets 20, Speaker CRM 10 (extra credit). The evaluator is an AI agent driving a browser with the fixture data in `sample-data.json` (DevFlow Conf 2027). These are DELTAS to fold into specs as each WP launches — not a rewrite.

## Already folded

- **WP2c**: email+password sign-in alongside magic links (fixture personas authenticate with passwords); seeded demo password.

## Fold at WP launch

- **WP3 (CFP)**: the eval agent CREATES the event from scratch — "DevFlow Conf 2027", 3 tracks, 5 formats, 4 rooms. We need an event-creation flow + library management UI (tracks/formats/rooms CRUD, not seed-only). Fixture field coverage on submissions: audience_level, notes_for_reviewers.
- **WP4 (review desk)**: rating + comment + decision per fixture example; nothing structural beyond current spec.
- **WP5 (portal) — biggest gap, build FULLY (CMS = 15%)**: file upload **versioning** (re-upload keeps history), **comment threads on files** visible cross-role (organizer ↔ speaker), **session edit history + restore**, **approval status on content gating the public agenda** (unapproved edits don't leak to public pages). Speaker tasks checklist matches fixture task list (confirm participation, headshot, bio, slides deadline, release form). Profile fields: dietary, t-shirt size (CRM extra credit).
- **WP6 (agenda)**: explicit **Publish** action (draft agenda → public; the handoff scenario checks this), rooms/tracks manageable from here too.
- **WP7 (mail/ics)**: acceptance email templating with `{speaker_name}`/`{talk_title}` merge fields per fixture.
- **WP8+ (CRM — extra credit but user says build fully)**: **CSV speaker import** (`speakers.csv` fixture), speaker directory with dietary/tshirt/social fields, export.
- **WP9 (AI)**: agent becomes an **auto-scheduler** (fills the agenda respecting rooms/formats/conflicts — judged generously, high leverage for 10%).

## Standing rules the evals reward

- Round-trip integrity: everything an organizer enters must be visible where the counterpart role looks (submission → review → decision → portal → public agenda).
- Scoping: reviewers must NOT see other events' data or admin controls; speakers see only their own submissions/tasks.
- No dead ends: every rubric scenario starts from login → nav must reach every feature without URL-typing.
