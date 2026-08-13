// @jsxRuntime automatic
// @jsxImportSource react
import { Text } from "react-email";

import { Cta, EmailLayout, paragraph } from "../src/components/layout";

export interface MagicLinkProps {
  readonly url: string;
}

// App-branded, not event-branded: sign-in belongs to the account, and the
// same link works for every event the user can reach.
export default function MagicLink({ url }: MagicLinkProps) {
  return (
    <EmailLayout brandName="opensesh" preview="Your secure sign-in link">
      <Text style={paragraph}>Use this secure link to sign in to opensesh.</Text>
      <Cta href={url}>Sign in to opensesh</Cta>
      <Text style={{ ...paragraph, margin: "0", fontSize: "12px", color: "#68706a" }}>
        If you did not request this email, you can safely ignore it.
      </Text>
    </EmailLayout>
  );
}

MagicLink.PreviewProps = {
  url: "https://app.opensesh.io/api/auth/magic-link/verify?token=preview",
} satisfies MagicLinkProps;
