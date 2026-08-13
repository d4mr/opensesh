// @jsxRuntime automatic
// @jsxImportSource react
import { Text } from "react-email";

import { Cta, DetailCard, EmailLayout, paragraph } from "../src/components/layout";

export interface CalendarInviteProps {
  readonly eventName: string;
  readonly speakerName: string;
  readonly sessionTitle: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
  readonly room: string;
  readonly portalUrl: string;
  readonly logoUrl?: string | null;
}

export const sessionTime = ({
  startsAt,
  endsAt,
  timezone,
}: Pick<CalendarInviteProps, "startsAt" | "endsAt" | "timezone">) => {
  const date = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: timezone,
  }).format(startsAt);
  const end = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: timezone,
  }).format(endsAt);
  return `${date}–${end} (${timezone})`;
};

export default function CalendarInvite({
  eventName,
  speakerName,
  sessionTitle,
  startsAt,
  endsAt,
  timezone,
  room,
  portalUrl,
  logoUrl = null,
}: CalendarInviteProps) {
  return (
    <EmailLayout
      brandName={eventName}
      logoUrl={logoUrl}
      heading="Your session is scheduled"
      preview={`Calendar invite: ${sessionTitle}`}
    >
      <Text style={paragraph}>Hi {speakerName},</Text>
      <DetailCard title={sessionTitle}>
        {sessionTime({ startsAt, endsAt, timezone })}
        <br />
        {room}
      </DetailCard>
      <Text style={paragraph}>Add the attached invitation to your calendar.</Text>
      <Cta href={portalUrl}>View session details</Cta>
    </EmailLayout>
  );
}

CalendarInvite.PreviewProps = {
  eventName: "AI.Engineer Sandbox — NYC 2026",
  speakerName: "Maya",
  sessionTitle: "Evals in Production",
  startsAt: new Date("2026-09-18T14:00:00Z"),
  endsAt: new Date("2026-09-18T14:45:00Z"),
  timezone: "America/New_York",
  room: "Main Stage",
  portalUrl: "https://app.opensesh.io/portal",
  logoUrl: "https://app.opensesh.io/demo/aie-logo.png",
} satisfies CalendarInviteProps;
