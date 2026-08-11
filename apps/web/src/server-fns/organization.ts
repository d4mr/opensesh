import { getCurrentUser } from "@opensesh/domain/server/current-user";
import { DbError, InvalidInput, NotFound, Unauthenticated } from "@opensesh/domain/server/errors";
import { Organization } from "@opensesh/domain/server/repos";
import {
  OrganizationInvitationRevokeRequest,
  OrganizationInvitationRequest,
  OrganizationInviteRequest,
  OrganizationCreateRequest,
  OrganizationMemberRemoveRequest,
  OrganizationMemberRoleRequest,
  OrganizationProfileRequest,
} from "@opensesh/domain";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Effect, Schema } from "effect";

import { makeAuth, type CapturedInvitation } from "@/lib/auth";
import { runServer } from "@/server/runtime";

const authFailure = (message: string) => (cause: unknown) => new DbError({ message, cause });

export const getOnboardingState = createServerFn({ method: "GET" }).handler(async () => {
  const { env } = await import("cloudflare:workers");
  const request = getRequest();
  const auth = makeAuth(env, new URL(request.url).origin);
  return runServer(
    Effect.gen(function* () {
      const session = yield* Effect.tryPromise({
        try: () => auth.api.getSession({ headers: request.headers }),
        catch: authFailure("Could not load your session"),
      });
      if (session === null) {
        return yield* Effect.fail(new Unauthenticated({ message: "Sign in to continue" }));
      }
      const organizations = yield* Effect.tryPromise({
        try: () => auth.api.listOrganizations({ headers: request.headers }),
        catch: authFailure("Could not load your organizations"),
      });
      return { organizations };
    }),
  );
});

const validateLogo = (upload: typeof OrganizationCreateRequest.Type.logoUpload) =>
  Effect.gen(function* () {
    if (upload === null) return null;
    if (upload.size > 2 * 1024 * 1024) {
      return yield* Effect.fail(
        new InvalidInput({ message: "Organization logos must be 2 MB or smaller" }),
      );
    }
    if (
      upload.contentType !== "image/png" &&
      upload.contentType !== "image/jpeg" &&
      upload.contentType !== "image/svg+xml"
    ) {
      return yield* Effect.fail(
        new InvalidInput({ message: "Use a PNG, JPG, or SVG organization logo" }),
      );
    }
    const bytes = decodeBase64(upload.base64);
    if (bytes.byteLength !== upload.size) {
      return yield* Effect.fail(
        new InvalidInput({ message: "The uploaded organization logo is incomplete" }),
      );
    }
    return { bytes, contentType: upload.contentType };
  });

export const createOrganization = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(OrganizationCreateRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const request = getRequest();
    const origin = new URL(request.url).origin;
    const auth = makeAuth(env, origin);
    const program = Effect.gen(function* () {
      const name = data.name.trim();
      const slug = data.slug.trim();
      if (name === "" || slug === "") {
        return yield* Effect.fail(
          new InvalidInput({ message: "Organization name and slug are required" }),
        );
      }
      const upload = yield* validateLogo(data.logoUpload);
      const organization = yield* Effect.tryPromise({
        try: () =>
          auth.api.createOrganization({
            body: { name, slug },
            headers: request.headers,
          }),
        catch: () =>
          new InvalidInput({ message: "That organization slug is unavailable. Try another one." }),
      });
      if (upload === null) return organization;
      yield* Effect.tryPromise({
        try: () =>
          env.FILES.put(`organizations/${organization.id}/icon`, upload.bytes, {
            httpMetadata: { contentType: upload.contentType, contentDisposition: "inline" },
          }),
        catch: authFailure("Could not store the organization logo"),
      });
      const logo = `${origin}/org-assets/${organization.id}/icon`;
      yield* Effect.tryPromise({
        try: () =>
          auth.api.updateOrganization({
            body: { organizationId: organization.id, data: { logo } },
            headers: request.headers,
          }),
        catch: authFailure("Could not attach the organization logo"),
      });
      return { ...organization, logo };
    });
    return runServer(program);
  });

export const inviteOrganizationMember = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(OrganizationInviteRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const request = getRequest();
    let captured: CapturedInvitation | undefined;
    const auth = makeAuth(env, new URL(request.url).origin, undefined, (invitation) => {
      captured = invitation;
    });
    return runServer(
      Effect.gen(function* () {
        const user = yield* getCurrentUser;
        const invitation = yield* Effect.tryPromise({
          try: () =>
            auth.api.createInvitation({
              body: {
                email: data.email.trim().toLowerCase(),
                role: data.role,
                organizationId: user.orgId,
              },
              headers: request.headers,
            }),
          catch: () => new InvalidInput({ message: "Could not send this invitation" }),
        });
        return {
          invitation,
          demoLink: env.DEMO_MODE === "1" ? captured?.url : undefined,
        };
      }),
      { require: "admin" },
    );
  });

export const getOrganizationInvitation = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(OrganizationInvitationRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const request = getRequest();
    const auth = makeAuth(env, new URL(request.url).origin);
    const session = await auth.api.getSession({ headers: request.headers });
    if (session === null) {
      return runServer(
        Effect.fail(new Unauthenticated({ message: "Sign in to accept this invitation" })),
      );
    }
    return runServer(
      Effect.tryPromise({
        try: () =>
          auth.api.getInvitation({ query: { id: data.invitationId }, headers: request.headers }),
        catch: () =>
          new NotFound({ message: "This invitation has expired or is no longer available" }),
      }),
    );
  });

export const acceptOrganizationInvitation = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(OrganizationInvitationRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    const request = getRequest();
    const auth = makeAuth(env, new URL(request.url).origin);
    return runServer(
      Effect.tryPromise({
        try: () =>
          auth.api.acceptInvitation({
            body: { invitationId: data.invitationId },
            headers: request.headers,
          }),
        catch: () =>
          new InvalidInput({ message: "This invitation has expired or is no longer available" }),
      }),
    );
  });

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
