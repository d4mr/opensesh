// @jsxRuntime automatic
// @jsxImportSource react
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import CalendarInvite, { sessionTime, type CalendarInviteProps } from "../emails/calendar-invite";
import Cancelled, { cancellationIntroduction, type CancelledProps } from "../emails/cancelled";
import Confirmation, { type ConfirmationProps } from "../emails/confirmation";
import Decision, { decisionIntroduction, type DecisionProps } from "../emails/decision";
import DeliverableReminder, { type DeliverableReminderProps } from "../emails/deliverable-reminder";
import MagicLink from "../emails/magic-link";
import OrganizationInvitation, { roleLabel } from "../emails/organization-invitation";
import Reinstated, { reinstatementIntroduction, type ReinstatedProps } from "../emails/reinstated";
import TaskReminder, { type TaskReminderProps } from "../emails/task-reminder";

export interface RenderedEmail {
  readonly subject: string;
  readonly html: string;
  readonly text: string;
}

// The templates are static markup — no Suspense, no client components — so the
// legacy sync renderer is exactly right and keeps every caller synchronous.
const html = (element: ReactElement) => `<!doctype html>${renderToStaticMarkup(element)}`;

export const confirmation = (
  input: Omit<ConfirmationProps, "customBodyHtml"> & {
    /** Organizer-authored markdown, pre-rendered by the caller. */
    readonly customBody?: { readonly html: string; readonly text: string };
  },
): RenderedEmail => ({
  subject: `We received “${input.submissionTitle}”`,
  text: `${input.customBody?.text ?? `Thanks, ${input.name}. Your submission “${input.submissionTitle}” is in the review queue.`}\n\nView your submission: ${input.portalUrl}`,
  html: html(<Confirmation {...input} customBodyHtml={input.customBody?.html} />),
});

export const magicLink = (input: { readonly url: string }): RenderedEmail => ({
  subject: "Sign in to opensesh",
  text: `Use this secure link to sign in to opensesh: ${input.url}`,
  html: html(<MagicLink url={input.url} />),
});

export const organizationInvitation = (input: {
  readonly organizationName: string;
  readonly inviterName: string;
  readonly role: string;
  readonly url: string;
}): RenderedEmail => ({
  subject: `Join ${input.organizationName} on opensesh`,
  text: `${input.inviterName} invited you to join ${input.organizationName} as ${roleLabel(input.role)}. Accept the invitation: ${input.url}`,
  html: html(<OrganizationInvitation {...input} />),
});

const decision = (input: DecisionProps): RenderedEmail => {
  const feedback = input.feedback.trim();
  return {
    subject: input.accepted
      ? `You're speaking at ${input.eventName}`
      : `An update on your ${input.eventName} submission`,
    text: `Hi ${input.speakerName},\n\n${decisionIntroduction(input)}${feedback.length === 0 ? "" : `\n\nFeedback from the review team:\n${feedback}`}\n\nSpeaker portal: ${input.portalUrl}\n\nThe OpenSesh program team`,
    html: html(<Decision {...input} />),
  };
};

export const accepted = (input: Omit<DecisionProps, "accepted">) =>
  decision({ ...input, accepted: true });

export const declined = (input: Omit<DecisionProps, "accepted">) =>
  decision({ ...input, accepted: false });

export const cancelled = (input: CancelledProps): RenderedEmail => {
  const message = input.message.trim();
  return {
    subject: `Your ${input.eventName} session has been cancelled`,
    text: `Hi ${input.speakerName},\n\n${cancellationIntroduction(input)}${message.length === 0 ? "" : `\n\nA note from the program team:\n${message}`}\n\nSpeaker portal: ${input.portalUrl}\n\nThe OpenSesh program team`,
    html: html(<Cancelled {...input} />),
  };
};

export const reinstated = (input: ReinstatedProps): RenderedEmail => {
  const message = input.message.trim();
  return {
    subject: `Your ${input.eventName} session is back on`,
    text: `Hi ${input.speakerName},\n\n${reinstatementIntroduction(input)}${message.length === 0 ? "" : `\n\nA note from the program team:\n${message}`}\n\nSpeaker portal: ${input.portalUrl}\n\nThe OpenSesh program team`,
    html: html(<Reinstated {...input} />),
  };
};

export const taskReminder = (input: TaskReminderProps): RenderedEmail => ({
  subject: `${input.tasks.length} outstanding ${input.tasks.length === 1 ? "task" : "tasks"} for ${input.eventName}`,
  text: `Hi ${input.speakerName},\n\nA quick reminder that these speaker tasks are outstanding:\n${input.tasks.map((task) => `- ${task}`).join("\n")}\n\nComplete your tasks: ${input.portalUrl}`,
  html: html(<TaskReminder {...input} />),
});

export const deliverableReminder = (input: DeliverableReminderProps): RenderedEmail => ({
  subject: `Reminder: ${input.requirement} for ${input.sessionCode}`,
  text: `Hi ${input.speakerName},\n\nA quick reminder that ${input.requirement} is still outstanding for ${input.sessionCode}.\n\n${input.requirement} · ${input.sessionCode} · ${input.due}\n\nUpload your file: ${input.portalUrl}`,
  html: html(<DeliverableReminder {...input} />),
});

export const calendarInvite = (input: CalendarInviteProps): RenderedEmail => ({
  subject: `Calendar invite: ${input.sessionTitle}`,
  text: `Hi ${input.speakerName},\n\nYour session is scheduled.\n\n${input.sessionTitle}\n${sessionTime(input)}\n${input.room}\n\nAdd the attached invitation to your calendar. Session details: ${input.portalUrl}`,
  html: html(<CalendarInvite {...input} />),
});
