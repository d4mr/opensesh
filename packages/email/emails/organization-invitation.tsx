// @jsxRuntime automatic
// @jsxImportSource react
import { Text } from "react-email";

import { Cta, EmailLayout, palette, paragraph } from "../src/components/layout";

export interface OrganizationInvitationProps {
  readonly organizationName: string;
  readonly inviterName: string;
  readonly role: string;
}

export const roleLabel = (role: string) => (role === "admin" ? "an administrator" : "a member");

export default function OrganizationInvitation({
  organizationName,
  inviterName,
  role,
  url,
}: OrganizationInvitationProps & { readonly url: string }) {
  return (
    <EmailLayout
      brandName={organizationName}
      heading={`Join ${organizationName} on opensesh`}
      preview={`${inviterName} invited you to ${organizationName}`}
    >
      <Text style={paragraph}>
        {inviterName} invited you to join {organizationName} as {roleLabel(role)}. opensesh is where
        the team plans events, reviews submissions, and runs the speaker program.
      </Text>
      <Cta href={url}>Accept invitation</Cta>
      <Text style={{ ...paragraph, margin: "0", fontSize: "13px", color: palette.muted }}>
        If you were not expecting this invitation, you can safely ignore it.
      </Text>
    </EmailLayout>
  );
}

OrganizationInvitation.PreviewProps = {
  organizationName: "AI.Engineer",
  inviterName: "Dana Whitmore",
  role: "admin",
  url: "https://app.opensesh.io/accept-invitation/preview",
} satisfies OrganizationInvitationProps & { url: string };
