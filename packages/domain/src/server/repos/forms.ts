import { and, asc, desc, eq, notInArray, sql } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { nanoid } from "nanoid";

import { formFields, forms, submissions } from "../../db/schema";
import { Db } from "../db";
import type { DbError, NotFound } from "../errors";
import {
  Form,
  type FormCreate,
  FormField,
  type FormFieldReplacement,
  type FormUpdate,
  type FormSummary,
} from "../schema/forms";
import { Submission } from "../schema/submissions";
import { decode, decodeFound, decodeMany, query } from "./shared";

interface FormsService {
  readonly listByEvent: (eventId: string) => Effect.Effect<ReadonlyArray<Form>, DbError>;
  readonly listSummaries: (eventId: string) => Effect.Effect<ReadonlyArray<FormSummary>, DbError>;
  readonly get: (id: string) => Effect.Effect<Form, DbError | NotFound>;
  readonly getByEvent: (eventId: string, id: string) => Effect.Effect<Form, DbError | NotFound>;
  readonly create: (input: FormCreate) => Effect.Effect<Form, DbError>;
  readonly update: (id: string, input: FormUpdate) => Effect.Effect<Form, DbError | NotFound>;
  readonly duplicate: (id: string) => Effect.Effect<Form, DbError | NotFound>;
  readonly delete: (id: string) => Effect.Effect<void, DbError>;
  readonly listFields: (formId: string) => Effect.Effect<ReadonlyArray<FormField>, DbError>;
  readonly replaceFields: (
    formId: string,
    fields: ReadonlyArray<FormFieldReplacement>,
  ) => Effect.Effect<ReadonlyArray<FormField>, DbError>;
  readonly saveWithFields: (
    formId: string,
    form: FormUpdate,
    fields: ReadonlyArray<FormFieldReplacement>,
  ) => Effect.Effect<
    { readonly form: Form; readonly fields: ReadonlyArray<FormField> },
    DbError | NotFound
  >;
}

export class Forms extends Context.Service<Forms, FormsService>()("opensesh/Forms") {}

export const FormsLive = Layer.effect(
  Forms,
  Effect.gen(function* () {
    const { database } = yield* Db;

    const listByEvent = (eventId: string) =>
      query(database, "Could not list forms", (db) =>
        db
          .select()
          .from(forms)
          .where(eq(forms.eventId, eventId))
          .orderBy(desc(forms.createdAt))
          .execute(),
      ).pipe(Effect.flatMap((rows) => decodeMany(Form, "form", rows)));

    const get = (id: string) =>
      query(database, "Could not load form", (db) =>
        db.select().from(forms).where(eq(forms.id, id)).limit(1).execute(),
      ).pipe(Effect.flatMap((rows) => decodeFound(Form, "Form", rows[0])));

    const listFields = (formId: string) =>
      query(database, "Could not list form fields", (db) =>
        db
          .select()
          .from(formFields)
          .where(eq(formFields.formId, formId))
          .orderBy(asc(formFields.position))
          .execute(),
      ).pipe(Effect.flatMap((rows) => decodeMany(FormField, "form field", rows)));

    const replacementRows = (formId: string, fields: ReadonlyArray<FormFieldReplacement>) =>
      Array.from(
        new Map(
          fields.map((field) => {
            const id = field.id ?? nanoid();
            return [id, { ...field, id, formId }] as const;
          }),
        ).values(),
      );

    const fieldConflictUpdate = () => ({
      section: sql`excluded.section`,
      label: sql`excluded.label`,
      fieldType: sql`excluded.field_type`,
      maxChars: sql`excluded.max_chars`,
      required: sql`excluded.required`,
      locked: sql`excluded.locked`,
      position: sql`excluded.position`,
      options: sql`excluded.options`,
      mapsTo: sql`excluded.maps_to`,
      condition: sql`excluded.condition`,
      updatedAt: new Date(),
    });

    return {
      listByEvent,
      listSummaries: (eventId) =>
        Effect.all([
          listByEvent(eventId),
          query(database, "Could not count form submissions", (db) =>
            db.select().from(submissions).where(eq(submissions.eventId, eventId)).execute(),
          ).pipe(Effect.flatMap((rows) => decodeMany(Submission, "submission", rows))),
        ]).pipe(
          Effect.map(([eventForms, eventSubmissions]) =>
            eventForms.map((form) => ({
              ...form,
              submissions: eventSubmissions.filter(
                (submission) =>
                  submission.sourceFormId === form.id && submission.status !== "draft",
              ).length,
              drafts: eventSubmissions.filter(
                (submission) =>
                  submission.sourceFormId === form.id && submission.status === "draft",
              ).length,
            })),
          ),
        ),
      get,
      getByEvent: (eventId, id) =>
        query(database, "Could not load form", (db) =>
          db
            .select()
            .from(forms)
            .where(and(eq(forms.id, id), eq(forms.eventId, eventId)))
            .limit(1)
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Form, "Form", rows[0]))),
      create: (input) =>
        query(database, "Could not create form", (db) =>
          db.insert(forms).values(input).returning().execute(),
        ).pipe(Effect.flatMap((rows) => decode(Form, "form", rows[0]))),
      update: (id, input) =>
        query(database, "Could not update form", (db) =>
          db
            .update(forms)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(forms.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Form, "Form", rows[0]))),
      duplicate: (id) =>
        Effect.gen(function* () {
          const source = yield* get(id);
          const fields = yield* listFields(id);
          const { id: sourceId, createdAt, updatedAt, ...copy } = source;
          void sourceId;
          void createdAt;
          void updatedAt;
          const createdRow = yield* query(database, "Could not duplicate form", (db) =>
            db.transaction(async (transaction) => {
              const createdRows = await transaction
                .insert(forms)
                .values({ ...copy, internalName: `${copy.internalName} copy` })
                .returning()
                .execute();
              const created = createdRows[0];
              if (created !== undefined && fields.length > 0) {
                await transaction
                  .insert(formFields)
                  .values(
                    fields.map((field) => {
                      const {
                        id: fieldId,
                        formId,
                        createdAt: fieldCreatedAt,
                        updatedAt: fieldUpdatedAt,
                        ...fieldCopy
                      } = field;
                      void fieldId;
                      void formId;
                      void fieldCreatedAt;
                      void fieldUpdatedAt;
                      return { ...fieldCopy, formId: created.id };
                    }),
                  )
                  .execute();
              }
              return created;
            }),
          );
          return yield* decode(Form, "form", createdRow);
        }),
      delete: (id) =>
        query(database, "Could not delete form", (db) =>
          db.delete(forms).where(eq(forms.id, id)).execute(),
        ).pipe(Effect.asVoid),
      listFields,
      // Editors send stable field ids, so replacement is an upsert of the
      // kept rows plus a prune of the rest — one concurrent database phase
      // instead of the four sequential round trips a BEGIN/DELETE/INSERT/
      // COMMIT transaction costs when the database is a region away.
      replaceFields: (formId, fields) =>
        Effect.gen(function* () {
          const next = replacementRows(formId, fields);
          const keptIds = next.map((field) => field.id);
          const prune = query(database, "Could not prune form fields", (db) =>
            db
              .delete(formFields)
              .where(
                keptIds.length === 0
                  ? eq(formFields.formId, formId)
                  : and(eq(formFields.formId, formId), notInArray(formFields.id, keptIds)),
              )
              .execute(),
          );
          if (next.length === 0) {
            yield* prune;
            return [];
          }
          const upsert = query(database, "Could not save form fields", (db) =>
            db
              .insert(formFields)
              .values(next)
              .onConflictDoUpdate({
                target: formFields.id,
                // A colliding id from another form must not be captured.
                setWhere: eq(formFields.formId, formId),
                set: fieldConflictUpdate(),
              })
              .returning()
              .execute(),
          );
          const [rows] = yield* Effect.all([upsert, prune], { concurrency: 2 });
          return yield* decodeMany(FormField, "form field", rows);
        }),
      saveWithFields: (formId, form, fields) =>
        Effect.gen(function* () {
          const next = replacementRows(formId, fields);
          const keptIds = next.map((field) => field.id);
          const saved = yield* query(database, "Could not save form", (db) =>
            db.transaction(async (transaction) => {
              const formRows = await transaction
                .update(forms)
                .set({ ...form, updatedAt: new Date() })
                .where(eq(forms.id, formId))
                .returning()
                .execute();
              await transaction
                .delete(formFields)
                .where(
                  keptIds.length === 0
                    ? eq(formFields.formId, formId)
                    : and(eq(formFields.formId, formId), notInArray(formFields.id, keptIds)),
                )
                .execute();
              const fieldRows =
                next.length === 0
                  ? []
                  : await transaction
                      .insert(formFields)
                      .values(next)
                      .onConflictDoUpdate({
                        target: formFields.id,
                        setWhere: eq(formFields.formId, formId),
                        set: fieldConflictUpdate(),
                      })
                      .returning()
                      .execute();
              return { form: formRows[0], fields: fieldRows };
            }),
          );
          const savedForm = yield* decodeFound(Form, "Form", saved.form);
          const savedFields = yield* decodeMany(FormField, "form field", saved.fields);
          return { form: savedForm, fields: savedFields };
        }),
    };
  }),
);
