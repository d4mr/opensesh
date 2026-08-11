import { and, eq, inArray } from "drizzle-orm";
import { Context, Effect, Layer, type Schema } from "effect";

import { eventIntegrations, organizationContacts } from "../../db/schema";
import { Db } from "../db";
import type { DbError } from "../errors";
import { query } from "./shared";

// Raw stored config — internal only; server-fns project it into the masked
// EventIntegrationView before it reaches a client.
export interface StoredIntegration {
  readonly id: string;
  readonly eventId: string;
  readonly provider: string;
  readonly config: Readonly<Record<string, Schema.Json>>;
  readonly lastSyncedAt: Date | null;
  readonly lastResult: Readonly<Record<string, Schema.Json>> | null;
}

interface IntegrationsService {
  readonly getByEvent: (
    eventId: string,
    provider: string,
  ) => Effect.Effect<StoredIntegration | null, DbError>;
  readonly upsert: (
    eventId: string,
    provider: string,
    config: Readonly<Record<string, Schema.Json>>,
  ) => Effect.Effect<StoredIntegration, DbError>;
  readonly recordSync: (
    id: string,
    result: Readonly<Record<string, Schema.Json>>,
  ) => Effect.Effect<void, DbError>;
  // Resolves org-CRM contact ids for a set of emails (case-normalized), used
  // by sync orchestration to link imported contacts to the event and enrich
  // fields the CSV-import seam does not carry (socials, headshot, provenance).
  readonly contactIdsByEmails: (
    organizationId: string,
    emails: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<{ readonly id: string; readonly email: string }>, DbError>;
  readonly enrichContact: (
    organizationContactId: string,
    fields: {
      readonly linkedinUrl: string | null;
      readonly twitterUrl: string | null;
      readonly headshotUrl: string | null;
      readonly custom: Readonly<Record<string, Schema.Json>>;
    },
  ) => Effect.Effect<void, DbError>;
}

export class Integrations extends Context.Service<Integrations, IntegrationsService>()(
  "opensesh/Integrations",
) {}

export const IntegrationsLive = Layer.effect(
  Integrations,
  Effect.gen(function* () {
    const { database } = yield* Db;

    return {
      getByEvent: (eventId, provider) =>
        query(database, "Could not load integration", (db) =>
          db
            .select()
            .from(eventIntegrations)
            .where(
              and(eq(eventIntegrations.eventId, eventId), eq(eventIntegrations.provider, provider)),
            )
            .limit(1)
            .execute(),
        ).pipe(Effect.map((rows) => rows[0] ?? null)),
      upsert: (eventId, provider, config) =>
        query(database, "Could not save integration", (db) =>
          db
            .insert(eventIntegrations)
            .values({ eventId, provider, config })
            .onConflictDoUpdate({
              target: [eventIntegrations.eventId, eventIntegrations.provider],
              set: { config, updatedAt: new Date() },
            })
            .returning()
            .execute(),
        ).pipe(Effect.map((rows) => rows[0] as StoredIntegration)),
      recordSync: (id, result) =>
        query(database, "Could not record sync result", (db) =>
          db
            .update(eventIntegrations)
            .set({ lastSyncedAt: new Date(), lastResult: result, updatedAt: new Date() })
            .where(eq(eventIntegrations.id, id))
            .execute(),
        ).pipe(Effect.asVoid),
      contactIdsByEmails: (organizationId, emails) =>
        emails.length === 0
          ? Effect.succeed([])
          : query(database, "Could not resolve imported contacts", (db) =>
              db
                .select({ id: organizationContacts.id, email: organizationContacts.email })
                .from(organizationContacts)
                .where(
                  and(
                    eq(organizationContacts.organizationId, organizationId),
                    inArray(
                      organizationContacts.email,
                      emails.map((email) => email.trim().toLowerCase()),
                    ),
                  ),
                )
                .execute(),
            ),
      enrichContact: (organizationContactId, fields) =>
        query(database, "Could not enrich imported contact", (db) =>
          db
            .update(organizationContacts)
            .set({
              linkedinUrl: fields.linkedinUrl,
              twitterUrl: fields.twitterUrl,
              ...(fields.headshotUrl === null ? {} : { headshotUrl: fields.headshotUrl }),
              custom: fields.custom,
              updatedAt: new Date(),
            })
            .where(eq(organizationContacts.id, organizationContactId))
            .execute(),
        ).pipe(Effect.asVoid),
    };
  }),
);
