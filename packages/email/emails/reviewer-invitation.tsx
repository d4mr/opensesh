// @jsxRuntime automatic
// @jsxImportSource react
import { Text } from "react-email";

import { Cta, DetailCard, EmailLayout, paragraph } from "../src/components/layout";

export interface ReviewerInvitationProps {
  readonly eventName: string;
  readonly reviewerName: string;
  readonly roundName: string;
  readonly accessUrl: string;
  readonly logoUrl?: string | null;
}

export default function ReviewerInvitation({
  eventName,
  reviewerName,
  roundName,
  accessUrl,
  logoUrl = null,
}: ReviewerInvitationProps) {
  return (
    <EmailLayout
      brandName={eventName}
      logoUrl={logoUrl}
      heading="You're on the review team"
      preview={`Review access for ${eventName}`}
    >
      <Text style={paragraph}>Hi {reviewerName},</Text>
      <Text style={paragraph}>
        You have been added to the reviewer pool for {eventName}. Sign in with this email address to
        see your assignments.
      </Text>
      <DetailCard title={roundName}>{eventName}</DetailCard>
      <Cta href={accessUrl}>Start reviewing</Cta>
    </EmailLayout>
  );
}

ReviewerInvitation.PreviewProps = {
  eventName: "AI.Engineer Sandbox — NYC 2026",
  reviewerName: "Rey",
  roundName: "Initial Review",
  accessUrl: "https://app.opensesh.io/login?email=rey%40example.com",
  logoUrl: "https://app.opensesh.io/demo/aie-logo.png",
} satisfies ReviewerInvitationProps;
