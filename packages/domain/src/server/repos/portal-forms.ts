import { asc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

import { portalFormResponses, portalForms } from "../../db/schema";
import { Db } from "../db";
import type { DbError, NotFound } from "../errors";
import {
  PortalForm,
  type PortalFormCreate,
  PortalFormResponse,
  type PortalFormResponseCreate,
  type PortalFormUpdate,
} from "../schema/portal";
import { decode, decodeFound, decodeMany, query } from "./shared";

interface PortalFormsService {
  readonly listByEvent: (eventId: string) => Effect.Effect<ReadonlyArray<PortalForm>, DbError>;
  readonly get: (id: string) => Effect.Effect<PortalForm, DbError | NotFound>;
  readonly create: (input: PortalFormCreate) => Effect.Effect<PortalForm, DbError>;
  readonly update: (
    id: string,
    input: PortalFormUpdate,
  ) => Effect.Effect<PortalForm, DbError | NotFound>;
  readonly submitResponse: (
    input: PortalFormResponseCreate,
  ) => Effect.Effect<PortalFormResponse, DbError>;
  readonly listResponses: (
    formId: string,
  ) => Effect.Effect<ReadonlyArray<PortalFormResponse>, DbError>;
}

export class PortalForms extends Context.Service<PortalForms, PortalFormsService>()(
  "opensesh/PortalForms",
) {}

export const PortalFormsLive = Layer.effect(
  PortalForms,
  Effect.gen(function* () {
    const { database } = yield* Db;
    return {
      listByEvent: (eventId) =>
        query(database, "Could not list portal forms", (db) =>
          db
            .select()
            .from(portalForms)
            .where(eq(portalForms.eventId, eventId))
            .orderBy(asc(portalForms.createdAt))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(PortalForm, "portal form", rows))),
      get: (id) =>
        query(database, "Could not load portal form", (db) =>
          db.select().from(portalForms).where(eq(portalForms.id, id)).limit(1).execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(PortalForm, "Portal form", rows[0]))),
      create: (input) =>
        query(database, "Could not create portal form", (db) =>
          db.insert(portalForms).values(input).returning().execute(),
        ).pipe(Effect.flatMap((rows) => decode(PortalForm, "portal form", rows[0]))),
      update: (id, input) =>
        query(database, "Could not update portal form", (db) =>
          db
            .update(portalForms)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(portalForms.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(PortalForm, "Portal form", rows[0]))),
      submitResponse: (input) =>
        query(database, "Could not submit portal form response", (db) =>
          db.insert(portalFormResponses).values(input).returning().execute(),
        ).pipe(
          Effect.flatMap((rows) => decode(PortalFormResponse, "portal form response", rows[0])),
        ),
      listResponses: (formId) =>
        query(database, "Could not list portal form responses", (db) =>
          db
            .select()
            .from(portalFormResponses)
            .where(eq(portalFormResponses.formId, formId))
            .orderBy(asc(portalFormResponses.submittedAt))
            .execute(),
        ).pipe(
          Effect.flatMap((rows) => decodeMany(PortalFormResponse, "portal form response", rows)),
        ),
    };
  }),
);
