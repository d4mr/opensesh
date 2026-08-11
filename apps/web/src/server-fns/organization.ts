import { getCurrentUser } from "@opensesh/domain/server/current-user";
import { DbError, InvalidInput } from "@opensesh/domain/server/errors";
import { Organization } from "@opensesh/domain/server/repos";
import {
  OrganizationInvitationRevokeRequest,
  OrganizationMemberRemoveRequest,
  OrganizationMemberRoleRequest,
  OrganizationProfileRequest,
} from "@opensesh/domain";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export const updateOrganizationProfile = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(OrganizationProfileRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const request = getRequest();
    return runServer(
      Effect.gen(function* () {
        const user = yield* getCurrentUser;
        const organization = yield* Organization;
        const name = data.name.trim();
        if (name === "")
          return yield* Effect.fail(new InvalidInput({ message: "Organization name is required" }));
        let logo = data.logo?.trim() || null;
        if (data.logoUpload !== null) {
          if (data.logoUpload.size > 2 * 1024 * 1024) {
            return yield* Effect.fail(
              new InvalidInput({ message: "Organization logos must be 2 MB or smaller" }),
            );
          }
          if (
            data.logoUpload.contentType !== "image/png" &&
            data.logoUpload.contentType !== "image/jpeg" &&
            data.logoUpload.contentType !== "image/svg+xml"
          ) {
            return yield* Effect.fail(
              new InvalidInput({ message: "Use a PNG, JPG, or SVG organization logo" }),
            );
          }
          const bytes = decodeBase64(data.logoUpload.base64);
          if (bytes.byteLength !== data.logoUpload.size) {
            return yield* Effect.fail(
              new InvalidInput({ message: "The uploaded organization logo is incomplete" }),
            );
          }
          // Fixed storage key per org — the asset route resolves it without a
          // dedicated key column; ?v= busts the hour-long edge cache on replace.
          yield* Effect.tryPromise({
            try: () =>
              env.FILES.put(`organizations/${user.orgId}/icon`, bytes, {
                httpMetadata: {
                  contentType: data.logoUpload?.contentType ?? "application/octet-stream",
                  contentDisposition: "inline",
                },
              }),
            catch: (cause) =>
              new DbError({ message: "Could not store the organization logo", cause }),
          });
          logo = `${new URL(request.url).origin}/org-assets/${user.orgId}/icon?v=${crypto.randomUUID().slice(0, 8)}`;
        }
        return yield* organization.updateProfile(user.orgId, user.userId, { name, logo });
      }),
      { require: "admin" },
    );
  });
