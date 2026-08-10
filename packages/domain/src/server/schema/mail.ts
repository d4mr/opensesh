import { Schema } from "effect";

import { EmailLogEntry } from "./portal";

export const AdminEmail = EmailLogEntry;
export type AdminEmail = typeof AdminEmail.Type;

export const CalendarInviteSummary = Schema.Struct({
  scheduledSpeakers: Schema.Number,
  affectedSpeakers: Schema.Number,
});
export type CalendarInviteSummary = typeof CalendarInviteSummary.Type;

export const MailSendSummary = Schema.Struct({
  attempted: Schema.Number,
  demo: Schema.Number,
  sent: Schema.Number,
  failed: Schema.Number,
});
export type MailSendSummary = typeof MailSendSummary.Type;

export const EventMailRequest = Schema.Struct({ eventId: Schema.String });
export const RetryEmailRequest = Schema.Struct({ eventId: Schema.String, emailId: Schema.String });
export const ReminderRequest = Schema.Struct({
  eventId: Schema.String,
  contactId: Schema.NullOr(Schema.String),
});
