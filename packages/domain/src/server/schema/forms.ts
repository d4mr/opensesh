import { Schema, Struct } from "effect";

import {
  EntityFields,
  Heading15,
  NullableDate,
  NullableNumber,
  NullableString,
  Text255,
} from "./common";

export const FormKind = Schema.Literals(["abstract", "session"]);
export const FormStatus = Schema.Literals(["open", "closed"]);
export const FormSection = Schema.Literals(["abstract", "participant"]);
export const FormFieldType = Schema.Literals([
  "text",
  "richtext",
  "email",
  "phone",
  "dropdown",
  "checkbox",
  "file",
]);

export const FormSectionSettings = Schema.Struct({
  title: Schema.String,
  heading: Schema.String,
  instructions: Schema.String,
});

export const ParticipantRole = Schema.Struct({
  role: Schema.String,
  enabled: Schema.Boolean,
  min: Schema.Number,
  max: Schema.Number,
});

const formFields = {
  eventId: Schema.String,
  internalName: Text255,
  externalTitle: Text255,
  kind: FormKind,
  collectParticipants: Schema.Boolean,
  status: FormStatus,
  welcomeHeading: Heading15,
  welcomeMessage: Schema.String,
  showWelcome: Schema.Boolean,
  abstractSection: FormSectionSettings,
  participantSection: FormSectionSettings,
  participantRoles: Schema.Array(ParticipantRole),
  closeDate: NullableDate,
  submissionLimit: NullableNumber,
  allowMultipleDrafts: Schema.Boolean,
  successMessage: Schema.String,
  autoRedirectPortal: Schema.Boolean,
  confirmationEmailEnabled: Schema.Boolean,
  confirmationEmailBody: Schema.String,
  adminAlertUserIds: Schema.Array(Schema.String),
};

export const Form = Schema.Struct({ ...EntityFields, ...formFields });
export type Form = typeof Form.Type;
export const FormCreate = Schema.Struct(formFields);
export type FormCreate = typeof FormCreate.Type;
export const FormUpdate = Schema.Struct(Struct.map(formFields, Schema.optionalKey));
export type FormUpdate = typeof FormUpdate.Type;

const formFieldFields = {
  formId: Schema.String,
  section: FormSection,
  label: Schema.String,
  fieldType: FormFieldType,
  maxChars: NullableNumber,
  required: Schema.Boolean,
  locked: Schema.Boolean,
  position: Schema.Number,
  options: Schema.NullOr(Schema.Json),
  mapsTo: NullableString,
  condition: Schema.NullOr(Schema.Json),
};

export const FormField = Schema.Struct({ ...EntityFields, ...formFieldFields });
export type FormField = typeof FormField.Type;
export const FormFieldCreate = Schema.Struct(formFieldFields);
export type FormFieldCreate = typeof FormFieldCreate.Type;
export const FormFieldReplacement = Schema.Struct(Struct.omit(formFieldFields, ["formId"]));
export type FormFieldReplacement = typeof FormFieldReplacement.Type;
