// @jsxRuntime automatic
// @jsxImportSource react
import { Text } from "react-email";

import { Cta, EmailLayout, NoteCard, paragraph } from "../src/components/layout";

export interface ReinstatedProps {
  readonly eventName: string;
  readonly speakerName: string;
  readonly submissionTitle: string;
  readonly message: string;
  readonly reinvited: boolean;
  readonly portalUrl: string;
  readonly logoUrl?: string | null;
}

export const reinstatementIntroduction = ({
  eventName,
  submissionTitle,
  reinvited,
}: Pick<ReinstatedProps, "eventName" | "submissionTitle" | "reinvited">) =>
  `Good news — “${submissionTitle}” has been reinstated and is back on the ${eventName} program.${reinvited ? " An updated calendar invite is attached; accepting it restores the session in your calendar." : ""}`;

// The inverse of a cancellation: the acceptance never went away, the session
// is simply back on the program. When the original invite chain exists the
// email carries a fresh METHOD:REQUEST that restores the calendar event.
export default function Reinstated({
  eventName,
  speakerName,
  submissionTitle,
  message,
  reinvited,
  portalUrl,
  logoUrl = null,
}: ReinstatedProps) {
  const trimmedMessage = message.trim();
  return (
    <EmailLayout
      brandName={eventName}
      logoUrl={logoUrl}
      heading="Your session is back on"
      preview={`Your ${eventName} session is back on`}
    >
      <Text style={paragraph}>Hi {speakerName},</Text>
      <Text style={paragraph}>
        {reinstatementIntroduction({ eventName, submissionTitle, reinvited })}
      </Text>
      {trimmedMessage.length === 0 ? null : (
        <NoteCard title="A note from the program team">{trimmedMessage}</NoteCard>
      )}
      <Cta href={portalUrl}>Open speaker portal</Cta>
      <Text style={{ ...paragraph, margin: "0" }}>The {eventName} program team</Text>
    </EmailLayout>
  );
}

Reinstated.PreviewProps = {
  eventName: "AI.Engineer Sandbox — NYC 2026",
  speakerName: "Lina",
  submissionTitle: "Serverless GPUs at the Edge",
  message: "The track opened back up — your original slot is yours again.",
  reinvited: true,
  portalUrl: "https://app.opensesh.io/portal",
  logoUrl: "https://app.opensesh.io/demo/aie-logo.png",
} satisfies ReinstatedProps;
