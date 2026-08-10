import { asc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

import { formFields, forms } from "../../db/schema";
import { Db } from "../db";
import type { DbError, NotFound } from "../errors";
import {
  Form,
  type FormCreate,
  FormField,
  type FormFieldReplacement,
  type FormUpdate,
} from "../schema/forms";
import { decode, decodeFound, decodeMany, query } from "./shared";

interface FormsService {
  readonly listByEvent: (eventId: string) => Effect.Effect<ReadonlyArray<Form>, DbError>;
  readonly get: (id: string) => Effect.Effect<Form, DbError | NotFound>;
  readonly create: (input: FormCreate) => Effect.Effect<Form, DbError>;
  readonly update: (id: string, input: FormUpdate) => Effect.Effect<Form, DbError | NotFound>;
  readonly listFields: (formId: string) => Effect.Effect<ReadonlyArray<FormField>, DbError>;
  readonly replaceFields: (
    formId: string,
    fields: ReadonlyArray<FormFieldReplacement>,
  ) => Effect.Effect<ReadonlyArray<FormField>, DbError>;
}

export class Forms extends Context.Service<Forms, FormsService>()("opensesh/Forms") {}

export const FormsLive = Layer.effect(
  Forms,
  Effect.gen(function* () {
    const { database } = yield* Db;

    return {
      listByEvent: (eventId) =>
        query(database, "Could not list forms", (db) =>
          db
            .select()
            .from(forms)
            .where(eq(forms.eventId, eventId))
            .orderBy(asc(forms.createdAt))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Form, "form", rows))),
      get: (id) =>
        query(database, "Could not load form", (db) =>
          db.select().from(forms).where(eq(forms.id, id)).limit(1).execute(),
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
      listFields: (formId) =>
        query(database, "Could not list form fields", (db) =>
          db
            .select()
            .from(formFields)
            .where(eq(formFields.formId, formId))
            .orderBy(asc(formFields.position))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(FormField, "form field", rows))),
      replaceFields: (formId, fields) =>
        Effect.gen(function* () {
          yield* query(database, "Could not replace form fields", (db) =>
            db.delete(formFields).where(eq(formFields.formId, formId)).execute(),
          );

          if (fields.length === 0) {
            return [];
          }

          const rows = yield* query(database, "Could not replace form fields", (db) =>
            db
              .insert(formFields)
              .values(fields.map((field) => ({ ...field, formId })))
              .returning()
              .execute(),
          );
          return yield* decodeMany(FormField, "form field", rows);
        }),
    };
  }),
);
