// @jsxRuntime automatic
// @jsxImportSource react
import { Text } from "react-email";

import { Cta, DetailCard, EmailLayout, paragraph } from "../src/components/layout";

export interface ReviewReminderProps {
  readonly eventName: string;
  readonly reviewerName: string;
  readonly roundName: string;
  readonly pending: number;
  /** Round close, pre-formatted in the event's timezone. */
  readonly deadline: string;
  readonly reviewUrl: string;
  readonly logoUrl?: string | null;
}

export default function ReviewReminder({
  eventName,
  reviewerName,
  roundName,
  pending,
  deadline,
  reviewUrl,
  logoUrl = null,
}: ReviewReminderProps) {
  return (
    <EmailLayout
      brandName={eventName}
      logoUrl={logoUrl}
      heading={`${pending} pending ${pending === 1 ? "review" : "reviews"}`}
      preview={`${pending} pending ${pending === 1 ? "review" : "reviews"} in ${roundName}`}
    >
      <Text style={paragraph}>Hi {reviewerName},</Text>
      <Text style={paragraph}>
        A quick reminder that {pending === 1 ? "a review is" : "reviews are"} still waiting for you
        in {roundName} for {eventName}.
      </Text>
      <DetailCard title={roundName}>
        {pending} pending {pending === 1 ? "review" : "reviews"} · closes {deadline}
      </DetailCard>
      <Cta href={reviewUrl}>Review submissions</Cta>
    </EmailLayout>
  );
}

ReviewReminder.PreviewProps = {
  eventName: "AI.Engineer Sandbox — NYC 2026",
  reviewerName: "Sam",
  roundName: "Initial Review",
  pending: 2,
  deadline: "Oct 15, 2026, 12:50 AM",
  reviewUrl: "https://app.opensesh.io/admin/evaluation",
  logoUrl: "https://app.opensesh.io/demo/aie-logo.png",
} satisfies ReviewReminderProps;
