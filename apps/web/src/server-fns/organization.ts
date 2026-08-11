import { getCurrentUser } from "@opensesh/domain/server/current-user";
import { InvalidInput } from "@opensesh/domain/server/errors";
import { Organization } from "@opensesh/domain/server/repos";
import {
  OrganizationInvitationRevokeRequest,
  OrganizationMemberRemoveRequest,
  OrganizationMemberRoleRequest,
  OrganizationProfileRequest,
} from "@opensesh/domain";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { runServer } from "@/server/runtime";

export const getOrganizationSettings = createServerFn({ method: "GET" }).handler(async () =>
  runServer(
    Effect.gen(function* () {
      const user = yield* getCurrentUser;
      const organization = yield* Organization;
      const [profile, members, invitations] = yield* Effect.all([
        organization.getProfile(user.orgId, user.userId),
        organization.listMembers(user.orgId),
        organization.listPendingInvitations(user.orgId),
      ]);
      return {
        organization: profile.organization,
        members,
        invitations,
        viewer: { userId: user.userId, role: profile.viewerRole },
      };
    }),
    { require: "admin" },
  ),
);

export const updateOrganizationMemberRole = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(OrganizationMemberRoleRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const user = yield* getCurrentUser;
        const organization = yield* Organization;
        return yield* organization.updateMemberRole(
          user.orgId,
          user.userId,
          data.memberId,
          data.role,
        );
      }),
      { require: "admin" },
    ),
  );

export const removeOrganizationMember = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(OrganizationMemberRemoveRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const user = yield* getCurrentUser;
        const organization = yield* Organization;
        return yield* organization.removeMember(user.orgId, user.userId, data.memberId);
      }),
      { require: "admin" },
    ),
  );

export const revokeOrganizationInvitation = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(OrganizationInvitationRevokeRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const user = yield* getCurrentUser;
        const organization = yield* Organization;
        return yield* organization.revokeInvitation(user.orgId, user.userId, data.invitationId);
      }),
      { require: "admin" },
    ),
  );

export const updateOrganizationProfile = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(OrganizationProfileRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const user = yield* getCurrentUser;
        const organization = yield* Organization;
        const name = data.name.trim();
        if (name === "")
          return yield* Effect.fail(new InvalidInput({ message: "Organization name is required" }));
        return yield* organization.updateProfile(user.orgId, user.userId, {
          name,
          logo: data.logo?.trim() || null,
        });
      }),
      { require: "admin" },
    ),
  );
