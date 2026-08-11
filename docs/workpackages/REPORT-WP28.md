# WP28 report — CFP integrity

## Built

- Removed the form-editor fields × admins cross join. The field/form query now returns only form
  rows, while `Events.listAdmins` runs alongside it and filters to actual event admins
  (`packages/domain/src/server/repos/read-models.ts:419`,
  `packages/domain/src/server/repos/events.ts:248`). With a temporary second admin, the read model
  returned `admins: 2, fields: 11, uniqueFields: 11`.
- Added defensive field-id de-duplication and `Forms.saveWithFields`. Form update, pruned-field
  delete, and ordered field upsert now run in one Postgres transaction
  (`packages/domain/src/server/repos/forms.ts:75`,
  `packages/domain/src/server/repos/forms.ts:230`). `saveForm` keeps its authorization reads
  parallel, then calls the transactional method (`apps/web/src/server-fns/forms.ts:167`).
- Threaded enabled participant roles through the public wizard. The first participant receives the
  first enabled role, later participants receive later enabled roles (or the sole role), total
  enabled min/max values control add/remove, and role names label cards and review rows
  (`apps/web/src/routes/submit.$eventSlug.$formId.tsx:53`,
  `apps/web/src/routes/submit.$eventSlug.$formId.tsx:131`,
  `apps/web/src/routes/submit.$eventSlug.$formId.tsx:417`).
- Normalized unknown/legacy participant roles to the first enabled role before server-side counting
  and persistence. Required role slots without an email now fail with `InvalidInput` instead of
  disappearing (`packages/domain/src/server/cfp.ts:40`, `packages/domain/src/server/cfp.ts:130`,
  `packages/domain/src/server/cfp.ts:232`).
- Added open-form validation for required participant collection. An open form with a positive
  enabled-role minimum cannot save without a participant email question, and the actionable error
  is rendered as quiet inline text inside the active editor panel
  (`apps/web/src/server-fns/forms.ts:174`,
  `apps/web/src/routes/admin.forms_.$formId.tsx:361`).
- Replaced positional fallback keys with required editor IDs. Missing IDs are minted once with
  `crypto.randomUUID()`, new rows do the same, successful saves invalidate the exact editor query,
  and the Required switch has an explicit label association
  (`apps/web/src/routes/admin.forms_.$formId.tsx:96`,
  `apps/web/src/routes/admin.forms_.$formId.tsx:243`,
  `apps/web/src/components/forms/form-field-builder.tsx:106`,
  `apps/web/src/components/forms/form-field-builder.tsx:169`,
  `apps/web/src/components/forms/form-field-builder.tsx:420`).
- Made seeded field limits explicit, set DevFlow Description to 5000, added the three locked
  participant fields, and updated seed verification to expect 20 fields
  (`packages/domain/src/seed/seed.ts:199`,
  `packages/domain/src/seed/verify-seed.ts:79`). New forms now start with Title + Description plus
  their locked participant identity fields (`apps/web/src/server-fns/forms.ts:71`).
- Rich-text limits now measure tag-stripped text. A focused unit test covers markup at and over the
  limit (`packages/domain/src/server/schema/forms.ts:232`,
  `packages/domain/src/server/schema/forms.test.ts:1`).

## Decisions

- Used the brief's preferred separate admin read through the existing Events service. This removes
  row multiplication at the source instead of merely hiding duplicate decoded fields. The Events
  and ReadModels layers are composed once so the shared service remains available without a second
  database abstraction (`packages/domain/src/server/repos/index.ts:81`).
- Kept `replaceFields` for create/duplicate callers and added the narrowly scoped transactional
  `saveWithFields` for editor saves. Both paths share the same last-write-wins ID de-duplication.
- Required-participant email errors are based on enabled role minima. This keeps incomplete optional
  co-presenters draftable while ensuring a required participant is never silently dropped.
- The only UI addition is a 13px destructive inline message. No banner, card, shadow, animation, or
  dependency was added. Cloudflare runtime/binding code was left untouched; transaction and driver
  details stay inside the domain repository.

## Verification performed

1. Confirmed `apps/web/.dev.vars` resolves to `localhost:5433/opensesh_wp28`, then ran:

   ```sh
   pnpm --filter @opensesh/domain db:reset
   ```

   Result: all table counts matched, including `form_fields 20/20`, ending with
   `Seed verification passed: DevFlow fixtures, personas, review rounds, CRM, status mix, one conflict, and org memberships.`

2. Forced the field-write portion of `saveWithFields` to fail with `maxChars: 2147483648` after
   changing the form name in the same transaction. Result:
   `{ failed: true, formUnchanged: true, fieldsUnchanged: true }`.

3. Added a temporary second admin to the seeded demo event, loaded `form_sessions` through
   `ReadModels.formEditorForAdmin`, then removed the temporary membership. Result:
   `{ admins: 2, fields: 11, uniqueFields: 11 }`.

4. Ran the exact DevFlow domain submission path with a 386-character Description, one
   `Primary speaker`, and one `Co-presenter`. Result: pending submission
   `Y3sstKCMMQP4WPb-8Df1U`, stored roles
   `['Primary speaker', 'Co-presenter']`, and `visibleInAdminData: true`.

5. Automated checks:

   ```sh
   pnpm check
   pnpm test
   pnpm cfp:verify
   pnpm build
   ```

   Results: check clean; 12 test files / 42 tests passed; CFP integration verification passed; all
   workspace builds passed with the configured Vite+ toolchain (no fallback).

## Browser acceptance

The app was started successfully at `http://localhost:3028/` against `opensesh_wp28`. The session's
browser-control service reported no available browser backends (`[]`), even after its prescribed
connection troubleshooting. Per the browser-control contract, I did not substitute standalone
Playwright or another unrelated UI surface. Therefore these interactive-only steps remain unclaimed:

- create a new form in the UI and visually confirm Title + Description once each;
- change short text → long text → dropdown with a reload after each;
- visually confirm the public form after each editor reload;
- click through confirmation and visually open the submission in admin.

The same save/read/submit data paths were exercised directly as listed above, but that is not
represented as a browser walkthrough.

## Open items and manual URLs

- Open only because no browser backend was available: the four interactive checks above.
- Admin forms: `http://localhost:3028/admin/forms`
- DevFlow public form: `http://localhost:3028/submit/devflow-conf-2027/form_devflow_cfp`
- Re-run all required checks with the commands in the verification section.
- No schema or migration files were changed. No production database, deploy, commit, or push was
  performed.
