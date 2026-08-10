import { Schema, Struct } from "effect";

import { EntityFields, JsonObject, NullableDate, NullableString } from "./common";

export const TargetType = Schema.Literals(["contact", "submission"]);
export const TaskStatus = Schema.Literals(["todo", "done"]);
export type TaskStatus = typeof TaskStatus.Type;
export const EmailType = Schema.Literals([
  "confirmation",
  "magic_link",
  "accepted",
  "declined",
  "task_reminder",
  "calendar_invite",
  "custom",
]);
export const EmailStatus = Schema.Literals(["queued", "sent", "failed"]);
export type EmailStatus = typeof EmailStatus.Type;

export const PortalFormField = Schema.Struct({
  label: Schema.String,
  type: Schema.String,
  required: Schema.Boolean,
  options: Schema.NullOr(Schema.Array(Schema.String)),
  note: NullableString,
});

export const PortalFormSection = Schema.Struct({
  title: Schema.String,
  instructions: Schema.String,
  fields: Schema.Array(PortalFormField),
});

const portalFormFields = {
  eventId: Schema.String,
  name: Schema.String,
  title: Schema.String,
  targetType: TargetType,
  sections: Schema.Array(PortalFormSection),
  confirmationEmailEnabled: Schema.Boolean,
  confirmationEmailBody: NullableString,
};

export const PortalForm = Schema.Struct({ ...EntityFields, ...portalFormFields });
export type PortalForm = typeof PortalForm.Type;
export const PortalFormCreate = Schema.Struct(portalFormFields);
export type PortalFormCreate = typeof PortalFormCreate.Type;
export const PortalFormUpdate = Schema.Struct(Struct.map(portalFormFields, Schema.optionalKey));
export type PortalFormUpdate = typeof PortalFormUpdate.Type;

export const PortalFormResponse = Schema.Struct({
  ...EntityFields,
  formId: Schema.String,
  contactId: Schema.String,
  submissionId: NullableString,
  answers: JsonObject,
  submittedAt: Schema.Date,
});
export type PortalFormResponse = typeof PortalFormResponse.Type;

export const PortalFormResponseCreate = Schema.Struct({
  formId: Schema.String,
  contactId: Schema.String,
  submissionId: NullableString,
  answers: JsonObject,
  submittedAt: Schema.Date,
});
export type PortalFormResponseCreate = typeof PortalFormResponseCreate.Type;

const fileRequestFields = {
  eventId: Schema.String,
  title: Schema.String,
  targetType: TargetType,
  instructions: Schema.String,
};

export const FileRequest = Schema.Struct({ ...EntityFields, ...fileRequestFields });
export type FileRequest = typeof FileRequest.Type;
export const FileRequestCreate = Schema.Struct(fileRequestFields);
export type FileRequestCreate = typeof FileRequestCreate.Type;
export const FileRequestUpdate = Schema.Struct(Struct.map(fileRequestFields, Schema.optionalKey));
export type FileRequestUpdate = typeof FileRequestUpdate.Type;

const fileUploadFields = {
  fileRequestId: Schema.String,
  contactId: Schema.String,
  submissionId: NullableString,
  filename: Schema.String,
  url: Schema.String,
  size: Schema.Number,
  uploadedAt: Schema.Date,
};

export const FileUpload = Schema.Struct({ ...EntityFields, ...fileUploadFields });
export type FileUpload = typeof FileUpload.Type;
export const FileUploadCreate = Schema.Struct(fileUploadFields);
export type FileUploadCreate = typeof FileUploadCreate.Type;

const taskTemplateFields = {
  eventId: Schema.String,
  title: Schema.String,
  instructions: Schema.String,
  scope: TargetType,
  portalFormId: NullableString,
  fileRequestId: NullableString,
  autoAssignOnAccept: Schema.Boolean,
  dueDate: NullableDate,
  position: Schema.Number,
};

export const TaskTemplate = Schema.Struct({ ...EntityFields, ...taskTemplateFields });
export type TaskTemplate = typeof TaskTemplate.Type;
export const TaskTemplateCreate = Schema.Struct(taskTemplateFields);
export type TaskTemplateCreate = typeof TaskTemplateCreate.Type;
export const TaskTemplateUpdate = Schema.Struct(Struct.map(taskTemplateFields, Schema.optionalKey));
export type TaskTemplateUpdate = typeof TaskTemplateUpdate.Type;

export const TaskAssignment = Schema.Struct({
  ...EntityFields,
  taskTemplateId: Schema.String,
  contactId: NullableString,
  submissionId: NullableString,
  status: TaskStatus,
  completedAt: NullableDate,
});
export type TaskAssignment = typeof TaskAssignment.Type;

export const TaskAssignmentCreate = Schema.Struct({
  taskTemplateId: Schema.String,
  contactId: NullableString,
  submissionId: NullableString,
  status: TaskStatus,
  completedAt: NullableDate,
});
export type TaskAssignmentCreate = typeof TaskAssignmentCreate.Type;

const emailLogFields = {
  eventId: Schema.String,
  contactId: NullableString,
  submissionId: NullableString,
  type: EmailType,
  subject: Schema.String,
  body: Schema.String,
  icsAttached: Schema.Boolean,
  status: EmailStatus,
  sentAt: NullableDate,
};

export const EmailLogEntry = Schema.Struct({ ...EntityFields, ...emailLogFields });
export type EmailLogEntry = typeof EmailLogEntry.Type;
export const EmailLogCreate = Schema.Struct(emailLogFields);
export type EmailLogCreate = typeof EmailLogCreate.Type;
