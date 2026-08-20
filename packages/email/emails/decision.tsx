// @jsxRuntime automatic
// @jsxImportSource react
import { Text } from "react-email";

import { Cta, EmailLayout, NoteCard, paragraph } from "../src/components/layout";

export interface DecisionProps {
  readonly accepted: boolean;
  readonly eventName: string;
  readonly speakerName: string;
  readonly submissionTitle: string;
  readonly feedback: string;
  readonly portalUrl: string;
  readonly logoUrl?: string | null;
  // Events with speaker confirmation on ask the speaker to confirm their
  // participation in the portal; the acceptance email leads with that ask.
  readonly confirmationRequested?: boolean;
  // Present when the organizer accepted the session into a different format
  // or track than submitted — one sentence naming the change.
  readonly programNote?: string | null;
}

export const decisionIntroduction = ({
  accepted,
  submissionTitle,
  confirmationRequested,
}: Pick<DecisionProps, "accepted" | "submissionTitle" | "confirmationRequested">) =>
  accepted
    ? confirmationRequested === true
      ? `We are delighted to accept “${submissionTitle}.” Please confirm your participation in the speaker portal — your onboarding tasks are ready there too.`
      : `We are delighted to accept “${submissionTitle}.” Your onboarding tasks are ready in the speaker portal.`
    : `Thank you for the thoughtful proposal “${submissionTitle}.” We are not able to include it in this year's program.`;

export default function Decision({
  accepted,
  eventName,
  speakerName,
  submissionTitle,
  feedback,
  portalUrl,
  logoUrl = null,
  confirmationRequested,
  programNote = null,
}: DecisionProps) {
  const trimmedFeedback = feedback.trim();
  return (
    <EmailLayout
      brandName={eventName}
      logoUrl={logoUrl}
      heading={accepted ? `You're speaking at ${eventName}` : "An update on your submission"}
      preview={
        accepted ? `You're speaking at ${eventName}` : `An update on your ${eventName} submission`
      }
    >
      <Text style={paragraph}>Hi {speakerName},</Text>
      <Text style={paragraph}>
        {decisionIntroduction({ accepted, submissionTitle, confirmationRequested })}
      </Text>
      {accepted && programNote !== null ? <Text style={paragraph}>{programNote}</Text> : null}
      {trimmedFeedback.length === 0 ? null : (
        <NoteCard title="Feedback from the review team">{trimmedFeedback}</NoteCard>
      )}
      <Cta href={portalUrl}>
        {accepted && confirmationRequested === true
          ? "Confirm participation"
          : "Open speaker portal"}
      </Cta>
      <Text style={{ ...paragraph, margin: "0" }}>The {eventName} program team</Text>
    </EmailLayout>
  );
}

Decision.PreviewProps = {
  accepted: true,
  eventName: "AI.Engineer Sandbox — NYC 2026",
  speakerName: "Maya",
  submissionTitle: "Evals in Production",
  feedback: "The panel loved the live-debugging section — consider leading with it.",
  portalUrl: "https://app.opensesh.io/portal",
  logoUrl: "https://app.opensesh.io/demo/aie-logo.png",
  confirmationRequested: true,
} satisfies DecisionProps;
