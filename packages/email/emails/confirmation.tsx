// @jsxRuntime automatic
// @jsxImportSource react
import { Text } from "react-email";

import { Cta, EmailLayout, paragraph } from "../src/components/layout";

export interface ConfirmationProps {
  readonly eventName: string;
  readonly name: string;
  readonly submissionTitle: string;
  readonly portalUrl: string;
  readonly logoUrl?: string | null;
  /**
   * Organizer-authored markdown, pre-rendered by the caller. The renderer
   * escapes raw markup, so the fragment is safe to inline unescaped.
   */
  readonly customBodyHtml?: string;
}

export default function Confirmation({
  eventName,
  name,
  submissionTitle,
  portalUrl,
  logoUrl = null,
  customBodyHtml,
}: ConfirmationProps) {
  return (
    <EmailLayout
      brandName={eventName}
      logoUrl={logoUrl}
      preview={`We received “${submissionTitle}”`}
    >
      {customBodyHtml === undefined ? (
        <Text style={paragraph}>
          Thanks, {name}. Your submission “{submissionTitle}” is in the review queue.
        </Text>
      ) : (
        <div
          style={{ fontSize: "14px", lineHeight: "1.6" }}
          dangerouslySetInnerHTML={{ __html: customBodyHtml }}
        />
      )}
      <Text style={paragraph}>You can review its status in the speaker portal.</Text>
      <Cta href={portalUrl}>View submission</Cta>
    </EmailLayout>
  );
}

Confirmation.PreviewProps = {
  eventName: "AI.Engineer Sandbox — NYC 2026",
  name: "Maya",
  submissionTitle: "Evals in Production",
  portalUrl: "https://app.opensesh.io/portal",
} satisfies ConfirmationProps;
