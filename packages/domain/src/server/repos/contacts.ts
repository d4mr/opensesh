import { and, asc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

import { contacts } from "../../db/schema";
import { Db } from "../db";
import type { DbError, NotFound } from "../errors";
import { Contact, type ContactCreate, type ContactUpdate } from "../schema/submissions";
import { decode, decodeFound, decodeMany, query } from "./shared";

interface ContactsService {
  readonly listByEvent: (eventId: string) => Effect.Effect<ReadonlyArray<Contact>, DbError>;
  readonly get: (id: string) => Effect.Effect<Contact, DbError | NotFound>;
  readonly findByEmail: (
    eventId: string,
    email: string,
  ) => Effect.Effect<Contact, DbError | NotFound>;
  readonly create: (input: ContactCreate) => Effect.Effect<Contact, DbError>;
  readonly update: (id: string, input: ContactUpdate) => Effect.Effect<Contact, DbError | NotFound>;
}

export class Contacts extends Context.Service<Contacts, ContactsService>()("opensesh/Contacts") {}

export const ContactsLive = Layer.effect(
  Contacts,
  Effect.gen(function* () {
    const { database } = yield* Db;

    return {
      listByEvent: (eventId) =>
        query(database, "Could not list contacts", (db) =>
          db
            .select()
            .from(contacts)
            .where(and(eq(contacts.eventId, eventId), eq(contacts.participation, "speaker")))
            .orderBy(asc(contacts.lastName), asc(contacts.firstName))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Contact, "contact", rows))),
      get: (id) =>
        query(database, "Could not load contact", (db) =>
          db.select().from(contacts).where(eq(contacts.id, id)).limit(1).execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Contact, "Contact", rows[0]))),
      findByEmail: (eventId, email) =>
        query(database, "Could not load contact", (db) =>
          db
            .select()
            .from(contacts)
            .where(and(eq(contacts.eventId, eventId), eq(contacts.email, email)))
            .limit(1)
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Contact, "Contact", rows[0]))),
      create: (input) =>
        query(database, "Could not create contact", (db) =>
          db.insert(contacts).values(input).returning().execute(),
        ).pipe(Effect.flatMap((rows) => decode(Contact, "contact", rows[0]))),
      update: (id, input) =>
        query(database, "Could not update contact", (db) =>
          db
            .update(contacts)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(contacts.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Contact, "Contact", rows[0]))),
    };
  }),
);
