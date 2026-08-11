import { Effect, Schema } from "effect";

import { InvalidInput } from "./errors";
import { confirmation } from "./mail/templates";
import { Contacts } from "./repos/contacts";
import { EmailLog } from "./repos/email-log";
import { ReadModels } from "./repos/read-models";
import { Submissions } from "./repos/submissions";
import type { ContactCreate, ContactUpdate, Submission } from "./schema/submissions";
import {
  type CfpDraftInput,
  type CfpSubmitInput,
  type FormAnswers,
  type FormField,
  makeFormAnswersSchema,
  type ParticipantAnswers,
  type ParticipantRole,
} from "./schema/forms";

const stringAnswer = (answers: FormAnswers, field: FormField | undefined) => {
  if (field === undefined) return "";
  const value = answers[field.id];
  return typeof value === "string" ? value : "";
};

const stringArrayAnswer = (answers: FormAnswers, field: FormField | undefined) => {
  if (field === undefined) return [];
  const value = answers[field.id];
  if (typeof value === "string") return value.length === 0 ? [] : [value];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
};

const nullableStringAnswer = (answers: FormAnswers, field: FormField | undefined) => {
  const value = stringAnswer(answers, field);
  return value.length === 0 ? null : value;
};

const normalizeParticipants = (
  participants: ReadonlyArray<ParticipantAnswers>,
  roles: ReadonlyArray<ParticipantRole>,
) => {
  const enabled = roles.filter((role) => role.enabled);
  const fallback = enabled[0]?.role;
  return participants.map((participant) => ({
    ...participant,
    role:
      enabled.some((role) => role.role === participant.role) || fallback === undefined
        ? participant.role
        : fallback,
  }));
};

const customAnswers = (answers: FormAnswers, fields: ReadonlyArray<FormField>) => {
  const custom: Record<string, Schema.Json> = {};
  for (const field of fields) {
    if (field.mapsTo !== null) continue;
    const value = answers[field.id];
    if (value !== undefined) custom[field.id] = value;
  }
  return custom;
};

const contactInput = (
  eventId: string,
  email: string,
  answers: FormAnswers,
  fields: ReadonlyArray<FormField>,
): ContactCreate => ({
  eventId,
  email,
  firstName: stringAnswer(
    answers,
    fields.find((field) => field.mapsTo === "first_name"),
  ),
  lastName: stringAnswer(
    answers,
    fields.find((field) => field.mapsTo === "last_name"),
  ),
  title: null,
  company: null,
  salutation: null,
  honorific: null,
  pronouns: null,
  gender: null,
  bio: nullableStringAnswer(
    answers,
    fields.find((field) => field.mapsTo === "bio"),
  ),
  headshotUrl: null,
  headshotKey: null,
  dietaryRequirements: "none",
  tshirtSize: null,
  phone: nullableStringAnswer(
    answers,
    fields.find((field) => field.mapsTo === "phone"),
  ),
  linkedinUrl: null,
  twitterUrl: null,
  facebookUrl: null,
  websiteUrl: null,
  confirmedAt: null,
  custom: customAnswers(answers, fields),
  approvedProfile: {},
  profileReviewStatus: "approved",
  workflowStatus: "invited",
});

const contactUpdate = (input: ContactCreate): ContactUpdate => ({
  firstName: input.firstName,
  lastName: input.lastName,
  bio: input.bio,
  phone: input.phone,
  custom: input.custom,
});

export const loadCfpForm = Effect.fn("loadCfpForm")(function* (eventSlug: string, formId: string) {
  const reads = yield* ReadModels;
  return yield* reads.publicForm(eventSlug, formId);
});

const upsertContact = Effect.fn("upsertCfpContact")(function* (input: ContactCreate) {
  const contacts = yield* Contacts;
  return yield* contacts.findByEmail(input.eventId, input.email).pipe(
    Effect.flatMap((contact) => contacts.update(contact.id, contactUpdate(input))),
    Effect.catchTag("NotFound", () => contacts.create(input)),
  );
});

const upsertParticipants = Effect.fn("upsertCfpParticipants")(function* (
  eventId: string,
  submissionId: string,
  participants: ReadonlyArray<ParticipantAnswers>,
  fields: ReadonlyArray<FormField>,
  roles: ReadonlyArray<ParticipantRole>,
) {
  const submissions = yield* Submissions;
  const links = [];
  const roleCounts = new Map<string, number>();
  for (const [position, participant] of participants.entries()) {
    const role = roles.find((item) => item.enabled && item.role === participant.role);
    const rolePosition = roleCounts.get(participant.role) ?? 0;
    roleCounts.set(participant.role, rolePosition + 1);
    const email = stringAnswer(
      participant.answers,
      fields.find((field) => field.mapsTo === "email"),
    );
    if (email.length === 0) {
      if (role !== undefined && rolePosition < role.min) {
        return yield* Effect.fail(
          new InvalidInput({ message: `${participant.role} needs an email address` }),
        );
      }
      continue;
    }
    const contact = yield* upsertContact(contactInput(eventId, email, participant.answers, fields));
    links.push({ contactId: contact.id, role: participant.role, position });
  }
  return yield* submissions.replaceParticipants(submissionId, links);
});

export const saveCfpDraft = Effect.fn("saveCfpDraft")(function* (input: CfpDraftInput) {
  const contacts = yield* Contacts;
  const submissions = yield* Submissions;
  const bundle = yield* loadCfpForm(input.eventSlug, input.formId);
  const abstractFields = bundle.fields.filter((field) => field.section === "abstract");
  const participantFields = bundle.fields.filter((field) => field.section === "participant");
  const participants = normalizeParticipants(input.participants, bundle.form.participantRoles);
  const submitter = yield* contacts
    .findByEmail(bundle.event.id, input.email)
    .pipe(
      Effect.catchTag("NotFound", () =>
        contacts.create(contactInput(bundle.event.id, input.email, {}, participantFields)),
      ),
    );
  const titleField = abstractFields.find((field) => field.mapsTo === "title");
  const descriptionField = abstractFields.find((field) => field.mapsTo === "description");
  const formatField = abstractFields.find((field) => field.mapsTo === "format_id");
  const levelField = abstractFields.find((field) => field.mapsTo === "level_id");
  const trackField = abstractFields.find((field) => field.mapsTo === "tracks");
  const tagField = abstractFields.find((field) => field.mapsTo === "tags");
  const draft = yield* submissions.saveDraft(
    {
      eventId: bundle.event.id,
      kind: bundle.form.kind,
      status: "draft",
      sourceFormId: bundle.form.id,
      submitterContactId: submitter.id,
      title: stringAnswer(input.answers, titleField),
      description: stringAnswer(input.answers, descriptionField),
      formatId: nullableStringAnswer(input.answers, formatField),
      levelId: nullableStringAnswer(input.answers, levelField),
      language: "en",
      startsAt: null,
      endsAt: null,
      roomId: null,
      icsSequence: 0,
      scheduleDirty: false,
      capacity: null,
      ceuCredits: null,
      clientSessionId: null,
      notifiedAt: null,
      submittedAt: null,
      answers: customAnswers(input.answers, abstractFields),
      approvedSnapshot: {},
      contentReviewStatus: "approved",
    },
    input.submissionId,
  );
  yield* Effect.all([
    submissions.replaceTrackIds(draft.id, stringArrayAnswer(input.answers, trackField)),
    submissions.replaceTagIds(draft.id, stringArrayAnswer(input.answers, tagField)),
    upsertParticipants(
      bundle.event.id,
      draft.id,
      participants,
      participantFields,
      bundle.form.participantRoles,
    ),
  ]);
  return draft;
});

const validateSubmit = Effect.fn("validateCfpSubmit")(function* (
  input: CfpSubmitInput,
  fields: ReadonlyArray<FormField>,
  collectParticipants: boolean,
  roles: ReadonlyArray<{
    readonly role: string;
    readonly enabled: boolean;
    readonly min: number;
    readonly max: number;
  }>,
) {
  const abstractFields = fields.filter((field) => field.section === "abstract");
  const participantFields = fields.filter((field) => field.section === "participant");
  yield* Schema.decodeUnknownEffect(makeFormAnswersSchema(abstractFields))(input.answers).pipe(
    Effect.mapError(() => new InvalidInput({ message: "Complete the required submission fields" })),
  );
  if (!collectParticipants) return;
  const participants = normalizeParticipants(input.participants, roles);
  for (const role of roles.filter((item) => item.enabled)) {
    const count = participants.filter((participant) => participant.role === role.role).length;
    if (count < role.min || count > role.max) {
      return yield* Effect.fail(
        new InvalidInput({
          message: `${role.role} requires between ${role.min} and ${role.max} participants`,
        }),
      );
    }
  }
  for (const participant of participants) {
    yield* Schema.decodeUnknownEffect(makeFormAnswersSchema(participantFields))(
      participant.answers,
    ).pipe(
      Effect.mapError(
        () => new InvalidInput({ message: "Complete the required participant fields" }),
      ),
    );
  }
});

export const submitCfpDraft = Effect.fn("submitCfpDraft")(function* (
  input: CfpSubmitInput & { readonly portalUrl?: string },
) {
  const contacts = yield* Contacts;
  const emailLog = yield* EmailLog;
  const submissions = yield* Submissions;
  const bundle = yield* loadCfpForm(input.eventSlug, input.formId);
  yield* validateSubmit(
    input,
    bundle.fields,
    bundle.form.collectParticipants,
    bundle.form.participantRoles,
  );
  const saved = yield* saveCfpDraft({ ...input, submissionId: input.submissionId });
  const submitter = yield* contacts.findByEmail(bundle.event.id, input.email);
  const submission = yield* submissions.submitDraft(saved.id, submitter.id);
  let confirmationLogId: string | null = null;
  if (bundle.form.confirmationEmailEnabled) {
    const name = submitter.firstName.length > 0 ? submitter.firstName : submitter.email;
    const portalUrl = input.portalUrl ?? "https://opensesh.io/portal";
    const customBody = bundle.form.confirmationEmailBody
      .replaceAll("{{name}}", name)
      .replaceAll("{{title}}", submission.title)
      .replaceAll("{{submission.title}}", submission.title)
      .replaceAll("{{portal_link}}", portalUrl);
    const rendered = confirmation({
      eventName: bundle.event.name,
      logoUrl: bundle.event.logoUrl,
      name,
      submissionTitle: submission.title,
      portalUrl,
      customBody,
    });
    const entry = yield* emailLog.create({
      eventId: bundle.event.id,
      contactId: submitter.id,
      submissionId: submission.id,
      type: "confirmation",
      recipient: submitter.email,
      subject: rendered.subject,
      body: rendered.text,
      htmlBody: rendered.html,
      icsAttached: false,
      icsContent: null,
      icsSequence: null,
      status: "queued",
      provider: null,
      providerId: null,
      error: null,
      sentAt: null,
    });
    confirmationLogId = entry.id;
  }
  return { submission, form: bundle.form, confirmationLogId };
});

export const listCfpSubmissions = Effect.fn("listCfpSubmissions")(function* (
  eventSlug: string,
  formId: string,
  email: string,
) {
  const reads = yield* ReadModels;
  return yield* reads.publicFormAccount(eventSlug, formId, email);
});

const answersForSubmission = (
  submission: Submission,
  fields: ReadonlyArray<FormField>,
  trackIds: ReadonlyArray<string>,
  tagIds: ReadonlyArray<string>,
) => {
  const answers: Record<string, Schema.Json> = { ...submission.answers };
  for (const field of fields.filter((item) => item.section === "abstract")) {
    switch (field.mapsTo) {
      case "title":
        answers[field.id] = submission.title;
        break;
      case "description":
        answers[field.id] = submission.description;
        break;
      case "format_id":
        answers[field.id] = submission.formatId ?? "";
        break;
      case "level_id":
        answers[field.id] = submission.levelId ?? "";
        break;
      // Dropdown-bound fields answer with a single id; checkbox-bound with the
      // full list. Saving normalizes both into join rows, so rehydration must
      // reshape by field type or single-selects drop their value.
      case "tracks":
        answers[field.id] = field.fieldType === "checkbox" ? trackIds : (trackIds[0] ?? "");
        break;
      case "tags":
        answers[field.id] = field.fieldType === "checkbox" ? tagIds : (tagIds[0] ?? "");
        break;
    }
  }
  return answers;
};

export const loadCfpDraft = Effect.fn("loadCfpDraft")(function* (
  eventSlug: string,
  formId: string,
  submissionId: string,
  email: string,
) {
  const reads = yield* ReadModels;
  const bundle = yield* reads.publicDraft(eventSlug, formId, submissionId, email);
  const participantFields = bundle.fields.filter((field) => field.section === "participant");
  const participants = [];
  for (const { link, contact } of bundle.participants) {
    const answers: Record<string, Schema.Json> = { ...contact.custom };
    for (const field of participantFields) {
      if (field.mapsTo === "first_name") answers[field.id] = contact.firstName;
      if (field.mapsTo === "last_name") answers[field.id] = contact.lastName;
      if (field.mapsTo === "email") answers[field.id] = contact.email;
      if (field.mapsTo === "phone") answers[field.id] = contact.phone ?? "";
      if (field.mapsTo === "bio") answers[field.id] = contact.bio ?? "";
    }
    participants.push({ role: link.role, answers });
  }
  return {
    submission: bundle.submission,
    answers: answersForSubmission(bundle.submission, bundle.fields, bundle.trackIds, bundle.tagIds),
    participants,
  };
});
