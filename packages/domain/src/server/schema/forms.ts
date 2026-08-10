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
export type FormKind = typeof FormKind.Type;
export const FormStatus = Schema.Literals(["open", "closed"]);
export type FormStatus = typeof FormStatus.Type;
export const FormSection = Schema.Literals(["abstract", "participant"]);
export type FormSection = typeof FormSection.Type;
export const FormFieldType = Schema.Literals([
  "text",
  "textarea",
  "richtext",
  "email",
  "phone",
  "dropdown",
  "checkbox",
  "file",
]);
export type FormFieldType = typeof FormFieldType.Type;

export const FormSectionSettings = Schema.Struct({
  title: Schema.String,
  heading: Schema.String,
  instructions: Schema.String,
});
export type FormSectionSettings = typeof FormSectionSettings.Type;

export const ParticipantRole = Schema.Struct({
  role: Schema.String,
  enabled: Schema.Boolean,
  min: Schema.Number,
  max: Schema.Number,
});

export const FormLibraryBinding = Schema.Literals(["format", "track", "tags", "level"]);
export type FormLibraryBinding = typeof FormLibraryBinding.Type;

export const FormFieldOptions = Schema.NullOr(
  Schema.Union([
    Schema.Struct({ bind: FormLibraryBinding }),
    Schema.Struct({ custom: Schema.Array(Schema.String) }),
  ]),
);
export type FormFieldOptions = typeof FormFieldOptions.Type;

export const FormFieldCondition = Schema.NullOr(
  Schema.Struct({
    fieldId: Schema.String,
    operator: Schema.Literals(["equals", "is_one_of"]),
    values: Schema.Array(Schema.String),
  }),
);
export type FormFieldCondition = typeof FormFieldCondition.Type;

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
  options: FormFieldOptions,
  mapsTo: NullableString,
  condition: FormFieldCondition,
};

export const FormField = Schema.Struct({ ...EntityFields, ...formFieldFields });
export type FormField = typeof FormField.Type;
export const FormFieldCreate = Schema.Struct(formFieldFields);
export type FormFieldCreate = typeof FormFieldCreate.Type;
export const FormFieldReplacement = Schema.Struct({
  id: Schema.optionalKey(Schema.String),
  ...Struct.omit(formFieldFields, ["formId"]),
});
export type FormFieldReplacement = typeof FormFieldReplacement.Type;

export const FormSummary = Schema.Struct({
  ...EntityFields,
  ...formFields,
  submissions: Schema.Number,
  drafts: Schema.Number,
});
export type FormSummary = typeof FormSummary.Type;

export const FormAnswers = Schema.Record(Schema.String, Schema.Json);
export type FormAnswers = typeof FormAnswers.Type;
export const FormRendererAnswers = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, Schema.Array(Schema.String)]),
);
export type FormRendererAnswers = typeof FormRendererAnswers.Type;

export const ParticipantAnswers = Schema.Struct({
  role: Schema.String,
  answers: FormAnswers,
});
export type ParticipantAnswers = typeof ParticipantAnswers.Type;

const cfpBaseFields = {
  eventSlug: Schema.String,
  formId: Schema.String,
  email: Schema.String,
  answers: FormAnswers,
  participants: Schema.Array(ParticipantAnswers),
};

export const CfpDraftInput = Schema.Struct({
  ...cfpBaseFields,
  submissionId: Schema.NullOr(Schema.String),
});
export type CfpDraftInput = typeof CfpDraftInput.Type;

export const CfpSubmitInput = Schema.Struct({
  ...cfpBaseFields,
  submissionId: Schema.String,
});
export type CfpSubmitInput = typeof CfpSubmitInput.Type;

const cfpClientFields = {
  eventSlug: Schema.String,
  formId: Schema.String,
  answers: FormAnswers,
  participants: Schema.Array(ParticipantAnswers),
};

export const CfpClientDraftInput = Schema.Struct({
  ...cfpClientFields,
  submissionId: Schema.NullOr(Schema.String),
});
export const CfpClientSubmitInput = Schema.Struct({
  ...cfpClientFields,
  submissionId: Schema.String,
});
const publicFormRequestFields = { eventSlug: Schema.String, formId: Schema.String };
export const PublicFormRequest = Schema.Struct(publicFormRequestFields);
export const PublicDraftRequest = Schema.Struct({
  ...publicFormRequestFields,
  submissionId: Schema.String,
});

export const FormSaveRequest = Schema.Struct({
  eventId: Schema.String,
  formId: Schema.String,
  form: FormUpdate,
  fields: Schema.Array(FormFieldReplacement),
});

export const FormIdRequest = Schema.Struct({
  eventId: Schema.String,
  formId: Schema.String,
});

const answerValues = (value: Schema.Json | undefined): ReadonlyArray<string> => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "boolean") return value ? ["true"] : [];
  return [];
};

export const isFormFieldVisible = (field: FormField, answers: FormAnswers) => {
  if (field.condition === null) return true;
  const current = answerValues(answers[field.condition.fieldId]);
  return field.condition.operator === "equals"
    ? current[0] === field.condition.values[0]
    : current.some((value) => field.condition?.values.includes(value) === true);
};

export const makeFormAnswersSchema = (fields: ReadonlyArray<FormField>) =>
  FormRendererAnswers.check(
    Schema.makeFilter((answers) => {
      const issues: Array<Schema.FilterIssue> = [];
      for (const field of fields) {
        if (!isFormFieldVisible(field, answers)) continue;
        const value = answers[field.id];
        const values = answerValues(value);
        if (field.required && values.every((answer) => answer.trim().length === 0)) {
          issues.push({ path: [field.id], issue: `${field.label} is required` });
          continue;
        }
        if (field.maxChars !== null && typeof value === "string" && value.length > field.maxChars) {
          issues.push({
            path: [field.id],
            issue: `${field.label} must be ${field.maxChars} characters or fewer`,
          });
        }
        if (
          field.fieldType === "email" &&
          values[0] !== undefined &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values[0])
        ) {
          issues.push({ path: [field.id], issue: `${field.label} must be a valid email` });
        }
      }
      return issues;
    }),
  );
