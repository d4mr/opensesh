// @jsxRuntime automatic
// @jsxImportSource react
import { Text } from "react-email";

import { Cta, EmailLayout, paragraph } from "../src/components/layout";

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
    <EmailLayout brandName={organizationName} preview={`Join ${organizationName} on opensesh`}>
      <Text style={paragraph}>
        {inviterName} invited you to join {organizationName} as {roleLabel(role)}.
      </Text>
      <Cta href={url}>Accept invitation</Cta>
      <Text style={{ ...paragraph, margin: "0", fontSize: "12px", color: "#68706a" }}>
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
