import { Schema, Struct } from "effect";

import { EntityFields, JsonObject, NullableDate, NullableNumber, NullableString } from "./common";
import { FormFieldDefinition } from "./forms";
import { DietaryRequirement, Submission, SubmissionEditHistory, TshirtSize } from "./submissions";

export const TargetType = Schema.Literals(["contact", "submission"]);
export const TaskStatus = Schema.Literals(["todo", "done", "waived"]);
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
export const EmailStatus = Schema.Literals(["queued", "demo", "sent", "failed"]);
export type EmailStatus = typeof EmailStatus.Type;

export const PortalFormSection = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  instructions: Schema.String,
  fields: Schema.Array(FormFieldDefinition),
});
export type PortalFormSection = typeof PortalFormSection.Type;

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

export const FileKind = Schema.Literals(["request", "headshot", "slides"]);

const sessionFileRequirementFields = {
  eventId: Schema.String,
  title: Schema.String,
  description: Schema.String,
  dueAt: NullableDate,
  acceptTypes: NullableString,
  maxSizeMb: NullableNumber,
  position: Schema.Number,
};

export const SessionFileRequirement = Schema.Struct({
  ...EntityFields,
  ...sessionFileRequirementFields,
});
export type SessionFileRequirement = typeof SessionFileRequirement.Type;

const fileUploadFields = {
  fileRequestId: NullableString,
  requirementId: NullableString,
  kind: FileKind,
  contactId: Schema.String,
  submissionId: NullableString,
  speakerLastReadAt: NullableDate,
  adminLastReadAt: NullableDate,
};

export const FileUpload = Schema.Struct({ ...EntityFields, ...fileUploadFields });
export type FileUpload = typeof FileUpload.Type;
export const FileUploadCreate = Schema.Struct(fileUploadFields);
export type FileUploadCreate = typeof FileUploadCreate.Type;

export const FileVersion = Schema.Struct({
  ...EntityFields,
  fileUploadId: Schema.String,
  storageKey: Schema.String,
  filename: Schema.String,
  contentType: Schema.String,
  size: Schema.Number,
  uploaderContactId: NullableString,
  uploaderEventMemberId: NullableString,
  uploaderName: Schema.String,
  uploadedAt: Schema.Date,
});
export type FileVersion = typeof FileVersion.Type;

export const FileComment = Schema.Struct({
  ...EntityFields,
  fileUploadId: Schema.String,
  authorContactId: NullableString,
  authorEventMemberId: NullableString,
  authorName: Schema.String,
  body: Schema.String,
});
export type FileComment = typeof FileComment.Type;

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
  recipient: Schema.String,
  subject: Schema.String,
  body: Schema.String,
  htmlBody: Schema.String,
  icsAttached: Schema.Boolean,
  icsContent: NullableString,
  icsSequence: NullableNumber,
  status: EmailStatus,
  provider: NullableString,
  providerId: NullableString,
  error: NullableString,
  sentAt: NullableDate,
};

export const EmailLogEntry = Schema.Struct({ ...EntityFields, ...emailLogFields });
export type EmailLogEntry = typeof EmailLogEntry.Type;
export const EmailLogCreate = Schema.Struct(emailLogFields);
export type EmailLogCreate = typeof EmailLogCreate.Type;

export const PortalSection = Schema.Literals(["submissions", "profile", "tasks"]);
export const PortalSubmissionRequest = Schema.Struct({ submissionId: Schema.String });
export const PortalSubmissionEditRequest = Schema.Struct({
  submissionId: Schema.String,
  answers: JsonObject,
});
export const PortalProfileUpdateRequest = Schema.Struct({
  firstName: Schema.optionalKey(Schema.String),
  lastName: Schema.optionalKey(Schema.String),
  salutation: Schema.optionalKey(NullableString),
  honorific: Schema.optionalKey(NullableString),
  pronouns: Schema.optionalKey(NullableString),
  gender: Schema.optionalKey(NullableString),
  bio: Schema.optionalKey(NullableString),
  linkedinUrl: Schema.optionalKey(NullableString),
  twitterUrl: Schema.optionalKey(NullableString),
  facebookUrl: Schema.optionalKey(NullableString),
  websiteUrl: Schema.optionalKey(NullableString),
  dietaryRequirements: Schema.optionalKey(DietaryRequirement),
  tshirtSize: Schema.optionalKey(Schema.NullOr(TshirtSize)),
});
export const TaskAssignmentRequest = Schema.Struct({ assignmentId: Schema.String });
export const PortalFormResponseRequest = Schema.Struct({
  assignmentId: Schema.String,
  answers: JsonObject,
});
export const FileUploadRequest = Schema.Struct({
  assignmentId: Schema.NullOr(Schema.String),
  fileRequestId: Schema.NullOr(Schema.String),
  requirementId: Schema.NullOr(Schema.String),
  submissionId: Schema.NullOr(Schema.String),
  kind: FileKind,
  filename: Schema.String,
  contentType: Schema.String,
  size: Schema.Number,
  base64: Schema.String,
});
export const FileVersionRequest = Schema.Struct({ versionId: Schema.String });
export const FileCommentRequest = Schema.Struct({
  fileUploadId: Schema.String,
  body: Schema.String,
});

export const TaskTemplateMutationRequest = Schema.Struct({
  eventId: Schema.String,
  id: Schema.NullOr(Schema.String),
  title: Schema.String,
  instructions: Schema.String,
  scope: TargetType,
  portalFormId: NullableString,
  fileRequestId: NullableString,
  autoAssignOnAccept: Schema.Boolean,
  dueDate: NullableString,
});
export const AdminAssignmentRequest = Schema.Struct({ assignmentId: Schema.String });
export const ManualAssignRequest = Schema.Struct({
  eventId: Schema.String,
  taskTemplateId: Schema.String,
  contactId: NullableString,
  submissionId: NullableString,
});
export const PortalFormMutationRequest = Schema.Struct({
  eventId: Schema.String,
  id: Schema.NullOr(Schema.String),
  name: Schema.String,
  title: Schema.String,
  targetType: TargetType,
  sections: Schema.Array(PortalFormSection),
  confirmationEmailEnabled: Schema.Boolean,
  confirmationEmailBody: NullableString,
});
export const FileRequestMutationRequest = Schema.Struct({
  eventId: Schema.String,
  title: Schema.String,
  targetType: TargetType,
  instructions: Schema.String,
});
export const SessionFileRequirementMutationRequest = Schema.Struct({
  eventId: Schema.String,
  id: Schema.NullOr(Schema.String),
  title: Schema.String,
  description: Schema.String,
  dueAt: NullableString,
  acceptTypes: NullableString,
  maxSizeMb: NullableNumber,
});
export const ContentReviewRequest = Schema.Struct({ historyId: Schema.String });
export const RestoreHistoryRequest = Schema.Struct({ historyId: Schema.String });
export const AdminSessionContentRequest = Schema.Struct({
  eventId: Schema.String,
  submissionId: Schema.String,
  title: Schema.String,
  description: Schema.String,
});
export const AdminSpeakerProfileRequest = Schema.Struct({
  eventId: Schema.String,
  contactId: Schema.String,
  bio: Schema.String,
});
export const AdminHeadshotUploadRequest = Schema.Struct({
  eventId: Schema.String,
  contactId: Schema.String,
  filename: Schema.String,
  contentType: Schema.String,
  size: Schema.Number,
  base64: Schema.String,
});
export const AdminFilesExportRequest = Schema.Struct({
  eventId: Schema.String,
  uploadIds: Schema.Array(Schema.String),
  grouping: Schema.Literals(["session", "speaker"]),
});

export const PortalSubmissionDetail = Schema.Struct({
  submission: Submission,
  history: Schema.Array(SubmissionEditHistory),
  fields: Schema.Array(FormFieldDefinition),
  answers: JsonObject,
});
