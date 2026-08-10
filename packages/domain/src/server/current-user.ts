import { and, eq } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import { contacts, eventMembers, events, organizationMembers } from "../db/schema";
import { Db, makeDbLive } from "./db";
import { DbError, Forbidden, Unauthenticated } from "./errors";
import { Event, EventMember, OrganizationMember } from "./schema/core";
import { Contact } from "./schema/submissions";
import { decodeMany, query } from "./repos/shared";

export const SessionIdentity = Schema.Struct({
  userId: Schema.String,
  email: Schema.String,
  activeOrganizationId: Schema.optionalKey(Schema.String),
});
export type SessionIdentity = typeof SessionIdentity.Type;

export const CurrentUserValue = Schema.Struct({
  userId: Schema.String,
  email: Schema.String,
  orgId: Schema.String,
  eventSlug: Schema.String,
  roles: Schema.Struct({
    admin: Schema.Boolean,
    reviewer: Schema.Boolean,
    contactId: Schema.optionalKey(Schema.String),
  }),
});
export type CurrentUserValue = typeof CurrentUserValue.Type;

export type RequiredRole = "session" | "staff" | "admin" | "reviewer" | "speaker";

interface CurrentUserService {
  readonly get: Effect.Effect<CurrentUserValue, DbError | Forbidden | Unauthenticated>;
}

export class CurrentUser extends Context.Service<CurrentUser, CurrentUserService>()(
  "opensesh/CurrentUser",
) {}

const makeCurrentUserLayer = (
  loadSession: Effect.Effect<SessionIdentity | null, DbError>,
  eventSlug: string | ((session: SessionIdentity) => string),
) =>
  Layer.effect(
    CurrentUser,
    Effect.gen(function* () {
      const { database } = yield* Db;

      const get = yield* Effect.cached(
        Effect.gen(function* () {
          const session = yield* loadSession;
          if (session === null) {
            return yield* Effect.fail(new Unauthenticated({ message: "Sign in to continue" }));
          }
          const scopedEventSlug = typeof eventSlug === "string" ? eventSlug : eventSlug(session);

          const rows = yield* query(database, "Could not load current user", (db) =>
            db
              .select({
                event: events,
                organizationMember: organizationMembers,
                eventMember: eventMembers,
                contact: contacts,
              })
              .from(events)
              .leftJoin(
                organizationMembers,
                and(
                  eq(organizationMembers.organizationId, events.organizationId),
                  eq(organizationMembers.userId, session.userId),
                ),
              )
              .leftJoin(
                eventMembers,
                and(eq(eventMembers.eventId, events.id), eq(eventMembers.userId, session.userId)),
              )
              .leftJoin(
                contacts,
                and(eq(contacts.eventId, events.id), eq(contacts.email, session.email)),
              )
              .where(eq(events.slug, scopedEventSlug))
              .execute(),
          );
          const first = rows[0];
          const event = yield* decodeMany(
            Event,
            "event",
            first === undefined ? [] : [first.event],
          ).pipe(Effect.map((decoded) => decoded[0]));
          if (event === undefined) {
            return yield* Effect.fail(
              new DbError({ message: "Current event is missing", cause: rows }),
            );
          }
          const organizationMember = yield* decodeMany(
            OrganizationMember,
            "organization membership",
            first?.organizationMember === null || first?.organizationMember === undefined
              ? []
              : [first.organizationMember],
          ).pipe(Effect.map((decoded) => decoded[0]));
          if (
            organizationMember === undefined ||
            organizationMember.organizationId !== event.organizationId ||
            (session.activeOrganizationId !== undefined &&
              session.activeOrganizationId !== event.organizationId)
          ) {
            return yield* Effect.fail(
              new Forbidden({ message: "You do not have access to this organization" }),
            );
          }

          const memberRows = yield* decodeMany(
            EventMember,
            "event member",
            rows.flatMap((row) => (row.eventMember === null ? [] : [row.eventMember])),
          );
          const contactRows = yield* decodeMany(
            Contact,
            "contact",
            first.contact === null ? [] : [first.contact],
          );

          const contact = contactRows[0];
          return {
            userId: session.userId,
            email: session.email,
            orgId: organizationMember.organizationId,
            eventSlug: scopedEventSlug,
            roles: {
              admin: memberRows.some((member) => member.role === "admin"),
              reviewer: memberRows.some((member) => member.role === "reviewer"),
              ...(contact === undefined ? {} : { contactId: contact.id }),
            },
          };
        }),
      );
      return { get };
    }),
  );

export const makeCurrentUserLive = (
  connectionString: string,
  loadSession: Effect.Effect<SessionIdentity | null, DbError>,
  eventSlug: string | ((session: SessionIdentity) => string),
) => makeCurrentUserLayer(loadSession, eventSlug).pipe(Layer.provide(makeDbLive(connectionString)));

export const getCurrentUser = Effect.gen(function* () {
  const service = yield* CurrentUser;
  return yield* service.get;
});

export const requireCurrentUser = (required: RequiredRole) =>
  Effect.gen(function* () {
    const user = yield* getCurrentUser;
    const allowed =
      required === "session" ||
      (required === "staff" && (user.roles.admin || user.roles.reviewer)) ||
      (required === "admin" && user.roles.admin) ||
      (required === "reviewer" && (user.roles.admin || user.roles.reviewer)) ||
      (required === "speaker" && user.roles.contactId !== undefined);

    if (!allowed) {
      return yield* Effect.fail(new Forbidden({ message: "You do not have access" }));
    }

    return user;
  });
