// @jsxRuntime automatic
// @jsxImportSource react
import { Text } from "react-email";

import { Cta, DetailCard, EmailLayout, paragraph } from "../src/components/layout";

export interface DeliverableReminderProps {
  readonly eventName: string;
  readonly speakerName: string;
  readonly requirement: string;
  readonly sessionCode: string;
  readonly due: string;
  readonly portalUrl: string;
  readonly logoUrl?: string | null;
}

export default function DeliverableReminder({
  eventName,
  speakerName,
  requirement,
  sessionCode,
  due,
  portalUrl,
  logoUrl = null,
}: DeliverableReminderProps) {
  return (
    <EmailLayout
      brandName={eventName}
      logoUrl={logoUrl}
      heading={`${requirement} is still due`}
      preview={`Reminder: ${requirement} for ${sessionCode}`}
    >
      <Text style={paragraph}>Hi {speakerName},</Text>
      <Text style={paragraph}>
        A quick reminder that {requirement} is still outstanding for your session.
      </Text>
      <DetailCard title={requirement}>
        {sessionCode} · {due}
      </DetailCard>
      <Cta href={portalUrl}>Upload your file</Cta>
    </EmailLayout>
  );
}

DeliverableReminder.PreviewProps = {
  eventName: "AI.Engineer Sandbox — NYC 2026",
  speakerName: "Maya",
  requirement: "Final slide deck",
  sessionCode: "S-104",
  due: "Due Fri, Sep 18",
  portalUrl: "https://app.opensesh.io/portal",
  logoUrl: "https://app.opensesh.io/demo/aie-logo.png",
} satisfies DeliverableReminderProps;
