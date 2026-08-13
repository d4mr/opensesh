// @jsxRuntime automatic
// @jsxImportSource react
import { Text } from "react-email";

import { Cta, EmailLayout, palette, paragraph } from "../src/components/layout";

export interface MagicLinkProps {
  readonly url: string;
}

// App-branded, not event-branded: sign-in belongs to the account, and the
// same link works for every event the user can reach.
export default function MagicLink({ url }: MagicLinkProps) {
  return (
    <EmailLayout
      brandName="opensesh"
      heading="Sign in to opensesh"
      preview="Your secure sign-in link"
    >
      <Text style={paragraph}>
        Click the button below to securely sign in. This link can only be used once.
      </Text>
      <Cta href={url}>Sign in</Cta>
      <Text style={{ ...paragraph, margin: "0", fontSize: "13px", color: palette.muted }}>
        If you did not request this email, you can safely ignore it.
      </Text>
    </EmailLayout>
  );
}

MagicLink.PreviewProps = {
  url: "https://app.opensesh.io/api/auth/magic-link/verify?token=preview",
} satisfies MagicLinkProps;
