import { and, asc, desc, eq } from "drizzle-orm";
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
  name: Schema.String,
  activeOrganizationId: Schema.optionalKey(Schema.String),
});
export type SessionIdentity = typeof SessionIdentity.Type;

export const CurrentUserValue = Schema.Struct({
  userId: Schema.String,
  email: Schema.String,
  name: Schema.String,
  orgId: Schema.String,
  organizationName: Schema.String,
  organizationLogo: Schema.NullOr(Schema.String),
  eventSlug: Schema.NullOr(Schema.String),
  orgRole: Schema.NullOr(Schema.Literals(["owner", "admin", "member"])),
  events: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      slug: Schema.String,
      memberRole: Schema.NullOr(Schema.Literals(["admin", "reviewer"])),
    }),
  ),
  roles: Schema.Struct({
    admin: Schema.Boolean,
    reviewer: Schema.Boolean,
    member: Schema.Boolean,
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
            ) ?? allRows.at(-1);
          if (selectedMembership === undefined) {
            const contactRows = yield* query(database, "Could not load speaker contact", (db) =>
              db
                .select({ contact: contacts, event: events, organization: organizations })
                .from(contacts)
                .innerJoin(events, eq(events.id, contacts.eventId))
                .innerJoin(organizations, eq(organizations.id, events.organizationId))
                .where(eq(contacts.email, session.email))
                .orderBy(desc(contacts.createdAt))
                .execute(),
            );
            const preferredSlug =
              typeof preferredEventSlug === "function"
                ? preferredEventSlug(session)
                : preferredEventSlug;
            const selectedContact =
              (preferredSlug === undefined
                ? undefined
                : contactRows.find((row) => row.event.slug === preferredSlug)) ?? contactRows[0];
            if (selectedContact === undefined) {
              return yield* Effect.fail(
                new NeedsOrganization({ message: "Create an organization to continue" }),
              );
            }
            const contact = yield* Schema.decodeUnknownEffect(Contact)(
              selectedContact.contact,
            ).pipe(
              Effect.mapError(
                (cause) => new DbError({ message: "Could not decode speaker contact", cause }),
              ),
            );
            const event = yield* Schema.decodeUnknownEffect(Event)(selectedContact.event).pipe(
              Effect.mapError(
                (cause) => new DbError({ message: "Could not decode speaker event", cause }),
              ),
            );
            return {
              userId: session.userId,
              email: session.email,
              name: session.name,
              orgId: event.organizationId,
              organizationName: selectedContact.organization.name,
              organizationLogo: selectedContact.organization.logo,
              eventSlug: event.slug,
              orgRole: null,
              events: [],
              roles: {
                admin: false,
                reviewer: false,
                member: false,
                contactId: contact.id,
              },
            };
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

          const allMemberRows = yield* decodeMany(
            EventMember,
            "event member",
            Array.from(
              new Map(
                membershipRows.flatMap((row) =>
                  row.eventMember === null ? [] : [[row.eventMember.id, row.eventMember]],
                ),
              ).values(),
            ),
          );
          const memberRoleByEventId = new Map(
            allMemberRows.map((member) => [member.eventId, member.role]),
          );
          const memberRows = allMemberRows.filter((member) => member.eventId === event?.id);
          const contactRows = yield* decodeMany(
            Contact,
            "contact",
            rows.flatMap((row) => (row.contact === null ? [] : [row.contact])),
          );

          const contact = contactRows[0];
          const orgRole: "owner" | "admin" | "member" =
            organizationMember.role === "owner"
              ? "owner"
              : organizationMember.role === "admin"
                ? "admin"
                : "member";
          return {
            userId: session.userId,
            email: session.email,
            name: session.name,
            orgId: organizationMember.organizationId,
            organizationName: selectedMembership.organization.name,
            organizationLogo: selectedMembership.organization.logo,
            eventSlug: event?.slug ?? null,
            orgRole,
            events: organizationEvents.map((candidate) => ({
              id: candidate.id,
              slug: candidate.slug,
              memberRole: memberRoleByEventId.get(candidate.id) ?? null,
            })),
            roles: {
              admin:
                organizationMember.role === "owner" ||
                organizationMember.role === "admin" ||
                memberRows.some((member) => member.role === "admin"),
              reviewer: memberRows.some((member) => member.role === "reviewer"),
              member: true,
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

export type EventAccessRole = "admin" | "reviewer" | "staff";

// Access is derived, never stored: org owners/admins are admins of every
// event in the organization; event_members is only a roster overlay for
// explicitly-invited per-event staff. Recomputed per TARGET event, so an
// event-scoped admin of event A never passes for event B.
export const requireEventAccess = (eventId: string, required: EventAccessRole) =>
  Effect.gen(function* () {
    const user = yield* getCurrentUser;
    const event = user.events.find((candidate) => candidate.id === eventId);
    if (event === undefined) {
      return yield* Effect.fail(new Forbidden({ message: "You cannot access this event" }));
    }
    const admin =
      user.orgRole === "owner" || user.orgRole === "admin" || event.memberRole === "admin";
    const allowed =
      required === "staff" ||
      (required === "admin" && admin) ||
      (required === "reviewer" && (admin || event.memberRole === "reviewer"));
    if (!allowed) {
      return yield* Effect.fail(new Forbidden({ message: "You do not have access" }));
    }
    return { user, event: { id: event.id, slug: event.slug }, admin };
  });

export const requireCurrentUser = (required: RequiredRole) =>
  Effect.gen(function* () {
    const user = yield* getCurrentUser;
    const allowed =
      required === "session" ||
      (required === "staff" && (user.roles.admin || user.roles.reviewer || user.roles.member)) ||
      (required === "admin" && user.roles.admin) ||
      (required === "reviewer" && (user.roles.admin || user.roles.reviewer)) ||
      (required === "speaker" && user.roles.contactId !== undefined);

    if (!allowed) {
      return yield* Effect.fail(new Forbidden({ message: "You do not have access" }));
    }

    return user;
  });

// Machine principals (API keys) carry a pre-derived CurrentUserValue — no
// session and no membership rows behind it. requireEventAccess still applies
// per target event, so tenant isolation is identical to the session path.
export const makeCurrentUserFromValueLive = (value: CurrentUserValue) =>
  Layer.succeed(CurrentUser, { get: Effect.succeed(value) });
