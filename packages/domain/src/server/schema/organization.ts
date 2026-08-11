import { Schema } from "effect";

import { NullableString } from "./common";

export const OrganizationRole = Schema.Literals(["owner", "admin", "member"]);
export type OrganizationRole = typeof OrganizationRole.Type;

export const OrganizationProfile = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  logo: NullableString,
});
export type OrganizationProfile = typeof OrganizationProfile.Type;

export const OrganizationMemberView = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  name: Schema.String,
  email: Schema.String,
  image: NullableString,
  role: OrganizationRole,
  createdAt: Schema.Date,
});
export type OrganizationMemberView = typeof OrganizationMemberView.Type;

export const OrganizationInvitationView = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  role: OrganizationRole,
  expiresAt: Schema.Date,
  createdAt: Schema.Date,
});
export type OrganizationInvitationView = typeof OrganizationInvitationView.Type;

export const OrganizationSettings = Schema.Struct({
  organization: OrganizationProfile,
  members: Schema.Array(OrganizationMemberView),
  invitations: Schema.Array(OrganizationInvitationView),
  viewer: Schema.Struct({
    userId: Schema.String,
    role: OrganizationRole,
  }),
});
export type OrganizationSettings = typeof OrganizationSettings.Type;

export const OrganizationMemberRoleRequest = Schema.Struct({
  memberId: Schema.String,
  role: OrganizationRole,
});

export const OrganizationMemberRemoveRequest = Schema.Struct({ memberId: Schema.String });

export const OrganizationInvitationRevokeRequest = Schema.Struct({ invitationId: Schema.String });

export const OrganizationProfileRequest = Schema.Struct({
  name: Schema.String,
  logo: NullableString,
});
