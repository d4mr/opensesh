// @jsxRuntime automatic
// @jsxImportSource react
import { Text } from "react-email";

import { Cta, EmailLayout, NoteCard, paragraph } from "../src/components/layout";

export interface CancelledProps {
  readonly eventName: string;
  readonly speakerName: string;
  readonly submissionTitle: string;
  readonly cause: "organizer" | "speaker";
  readonly message: string;
  readonly portalUrl: string;
  readonly logoUrl?: string | null;
}

export const cancellationIntroduction = ({
  eventName,
  submissionTitle,
  cause,
}: Pick<CancelledProps, "eventName" | "submissionTitle" | "cause">) =>
  cause === "speaker"
    ? `This confirms the cancellation of “${submissionTitle}.” We are sorry it did not work out and hope to see you at a future event.`
    : `We are sorry to let you know that “${submissionTitle}” has been cancelled and removed from the ${eventName} program.`;

// Session cancellation is not a declined decision: the talk was accepted and
// the session got called off afterward, by the organizers or by the speaker.
export default function Cancelled({
  eventName,
  speakerName,
  submissionTitle,
  cause,
  message,
  portalUrl,
  logoUrl = null,
}: CancelledProps) {
  const trimmedMessage = message.trim();
  return (
    <EmailLayout
      brandName={eventName}
      logoUrl={logoUrl}
      heading="Your session has been cancelled"
      preview={`Your ${eventName} session has been cancelled`}
    >
      <Text style={paragraph}>Hi {speakerName},</Text>
      <Text style={paragraph}>
        {cancellationIntroduction({ eventName, submissionTitle, cause })}
      </Text>
      {trimmedMessage.length === 0 ? null : (
        <NoteCard title="A note from the program team">{trimmedMessage}</NoteCard>
      )}
      <Cta href={portalUrl}>Open speaker portal</Cta>
      <Text style={{ ...paragraph, margin: "0" }}>The {eventName} program team</Text>
    </EmailLayout>
  );
}

Cancelled.PreviewProps = {
  eventName: "AI.Engineer Sandbox — NYC 2026",
  speakerName: "Lina",
  submissionTitle: "Serverless GPUs at the Edge",
  cause: "organizer",
  message: "A schedule conflict forced us to trim the track. We'd love to have you next year.",
  portalUrl: "https://app.opensesh.io/portal",
  logoUrl: "https://app.opensesh.io/demo/aie-logo.png",
} satisfies CancelledProps;
