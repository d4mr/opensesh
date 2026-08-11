import { and, asc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

import {
  organizationInvitations,
  organizationMembers,
  organizations,
  users,
} from "../../db/schema";
import { Db } from "../db";
import {
  type DbError,
  Forbidden,
  NotFound,
  OrganizationLastOwner,
  OrganizationMemberNotFound,
  OrganizationSelfDemotion,
} from "../errors";
import {
  OrganizationInvitationView,
  type OrganizationInvitationView as OrganizationInvitationViewType,
  OrganizationMemberView,
  type OrganizationMemberView as OrganizationMemberViewType,
  OrganizationProfile,
  type OrganizationProfile as OrganizationProfileType,
  OrganizationRole,
  type OrganizationRole as OrganizationRoleType,
} from "../schema/organization";
import { decode, decodeFound, decodeMany, query } from "./shared";

type MutationOutcome =
  | { readonly kind: "ok" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "lastOwner"; readonly selfDemotion: boolean }
  | { readonly kind: "memberNotFound" }
  | { readonly kind: "notFound" };

type InvitationMutationOutcome =
  | { readonly kind: "ok" }
  | { readonly kind: "forbidden" }
  | { readonly kind: "memberNotFound" }
  | { readonly kind: "notFound" };

type ProfileMutationOutcome =
  | { readonly kind: "memberNotFound" }
  | { readonly kind: "forbidden" }
  | {
      readonly kind: "ok";
      readonly row:
        | {
            readonly id: string;
            readonly name: string;
            readonly slug: string;
            readonly logo: string | null;
          }
        | undefined;
    };

interface OrganizationService {
  readonly getProfile: (
    organizationId: string,
    actorUserId: string,
  ) => Effect.Effect<
    { readonly organization: OrganizationProfileType; readonly viewerRole: OrganizationRoleType },
    DbError | OrganizationMemberNotFound
  >;
  readonly listMembers: (
    organizationId: string,
  ) => Effect.Effect<ReadonlyArray<OrganizationMemberViewType>, DbError>;
  readonly updateMemberRole: (
    organizationId: string,
    actorUserId: string,
    memberId: string,
    role: OrganizationRoleType,
  ) => Effect.Effect<
    void,
    | DbError
    | Forbidden
    | OrganizationLastOwner
    | OrganizationMemberNotFound
    | OrganizationSelfDemotion
  >;
  readonly removeMember: (
    organizationId: string,
    actorUserId: string,
    memberId: string,
  ) => Effect.Effect<
    void,
    | DbError
    | Forbidden
    | OrganizationLastOwner
    | OrganizationMemberNotFound
    | OrganizationSelfDemotion
  >;
  readonly listPendingInvitations: (
    organizationId: string,
  ) => Effect.Effect<ReadonlyArray<OrganizationInvitationViewType>, DbError>;
  readonly revokeInvitation: (
    organizationId: string,
    actorUserId: string,
    invitationId: string,
  ) => Effect.Effect<void, DbError | Forbidden | NotFound | OrganizationMemberNotFound>;
  readonly updateProfile: (
    organizationId: string,
    actorUserId: string,
    input: { readonly name: string; readonly logo: string | null },
  ) => Effect.Effect<
    OrganizationProfileType,
    DbError | Forbidden | NotFound | OrganizationMemberNotFound
  >;
}

export class Organization extends Context.Service<Organization, OrganizationService>()(
  "opensesh/Organization",
) {}

const memberMutationFailure = (
  outcome: MutationOutcome,
): Effect.Effect<
  void,
  Forbidden | OrganizationLastOwner | OrganizationMemberNotFound | OrganizationSelfDemotion
> => {
  if (outcome.kind === "ok") return Effect.void;
  if (outcome.kind === "memberNotFound")
    return Effect.fail(
      new OrganizationMemberNotFound({ message: "Organization member not found" }),
    );
  if (outcome.kind === "lastOwner" && outcome.selfDemotion)
    return Effect.fail(
      new OrganizationSelfDemotion({ message: "Add another owner before changing your role" }),
    );
  if (outcome.kind === "lastOwner")
    return Effect.fail(
      new OrganizationLastOwner({ message: "The only owner cannot be changed or removed" }),
    );
  return Effect.fail(new Forbidden({ message: "You cannot manage this organization member" }));
};

export const OrganizationLive = Layer.effect(
  Organization,
  Effect.gen(function* () {
    const { database } = yield* Db;

    return {
      getProfile: (organizationId, actorUserId) =>
        query(database, "Could not load organization profile", (db) =>
          db
            .select({
              id: organizations.id,
              name: organizations.name,
              slug: organizations.slug,
              logo: organizations.logo,
              viewerRole: organizationMembers.role,
            })
            .from(organizations)
            .innerJoin(
              organizationMembers,
              and(
                eq(organizationMembers.organizationId, organizations.id),
                eq(organizationMembers.userId, actorUserId),
              ),
            )
            .where(eq(organizations.id, organizationId))
            .limit(1)
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            Effect.gen(function* () {
              const row = rows[0];
              if (row === undefined)
                return yield* Effect.fail(
                  new OrganizationMemberNotFound({ message: "Organization membership not found" }),
                );
              const organization = yield* decode(OrganizationProfile, "organization", row);
              const viewerRole = yield* decode(
                OrganizationRole,
                "organization role",
                row.viewerRole,
              );
              return { organization, viewerRole };
            }),
          ),
        ),
      listMembers: (organizationId) =>
        query(database, "Could not list organization members", (db) =>
          db
            .select({
              id: organizationMembers.id,
              userId: organizationMembers.userId,
              name: users.name,
              email: users.email,
              image: users.image,
              role: organizationMembers.role,
              createdAt: organizationMembers.createdAt,
            })
            .from(organizationMembers)
            .innerJoin(users, eq(users.id, organizationMembers.userId))
            .where(eq(organizationMembers.organizationId, organizationId))
            .orderBy(asc(users.name))
            .execute(),
        ).pipe(
          Effect.flatMap((rows) => decodeMany(OrganizationMemberView, "organization member", rows)),
        ),
      updateMemberRole: (organizationId, actorUserId, memberId, role) =>
        query(database, "Could not update organization member", (db) =>
          db.transaction(async (transaction): Promise<MutationOutcome> => {
            const members = await transaction
              .select()
              .from(organizationMembers)
              .where(eq(organizationMembers.organizationId, organizationId))
              .for("update")
              .execute();
            const actor = members.find((member) => member.userId === actorUserId);
            const target = members.find((member) => member.id === memberId);
            if (actor === undefined) return { kind: "memberNotFound" };
            if (target === undefined) return { kind: "memberNotFound" };
            if (actor.role === "member") return { kind: "forbidden" };
            if (actor.role === "admin" && (target.role === "owner" || role === "owner"))
              return { kind: "forbidden" };
            if (
              target.role === "owner" &&
              role !== "owner" &&
              members.filter((member) => member.role === "owner").length === 1
            )
              return { kind: "lastOwner", selfDemotion: target.userId === actorUserId };
            await transaction
              .update(organizationMembers)
              .set({ role })
              .where(
                and(
                  eq(organizationMembers.id, memberId),
                  eq(organizationMembers.organizationId, organizationId),
                ),
              )
              .execute();
            return { kind: "ok" };
          }),
        ).pipe(Effect.flatMap(memberMutationFailure)),
      removeMember: (organizationId, actorUserId, memberId) =>
        query(database, "Could not remove organization member", (db) =>
          db.transaction(async (transaction): Promise<MutationOutcome> => {
            const members = await transaction
              .select()
              .from(organizationMembers)
              .where(eq(organizationMembers.organizationId, organizationId))
              .for("update")
              .execute();
            const actor = members.find((member) => member.userId === actorUserId);
            const target = members.find((member) => member.id === memberId);
            if (actor === undefined) return { kind: "memberNotFound" };
            if (target === undefined) return { kind: "memberNotFound" };
            if (actor.role === "member") return { kind: "forbidden" };
            if (actor.role === "admin" && target.role === "owner") return { kind: "forbidden" };
            if (
              target.role === "owner" &&
              members.filter((member) => member.role === "owner").length === 1
            )
              return { kind: "lastOwner", selfDemotion: false };
            await transaction
              .delete(organizationMembers)
              .where(
                and(
                  eq(organizationMembers.id, memberId),
                  eq(organizationMembers.organizationId, organizationId),
                ),
              )
              .execute();
            return { kind: "ok" };
          }),
        ).pipe(Effect.flatMap(memberMutationFailure)),
      listPendingInvitations: (organizationId) =>
        query(database, "Could not list organization invitations", (db) =>
          db
            .select({
              id: organizationInvitations.id,
              email: organizationInvitations.email,
              role: organizationInvitations.role,
              expiresAt: organizationInvitations.expiresAt,
              createdAt: organizationInvitations.createdAt,
            })
            .from(organizationInvitations)
            .where(
              and(
                eq(organizationInvitations.organizationId, organizationId),
                eq(organizationInvitations.status, "pending"),
              ),
            )
            .orderBy(asc(organizationInvitations.createdAt))
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            decodeMany(
              OrganizationInvitationView,
              "organization invitation",
              rows.map((row) => ({ ...row, role: row.role ?? "member" })),
            ),
          ),
        ),
      revokeInvitation: (organizationId, actorUserId, invitationId) =>
        query(database, "Could not revoke organization invitation", (db) =>
          db.transaction(async (transaction): Promise<InvitationMutationOutcome> => {
            const [actor] = await transaction
              .select()
              .from(organizationMembers)
              .where(
                and(
                  eq(organizationMembers.organizationId, organizationId),
                  eq(organizationMembers.userId, actorUserId),
                ),
              )
              .limit(1)
              .execute();
            if (actor === undefined) return { kind: "memberNotFound" };
            if (actor.role === "member") return { kind: "forbidden" };
            const [invitation] = await transaction
              .select()
              .from(organizationInvitations)
              .where(
                and(
                  eq(organizationInvitations.id, invitationId),
                  eq(organizationInvitations.organizationId, organizationId),
                  eq(organizationInvitations.status, "pending"),
                ),
              )
              .limit(1)
              .execute();
            if (invitation === undefined) return { kind: "notFound" };
            if (actor.role === "admin" && invitation.role === "owner") return { kind: "forbidden" };
            await transaction
              .update(organizationInvitations)
              .set({ status: "canceled" })
              .where(eq(organizationInvitations.id, invitationId))
              .execute();
            return { kind: "ok" };
          }),
        ).pipe(
          Effect.flatMap(
            (outcome): Effect.Effect<void, Forbidden | NotFound | OrganizationMemberNotFound> => {
              if (outcome.kind === "notFound")
                return Effect.fail(new NotFound({ message: "Invitation not found" }));
              if (outcome.kind === "memberNotFound")
                return Effect.fail(
                  new OrganizationMemberNotFound({ message: "Organization membership not found" }),
                );
              if (outcome.kind === "forbidden")
                return Effect.fail(
                  new Forbidden({ message: "You cannot revoke this organization invitation" }),
                );
              return Effect.void;
            },
          ),
        ),
      updateProfile: (organizationId, actorUserId, input) =>
        query(
          database,
          "Could not update organization profile",
          async (db): Promise<ProfileMutationOutcome> => {
            const [actor] = await db
              .select()
              .from(organizationMembers)
              .where(
                and(
                  eq(organizationMembers.organizationId, organizationId),
                  eq(organizationMembers.userId, actorUserId),
                ),
              )
              .limit(1)
              .execute();
            if (actor === undefined) return { kind: "memberNotFound" };
            if (actor.role !== "owner") return { kind: "forbidden" };
            const [row] = await db
              .update(organizations)
              .set(input)
              .where(eq(organizations.id, organizationId))
              .returning({
                id: organizations.id,
                name: organizations.name,
                slug: organizations.slug,
                logo: organizations.logo,
              })
              .execute();
            return { kind: "ok", row };
          },
        ).pipe(
          Effect.flatMap(
            (
              outcome,
            ): Effect.Effect<
              OrganizationProfileType,
              Forbidden | NotFound | OrganizationMemberNotFound | DbError
            > => {
              if (outcome.kind === "memberNotFound")
                return Effect.fail(
                  new OrganizationMemberNotFound({ message: "Organization membership not found" }),
                );
              if (outcome.kind === "forbidden")
                return Effect.fail(
                  new Forbidden({ message: "Only an owner can update the organization profile" }),
                );
              return decodeFound(OrganizationProfile, "Organization", outcome.row);
            },
          ),
        ),
    };
  }),
);
