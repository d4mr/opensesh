import { and, asc, eq } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import { contacts, eventMembers, events, organizationMembers, organizations } from "../db/schema";
import { Db, makeDbLive } from "./db";
import { DbError, Forbidden, NeedsOrganization, Unauthenticated } from "./errors";
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
  organizationName: Schema.String,
  organizationLogo: Schema.NullOr(Schema.String),
  eventSlug: Schema.NullOr(Schema.String),
  roles: Schema.Struct({
    admin: Schema.Boolean,
    reviewer: Schema.Boolean,
    contactId: Schema.optionalKey(Schema.String),
  }),
});
export type CurrentUserValue = typeof CurrentUserValue.Type;

export type RequiredRole = "session" | "staff" | "admin" | "reviewer" | "speaker";

interface CurrentUserService {
  readonly get: Effect.Effect<
    CurrentUserValue,
    DbError | Forbidden | NeedsOrganization | Unauthenticated
  >;
}

export class CurrentUser extends Context.Service<CurrentUser, CurrentUserService>()(
  "opensesh/CurrentUser",
) {}

const makeCurrentUserLayer = (
  loadSession: Effect.Effect<SessionIdentity | null, DbError>,
  preferredEventSlug: string | ((session: SessionIdentity) => string | undefined) | undefined,
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
          // One round trip: memberships × their org's events × this user's
          // event roles/contact, selected in JS. The previous three dependent
          // queries cost three sequential worker→database round trips on every
          // server-function call, which dominates latency when the worker runs
          // far from Postgres.
          const allRows = yield* query(database, "Could not load organization membership", (db) =>
            db
              .select({
                organizationMember: organizationMembers,
                organization: organizations,
                event: events,
                eventMember: eventMembers,
                contact: contacts,
              })
              .from(organizationMembers)
              .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
              .leftJoin(events, eq(events.organizationId, organizationMembers.organizationId))
              .leftJoin(
                eventMembers,
                and(eq(eventMembers.eventId, events.id), eq(eventMembers.userId, session.userId)),
              )
              .leftJoin(
                contacts,
                and(eq(contacts.eventId, events.id), eq(contacts.email, session.email)),
              )
              .where(eq(organizationMembers.userId, session.userId))
              .orderBy(
                asc(organizationMembers.createdAt),
                asc(organizationMembers.id),
                asc(events.startsAt),
              )
              .execute(),
          );
          const selectedMembership =
            allRows.find(
              (row) => row.organizationMember.organizationId === session.activeOrganizationId,
            ) ?? allRows[0];
          if (selectedMembership === undefined) {
            return yield* Effect.fail(
              new NeedsOrganization({ message: "Create an organization to continue" }),
            );
          }
          const organizationMember = yield* Schema.decodeUnknownEffect(OrganizationMember)(
            selectedMembership.organizationMember,
          ).pipe(
            Effect.mapError(
              (cause) =>
                new DbError({ message: "Could not decode organization membership", cause }),
            ),
          );
          const membershipRows = allRows.filter(
            (row) => row.organizationMember.organizationId === organizationMember.organizationId,
          );
          const eventRowsById = new Map(
            membershipRows.flatMap((row) =>
              row.event === null ? [] : [[row.event.id, row.event]],
            ),
          );
          const organizationEvents = yield* decodeMany(
            Event,
            "event",
            Array.from(eventRowsById.values()),
          ).pipe(
            Effect.map((decoded) =>
              decoded
                .slice()
                .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime()),
            ),
          );
          const preferredSlug =
            typeof preferredEventSlug === "function"
              ? preferredEventSlug(session)
              : preferredEventSlug;
          const now = new Date();
          const event =
            (preferredSlug === undefined
              ? undefined
              : organizationEvents.find((candidate) => candidate.slug === preferredSlug)) ??
            organizationEvents.find((candidate) => candidate.startsAt >= now) ??
            organizationEvents.at(-1);
          const rows =
            event === undefined
              ? []
              : membershipRows.filter((row) => row.event !== null && row.event.id === event.id);

          const memberRows = yield* decodeMany(
            EventMember,
            "event member",
            rows.flatMap((row) => (row.eventMember === null ? [] : [row.eventMember])),
          );
          const contactRows = yield* decodeMany(
            Contact,
            "contact",
            rows.flatMap((row) => (row.contact === null ? [] : [row.contact])),
          );

          const contact = contactRows[0];
          return {
            userId: session.userId,
            email: session.email,
            orgId: organizationMember.organizationId,
            organizationName: selectedMembership.organization.name,
            organizationLogo: selectedMembership.organization.logo,
            eventSlug: event?.slug ?? null,
            roles: {
              admin:
                organizationMember.role === "owner" ||
                organizationMember.role === "admin" ||
                memberRows.some((member) => member.role === "admin"),
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
  preferredEventSlug?: string | ((session: SessionIdentity) => string | undefined),
) =>
  makeCurrentUserLayer(loadSession, preferredEventSlug).pipe(
    Layer.provide(makeDbLive(connectionString)),
  );

// Accepts a shared Db layer so CurrentUser rides the same Postgres client
// as the repositories instead of paying its own connection setup.
export const makeCurrentUserLiveWith = (
  dbLive: Layer.Layer<Db>,
  loadSession: Effect.Effect<SessionIdentity | null, DbError>,
  preferredEventSlug?: string | ((session: SessionIdentity) => string | undefined),
) => makeCurrentUserLayer(loadSession, preferredEventSlug).pipe(Layer.provide(dbLive));

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
