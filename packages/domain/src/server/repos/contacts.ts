import { and, asc, desc, eq, isNotNull, or } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

import { contacts, submissionParticipants, submissions } from "../../db/schema";
import { Db } from "../db";
import type { DbError, NotFound } from "../errors";
import { Contact, type ContactCreate, type ContactUpdate } from "../schema/submissions";
import { decode, decodeFound, decodeMany, query, speakerContact } from "./shared";

interface ContactsService {
  readonly listByEvent: (eventId: string) => Effect.Effect<ReadonlyArray<Contact>, DbError>;
  /** Every contact of the event — submitters included, not just speakers. */
  readonly listAllByEvent: (eventId: string) => Effect.Effect<ReadonlyArray<Contact>, DbError>;
  readonly findPreviewByEvent: (eventId: string) => Effect.Effect<Contact, DbError | NotFound>;
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
            .where(and(eq(contacts.eventId, eventId), speakerContact(db)))
            .orderBy(asc(contacts.lastName), asc(contacts.firstName))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Contact, "contact", rows))),
      listAllByEvent: (eventId) =>
        query(database, "Could not list contacts", (db) =>
          db
            .select()
            .from(contacts)
            .where(eq(contacts.eventId, eventId))
            .orderBy(asc(contacts.lastName), asc(contacts.firstName))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(Contact, "contact", rows))),
      findPreviewByEvent: (eventId) =>
        query(database, "Could not load portal preview contact", (db) =>
          db
            .select({ contact: contacts, hasSubmission: isNotNull(submissions.id) })
            .from(contacts)
            .leftJoin(submissionParticipants, eq(submissionParticipants.contactId, contacts.id))
            .leftJoin(
              submissions,
              or(
                eq(submissions.id, submissionParticipants.submissionId),
                eq(submissions.submitterContactId, contacts.id),
              ),
            )
            .where(eq(contacts.eventId, eventId))
            .orderBy(desc(isNotNull(submissions.id)), asc(contacts.id))
            .limit(1)
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(Contact, "Contact", rows[0]?.contact))),
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
