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
  eventSlug: string,
) =>
  Layer.effect(
    CurrentUser,
    Effect.gen(function* () {
      const { database } = yield* Db;

      return {
        get: Effect.gen(function* () {
          const session = yield* loadSession;
          if (session === null) {
            return yield* Effect.fail(new Unauthenticated({ message: "Sign in to continue" }));
          }

          const [eventRows, organizationMemberRows] = yield* Effect.all([
            query(database, "Could not load current event", (db) =>
              db.select().from(events).where(eq(events.slug, eventSlug)).limit(1).execute(),
            ).pipe(Effect.flatMap((rows) => decodeMany(Event, "event", rows))),
            query(database, "Could not load organization memberships", (db) =>
              db
                .select()
                .from(organizationMembers)
                .where(eq(organizationMembers.userId, session.userId))
                .execute(),
            ).pipe(
              Effect.flatMap((rows) =>
                decodeMany(OrganizationMember, "organization membership", rows),
              ),
            ),
          ]);
          const event = eventRows[0];
          if (event === undefined) {
            return yield* Effect.fail(
              new DbError({ message: "Current event is missing", cause: eventRows }),
            );
          }
          const organizationMember =
            session.activeOrganizationId === undefined
              ? organizationMemberRows[0]
              : organizationMemberRows.find(
                  (member) => member.organizationId === session.activeOrganizationId,
                );
          if (
            organizationMember === undefined ||
            organizationMember.organizationId !== event.organizationId
          ) {
            return yield* Effect.fail(
              new Forbidden({ message: "You do not have access to this organization" }),
            );
          }

          const [memberRows, contactRows] = yield* Effect.all([
            query(database, "Could not load current user roles", (db) =>
              db
                .select()
                .from(eventMembers)
                .where(
                  and(eq(eventMembers.eventId, event.id), eq(eventMembers.userId, session.userId)),
                )
                .execute(),
            ).pipe(Effect.flatMap((rows) => decodeMany(EventMember, "event member", rows))),
            query(database, "Could not load current speaker", (db) =>
              db
                .select()
                .from(contacts)
                .where(and(eq(contacts.eventId, event.id), eq(contacts.email, session.email)))
                .limit(1)
                .execute(),
            ).pipe(Effect.flatMap((rows) => decodeMany(Contact, "contact", rows))),
          ]);

          const contact = contactRows[0];
          return {
            userId: session.userId,
            email: session.email,
            orgId: organizationMember.organizationId,
            roles: {
              admin: memberRows.some((member) => member.role === "admin"),
              reviewer: memberRows.some((member) => member.role === "reviewer"),
              ...(contact === undefined ? {} : { contactId: contact.id }),
            },
          };
        }),
      };
    }),
  );

export const makeCurrentUserLive = (
  connectionString: string,
  loadSession: Effect.Effect<SessionIdentity | null, DbError>,
  eventSlug: string,
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
