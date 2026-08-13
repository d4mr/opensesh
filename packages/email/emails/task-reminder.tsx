// @jsxRuntime automatic
// @jsxImportSource react
import { Text } from "react-email";

import { Cta, EmailLayout, palette, paragraph } from "../src/components/layout";

export interface TaskReminderProps {
  readonly eventName: string;
  readonly speakerName: string;
  readonly tasks: ReadonlyArray<string>;
  readonly portalUrl: string;
  readonly logoUrl?: string | null;
}

export default function TaskReminder({
  eventName,
  speakerName,
  tasks,
  portalUrl,
  logoUrl = null,
}: TaskReminderProps) {
  return (
    <EmailLayout
      brandName={eventName}
      logoUrl={logoUrl}
      heading={`${tasks.length} outstanding ${tasks.length === 1 ? "task" : "tasks"}`}
      preview={`${tasks.length} outstanding ${tasks.length === 1 ? "task" : "tasks"} for ${eventName}`}
    >
      <Text style={paragraph}>Hi {speakerName},</Text>
      <Text style={paragraph}>
        A quick reminder that these speaker tasks are still open for {eventName}:
      </Text>
      <ul style={{ margin: "0 0 8px", paddingLeft: "20px" }}>
        {tasks.map((task) => (
          <li
            key={task}
            style={{
              margin: "0 0 8px",
              fontSize: "14px",
              lineHeight: "22px",
              color: palette.body,
            }}
          >
            {task}
          </li>
        ))}
      </ul>
      <Cta href={portalUrl}>Complete your tasks</Cta>
    </EmailLayout>
  );
}

TaskReminder.PreviewProps = {
  eventName: "AI.Engineer Sandbox — NYC 2026",
  speakerName: "Jamal",
  tasks: ["Upload your headshot", "Confirm your AV requirements", "Add your bio"],
  portalUrl: "https://app.opensesh.io/portal",
  logoUrl: "https://app.opensesh.io/demo/aie-logo.png",
} satisfies TaskReminderProps;
