import { and, asc, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import {
  contactEditHistory,
  contacts,
  eventMembers,
  fileComments,
  fileRequests,
  fileUploads,
  fileVersions,
  formFields,
  formats,
  forms,
  levels,
  portalFormResponses,
  portalForms,
  sessionFileRequirements,
  submissionEditHistory,
  submissionParticipants,
  submissions,
  submissionTags,
  submissionTracks,
  tags,
  taskAssignments,
  taskTemplates,
  tracks,
} from "../../db/schema";
import { Db } from "../db";
import { DbError, Forbidden, FormClosed, InvalidInput, type NotFound } from "../errors";
import { JsonObject } from "../schema/common";
import type {
  FileKind,
  PortalFormMutationRequest,
  PortalProfileUpdateRequest,
  SessionFileRequirementMutationRequest,
  TaskTemplateMutationRequest,
} from "../schema/portal";
import { Contact, Submission } from "../schema/submissions";
import { decode, decodeFound, query } from "./shared";

const contentKeys = ["title", "description", "formatId", "levelId", "language", "answers"] as const;
type ContentSnapshot = Readonly<Record<string, Schema.Json>> & {
  readonly title: string;
  readonly description: string;
  readonly formatId: string | null;
  readonly levelId: string | null;
  readonly language: string;
  readonly answers: Readonly<Record<string, Schema.Json>>;
};

const snapshot = (submission: Submission): ContentSnapshot => ({
  title: submission.title,
  description: submission.description,
  formatId: submission.formatId,
  levelId: submission.levelId,
  language: submission.language,
  answers: submission.answers,
});

const changedContent = (before: ContentSnapshot, after: ContentSnapshot) =>
  contentKeys.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));

const contentUpdate = (values: ContentSnapshot) => ({
  title: values.title,
  description: values.description,
  formatId: values.formatId,
  levelId: values.levelId,
  language: values.language,
  answers: values.answers,
});

const decodeJsonRecord = (value: unknown) =>
  Schema.decodeUnknownEffect(JsonObject)(value).pipe(
    Effect.mapError(
      (cause) => new DbError({ message: "Stored content history is invalid", cause }),
    ),
  );

// Public-facing profile fields follow the same approval contract as session
// content: confirmed speakers' edits stay live in the portal but public
// surfaces keep reading approvedProfile until an organizer approves.
const profileKeys = [
  "firstName",
  "lastName",
  "pronouns",
  "bio",
  "linkedinUrl",
  "twitterUrl",
  "facebookUrl",
  "websiteUrl",
  "headshotUrl",
  "headshotKey",
] as const;
type ProfileKey = (typeof profileKeys)[number];

const profileSnapshot = (contact: typeof contacts.$inferSelect) =>
  Object.fromEntries(profileKeys.map((key) => [key, contact[key] ?? null])) as Readonly<
    Record<string, Schema.Json>
  >;

const approvedBaseline = (contact: typeof contacts.$inferSelect) =>
  Object.keys(contact.approvedProfile).length > 0
    ? contact.approvedProfile
    : profileSnapshot(contact);

const applyContentPatch = (base: ContentSnapshot, patch: Readonly<Record<string, Schema.Json>>) =>
  Effect.gen(function* () {
    const answers =
      patch.answers === undefined ? base.answers : yield* decodeJsonRecord(patch.answers);
    return {
      title: typeof patch.title === "string" ? patch.title : base.title,
      description: typeof patch.description === "string" ? patch.description : base.description,
      formatId:
        typeof patch.formatId === "string" || patch.formatId === null
          ? patch.formatId
          : base.formatId,
      levelId:
        typeof patch.levelId === "string" || patch.levelId === null ? patch.levelId : base.levelId,
      language: typeof patch.language === "string" ? patch.language : base.language,
      answers,
    } satisfies ContentSnapshot;
  });

export interface SpeakerPortalBootstrap {
  readonly contact: Contact;
  readonly submissions: ReadonlyArray<{
    readonly submission: typeof submissions.$inferSelect;
    readonly format: typeof formats.$inferSelect | null;
    readonly form: typeof forms.$inferSelect | null;
  }>;
  readonly tasks: ReadonlyArray<{
    readonly assignment: typeof taskAssignments.$inferSelect;
    readonly template: typeof taskTemplates.$inferSelect;
    readonly form: typeof portalForms.$inferSelect | null;
    readonly fileRequest: typeof fileRequests.$inferSelect | null;
    readonly submission: typeof submissions.$inferSelect | null;
  }>;
  readonly responses: ReadonlyArray<typeof portalFormResponses.$inferSelect>;
  readonly requirements: ReadonlyArray<typeof sessionFileRequirements.$inferSelect>;
  readonly files: ReadonlyArray<{
    readonly upload: typeof fileUploads.$inferSelect;
    readonly request: typeof fileRequests.$inferSelect | null;
  }>;
  readonly versions: ReadonlyArray<{ readonly version: typeof fileVersions.$inferSelect }>;
  readonly comments: ReadonlyArray<{ readonly comment: typeof fileComments.$inferSelect }>;
  readonly history: ReadonlyArray<{
    readonly history: typeof submissionEditHistory.$inferSelect;
  }>;
  readonly profileHistory: ReadonlyArray<{
    readonly history: typeof contactEditHistory.$inferSelect;
  }>;
  readonly fields: ReadonlyArray<{ readonly field: typeof formFields.$inferSelect }>;
  readonly trackIds: ReadonlyArray<{ readonly submissionId: string; readonly id: string }>;
  readonly tagIds: ReadonlyArray<{ readonly submissionId: string; readonly id: string }>;
  readonly library: {
    readonly tracks: ReadonlyArray<typeof tracks.$inferSelect>;
    readonly formats: ReadonlyArray<typeof formats.$inferSelect>;
    readonly tags: ReadonlyArray<typeof tags.$inferSelect>;
    readonly levels: ReadonlyArray<typeof levels.$inferSelect>;
  };
}

export interface AdminPortalBootstrap {
  readonly templates: ReadonlyArray<{
    readonly template: typeof taskTemplates.$inferSelect;
    readonly form: typeof portalForms.$inferSelect | null;
    readonly fileRequest: typeof fileRequests.$inferSelect | null;
  }>;
  readonly assignments: ReadonlyArray<{
    readonly assignment: typeof taskAssignments.$inferSelect;
    readonly template: typeof taskTemplates.$inferSelect;
    readonly contact: typeof contacts.$inferSelect | null;
    readonly submission: typeof submissions.$inferSelect | null;
  }>;
  readonly participants: ReadonlyArray<{
    readonly participant: typeof submissionParticipants.$inferSelect;
    readonly contact: typeof contacts.$inferSelect;
    readonly submission: typeof submissions.$inferSelect;
  }>;
  readonly forms: ReadonlyArray<typeof portalForms.$inferSelect>;
  readonly responses: ReadonlyArray<{
    readonly response: typeof portalFormResponses.$inferSelect;
    readonly contact: typeof contacts.$inferSelect;
    readonly submission: typeof submissions.$inferSelect | null;
  }>;
  readonly fileRequests: ReadonlyArray<typeof fileRequests.$inferSelect>;
  readonly requirements: ReadonlyArray<typeof sessionFileRequirements.$inferSelect>;
  readonly files: ReadonlyArray<{
    readonly upload: typeof fileUploads.$inferSelect;
    readonly request: typeof fileRequests.$inferSelect | null;
    readonly contact: typeof contacts.$inferSelect;
    readonly submission: typeof submissions.$inferSelect | null;
  }>;
  readonly versions: ReadonlyArray<{ readonly version: typeof fileVersions.$inferSelect }>;
  readonly comments: ReadonlyArray<{ readonly comment: typeof fileComments.$inferSelect }>;
  readonly submissions: ReadonlyArray<typeof submissions.$inferSelect>;
  readonly history: ReadonlyArray<{
    readonly history: typeof submissionEditHistory.$inferSelect;
  }>;
  readonly profileHistory: ReadonlyArray<{
    readonly history: typeof contactEditHistory.$inferSelect;
    readonly contact: typeof contacts.$inferSelect;
  }>;
  readonly fields: ReadonlyArray<{ readonly field: typeof formFields.$inferSelect }>;
  readonly library: SpeakerPortalBootstrap["library"];
}

interface PortalService {
  readonly speakerBootstrap: (
    contactId: string,
  ) => Effect.Effect<SpeakerPortalBootstrap, DbError | NotFound>;
  readonly adminBootstrap: (eventId: string) => Effect.Effect<AdminPortalBootstrap, DbError>;
  readonly updateProfile: (
    contactId: string,
    input: typeof PortalProfileUpdateRequest.Type,
  ) => Effect.Effect<Contact, DbError | NotFound>;
  readonly withdrawSubmission: (
    contactId: string,
    submissionId: string,
  ) => Effect.Effect<Submission, DbError | Forbidden | NotFound>;
  readonly editSubmission: (
    contactId: string,
    submissionId: string,
    answers: Readonly<Record<string, Schema.Json>>,
    authorName: string,
  ) => Effect.Effect<Submission, DbError | Forbidden | FormClosed | NotFound>;
  readonly restoreHistory: (
    historyId: string,
    actor: { readonly contactId?: string; readonly userId?: string; readonly name: string },
  ) => Effect.Effect<Submission, DbError | Forbidden | NotFound>;
  readonly completeTask: (
    contactId: string,
    assignmentId: string,
  ) => Effect.Effect<typeof taskAssignments.$inferSelect, DbError | Forbidden | NotFound>;
  readonly submitPortalForm: (
    contactId: string,
    assignmentId: string,
    answers: Readonly<Record<string, Schema.Json>>,
  ) => Effect.Effect<typeof portalFormResponses.$inferSelect, DbError | Forbidden | NotFound>;
  readonly prepareFileUpload: (
    contactId: string,
    assignmentId: string | null,
    fileRequestId: string | null,
    submissionId: string | null,
    kind: typeof FileKind.Type,
    requirementId: string | null,
    filename: string,
    size: number,
  ) => Effect.Effect<
    { readonly fileUploadId: string; readonly completeAssignmentId: string | null },
    DbError | Forbidden | InvalidInput | NotFound
  >;
  readonly recordFileVersion: (input: {
    readonly fileUploadId: string;
    readonly storageKey: string;
    readonly filename: string;
    readonly contentType: string;
    readonly size: number;
    readonly uploaderContactId: string | null;
    readonly uploaderEventMemberId: string | null;
    readonly uploaderName: string;
    readonly headshotContactId: string | null;
    readonly completeAssignmentId: string | null;
  }) => Effect.Effect<typeof fileVersions.$inferSelect, DbError>;
  readonly addSpeakerComment: (
    contactId: string,
    fileUploadId: string,
    name: string,
    body: string,
  ) => Effect.Effect<typeof fileComments.$inferSelect, DbError | Forbidden>;
  readonly addAdminComment: (
    eventId: string,
    userId: string,
    fileUploadId: string,
    name: string,
    body: string,
  ) => Effect.Effect<typeof fileComments.$inferSelect, DbError | Forbidden | NotFound>;
  readonly getVersionForActor: (
    versionId: string,
    actor: { readonly contactId?: string; readonly userId?: string },
  ) => Effect.Effect<typeof fileVersions.$inferSelect, DbError | Forbidden | NotFound>;
  readonly saveTaskTemplate: (
    input: typeof TaskTemplateMutationRequest.Type,
  ) => Effect.Effect<typeof taskTemplates.$inferSelect | undefined, DbError | NotFound>;
  readonly waiveAssignment: (
    eventId: string,
    assignmentId: string,
  ) => Effect.Effect<typeof taskAssignments.$inferSelect, DbError | Forbidden | NotFound>;
  readonly manualAssign: (input: {
    readonly eventId: string;
    readonly taskTemplateId: string;
    readonly contactId: string | null;
    readonly submissionId: string | null;
  }) => Effect.Effect<typeof taskAssignments.$inferSelect | null, DbError | InvalidInput>;
  readonly savePortalForm: (
    input: typeof PortalFormMutationRequest.Type,
  ) => Effect.Effect<typeof portalForms.$inferSelect | undefined, DbError | NotFound>;
  readonly createFileRequest: (input: {
    readonly eventId: string;
    readonly title: string;
    readonly targetType: "contact" | "submission";
    readonly instructions: string;
  }) => Effect.Effect<typeof fileRequests.$inferSelect | undefined, DbError>;
  readonly saveSessionFileRequirement: (
    input: typeof SessionFileRequirementMutationRequest.Type,
  ) => Effect.Effect<typeof sessionFileRequirements.$inferSelect | undefined, DbError>;
  readonly reviewContent: (
    eventId: string,
    userId: string,
    historyId: string,
    decision: "approved" | "rejected",
  ) => Effect.Effect<Submission, DbError | Forbidden | NotFound>;
  readonly reviewProfile: (
    eventId: string,
    userId: string,
    historyId: string,
    decision: "approved" | "rejected",
  ) => Effect.Effect<Contact, DbError | Forbidden | NotFound>;
  readonly acceptSubmission: (
    eventId: string,
    submissionId: string,
  ) => Effect.Effect<Submission, DbError | Forbidden | NotFound>;
}

export class Portal extends Context.Service<Portal, PortalService>()("opensesh/Portal") {}

export const PortalLive = Layer.effect(
  Portal,
  Effect.gen(function* () {
    const { database } = yield* Db;

    const assignmentForSpeaker = (contactId: string, assignmentId: string) =>
      query(database, "Could not load task assignment", (db) =>
        db
          .select({ assignment: taskAssignments, template: taskTemplates })
          .from(taskAssignments)
          .innerJoin(taskTemplates, eq(taskTemplates.id, taskAssignments.taskTemplateId))
          .leftJoin(
            submissionParticipants,
            eq(submissionParticipants.submissionId, taskAssignments.submissionId),
          )
          .where(
            and(
              eq(taskAssignments.id, assignmentId),
              or(
                eq(taskAssignments.contactId, contactId),
                eq(submissionParticipants.contactId, contactId),
              ),
            ),
          )
          .limit(1)
          .execute(),
      ).pipe(
        Effect.filterOrFail(
          (rows) => rows.length > 0,
          () => new Forbidden({ message: "You cannot access this task" }),
        ),
        Effect.map((rows) => rows[0]!),
      );

    const memberForAdmin = (eventId: string, userId: string) =>
      query(database, "Could not load organizer", (db) =>
        db
          .select()
          .from(eventMembers)
          .where(
            and(
              eq(eventMembers.eventId, eventId),
              eq(eventMembers.userId, userId),
              eq(eventMembers.role, "admin"),
            ),
          )
          .limit(1)
          .execute(),
      ).pipe(
        Effect.filterOrFail(
          (rows) => rows.length > 0,
          () => new Forbidden({ message: "You cannot manage this event" }),
        ),
        Effect.map((rows) => rows[0]!),
      );

    const setTaskStatus = (assignmentId: string, status: "todo" | "done" | "waived") =>
      query(database, "Could not update task assignment", (db) =>
        db
          .update(taskAssignments)
          .set({
            status,
            completedAt: status === "todo" ? null : new Date(),
            updatedAt: new Date(),
          })
          .where(eq(taskAssignments.id, assignmentId))
          .returning()
          .execute(),
      );

    const addHistory = (input: typeof submissionEditHistory.$inferInsert) =>
      query(database, "Could not record submission history", (db) =>
        db.insert(submissionEditHistory).values(input).returning().execute(),
      );

    return {
      speakerBootstrap: (contactId) =>
        Effect.all(
          {
            contact: query(database, "Could not load speaker profile", (db) =>
              db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1).execute(),
            ).pipe(Effect.flatMap((rows) => decodeFound(Contact, "Contact", rows[0]))),
            submissions: query(database, "Could not load speaker submissions", (db) =>
              db
                .selectDistinct({ submission: submissions, format: formats, form: forms })
                .from(submissions)
                .leftJoin(
                  submissionParticipants,
                  eq(submissionParticipants.submissionId, submissions.id),
                )
                .leftJoin(formats, eq(formats.id, submissions.formatId))
                .leftJoin(forms, eq(forms.id, submissions.sourceFormId))
                .where(
                  or(
                    eq(submissions.submitterContactId, contactId),
                    eq(submissionParticipants.contactId, contactId),
                  ),
                )
                .orderBy(desc(submissions.updatedAt))
                .execute(),
            ),
            tasks: query(database, "Could not load speaker tasks", (db) =>
              db
                .select({
                  assignment: taskAssignments,
                  template: taskTemplates,
                  form: portalForms,
                  fileRequest: fileRequests,
                  submission: submissions,
                })
                .from(taskAssignments)
                .innerJoin(taskTemplates, eq(taskTemplates.id, taskAssignments.taskTemplateId))
                .leftJoin(portalForms, eq(portalForms.id, taskTemplates.portalFormId))
                .leftJoin(fileRequests, eq(fileRequests.id, taskTemplates.fileRequestId))
                .leftJoin(submissions, eq(submissions.id, taskAssignments.submissionId))
                .leftJoin(
                  submissionParticipants,
                  eq(submissionParticipants.submissionId, taskAssignments.submissionId),
                )
                .where(
                  or(
                    eq(taskAssignments.contactId, contactId),
                    eq(submissionParticipants.contactId, contactId),
                  ),
                )
                .orderBy(asc(taskTemplates.position))
                .execute(),
            ),
            responses: query(database, "Could not load portal form responses", (db) =>
              db
                .select()
                .from(portalFormResponses)
                .where(eq(portalFormResponses.contactId, contactId))
                .orderBy(desc(portalFormResponses.submittedAt))
                .execute(),
            ),
            requirements: query(database, "Could not load session file requirements", (db) =>
              db
                .select({ requirement: sessionFileRequirements })
                .from(sessionFileRequirements)
                .innerJoin(contacts, eq(contacts.eventId, sessionFileRequirements.eventId))
                .where(eq(contacts.id, contactId))
                .orderBy(asc(sessionFileRequirements.position))
                .execute(),
            ).pipe(Effect.map((rows) => rows.map((row) => row.requirement))),
            files: query(database, "Could not load speaker files", (db) =>
              db
                .selectDistinct({ upload: fileUploads, request: fileRequests })
                .from(fileUploads)
                .leftJoin(fileRequests, eq(fileRequests.id, fileUploads.fileRequestId))
                .leftJoin(
                  submissionParticipants,
                  eq(submissionParticipants.submissionId, fileUploads.submissionId),
                )
                .where(
                  or(
                    eq(fileUploads.contactId, contactId),
                    and(
                      isNotNull(fileUploads.requirementId),
                      eq(submissionParticipants.contactId, contactId),
                    ),
                  ),
                )
                .orderBy(desc(fileUploads.updatedAt))
                .execute(),
            ),
            versions: query(database, "Could not load file versions", (db) =>
              db
                .selectDistinct({ version: fileVersions })
                .from(fileVersions)
                .innerJoin(fileUploads, eq(fileUploads.id, fileVersions.fileUploadId))
                .leftJoin(
                  submissionParticipants,
                  eq(submissionParticipants.submissionId, fileUploads.submissionId),
                )
                .where(
                  or(
                    eq(fileUploads.contactId, contactId),
                    and(
                      isNotNull(fileUploads.requirementId),
                      eq(submissionParticipants.contactId, contactId),
                    ),
                  ),
                )
                .orderBy(desc(fileVersions.uploadedAt))
                .execute(),
            ),
            comments: query(database, "Could not load file comments", (db) =>
              db
                .selectDistinct({ comment: fileComments })
                .from(fileComments)
                .innerJoin(fileUploads, eq(fileUploads.id, fileComments.fileUploadId))
                .leftJoin(
                  submissionParticipants,
                  eq(submissionParticipants.submissionId, fileUploads.submissionId),
                )
                .where(
                  or(
                    eq(fileUploads.contactId, contactId),
                    and(
                      isNotNull(fileUploads.requirementId),
                      eq(submissionParticipants.contactId, contactId),
                    ),
                  ),
                )
                .orderBy(asc(fileComments.createdAt))
                .execute(),
            ),
            history: query(database, "Could not load submission history", (db) =>
              db
                .selectDistinct({ history: submissionEditHistory })
                .from(submissionEditHistory)
                .innerJoin(submissions, eq(submissions.id, submissionEditHistory.submissionId))
                .leftJoin(
                  submissionParticipants,
                  eq(submissionParticipants.submissionId, submissions.id),
                )
                .where(
                  or(
                    eq(submissions.submitterContactId, contactId),
                    eq(submissionParticipants.contactId, contactId),
                  ),
                )
                .orderBy(desc(submissionEditHistory.createdAt))
                .execute(),
            ),
            profileHistory: query(database, "Could not load profile history", (db) =>
              db
                .select({ history: contactEditHistory })
                .from(contactEditHistory)
                .where(eq(contactEditHistory.contactId, contactId))
                .orderBy(desc(contactEditHistory.createdAt))
                .execute(),
            ),
            fields: query(database, "Could not load submission fields", (db) =>
              db
                .selectDistinct({ field: formFields })
                .from(formFields)
                .innerJoin(submissions, eq(submissions.sourceFormId, formFields.formId))
                .leftJoin(
                  submissionParticipants,
                  eq(submissionParticipants.submissionId, submissions.id),
                )
                .where(
                  or(
                    eq(submissions.submitterContactId, contactId),
                    eq(submissionParticipants.contactId, contactId),
                  ),
                )
                .orderBy(asc(formFields.position))
                .execute(),
            ),
            trackIds: query(database, "Could not load submission tracks", (db) =>
              db
                .select({
                  submissionId: submissionTracks.submissionId,
                  id: submissionTracks.trackId,
                })
                .from(submissionTracks)
                .innerJoin(submissions, eq(submissions.id, submissionTracks.submissionId))
                .leftJoin(
                  submissionParticipants,
                  eq(submissionParticipants.submissionId, submissions.id),
                )
                .where(
                  or(
                    eq(submissions.submitterContactId, contactId),
                    eq(submissionParticipants.contactId, contactId),
                  ),
                )
                .execute(),
            ),
            tagIds: query(database, "Could not load submission tags", (db) =>
              db
                .select({ submissionId: submissionTags.submissionId, id: submissionTags.tagId })
                .from(submissionTags)
                .innerJoin(submissions, eq(submissions.id, submissionTags.submissionId))
                .leftJoin(
                  submissionParticipants,
                  eq(submissionParticipants.submissionId, submissions.id),
                )
                .where(
                  or(
                    eq(submissions.submitterContactId, contactId),
                    eq(submissionParticipants.contactId, contactId),
                  ),
                )
                .execute(),
            ),
            library: Effect.all({
              tracks: query(database, "Could not load tracks", (db) =>
                db.select().from(tracks).orderBy(asc(tracks.position)).execute(),
              ),
              formats: query(database, "Could not load formats", (db) =>
                db.select().from(formats).orderBy(asc(formats.position)).execute(),
              ),
              tags: query(database, "Could not load tags", (db) =>
                db.select().from(tags).orderBy(asc(tags.position)).execute(),
              ),
              levels: query(database, "Could not load levels", (db) =>
                db.select().from(levels).orderBy(asc(levels.position)).execute(),
              ),
            }),
          },
          { concurrency: "unbounded" },
        ),
      adminBootstrap: (eventId) =>
        Effect.all(
          {
            templates: query(database, "Could not load task templates", (db) =>
              db
                .select({ template: taskTemplates, form: portalForms, fileRequest: fileRequests })
                .from(taskTemplates)
                .leftJoin(portalForms, eq(portalForms.id, taskTemplates.portalFormId))
                .leftJoin(fileRequests, eq(fileRequests.id, taskTemplates.fileRequestId))
                .where(eq(taskTemplates.eventId, eventId))
                .orderBy(asc(taskTemplates.position))
                .execute(),
            ),
            assignments: query(database, "Could not load task assignments", (db) =>
              db
                .select({
                  assignment: taskAssignments,
                  template: taskTemplates,
                  contact: contacts,
                  submission: submissions,
                })
                .from(taskAssignments)
                .innerJoin(taskTemplates, eq(taskTemplates.id, taskAssignments.taskTemplateId))
                .leftJoin(contacts, eq(contacts.id, taskAssignments.contactId))
                .leftJoin(submissions, eq(submissions.id, taskAssignments.submissionId))
                .where(eq(taskTemplates.eventId, eventId))
                .orderBy(asc(taskTemplates.position))
                .execute(),
            ),
            participants: query(database, "Could not load accepted speakers", (db) =>
              db
                .select({
                  participant: submissionParticipants,
                  contact: contacts,
                  submission: submissions,
                })
                .from(submissionParticipants)
                .innerJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
                .innerJoin(submissions, eq(submissions.id, submissionParticipants.submissionId))
                .where(and(eq(submissions.eventId, eventId), eq(submissions.status, "accepted")))
                .orderBy(asc(contacts.lastName), asc(contacts.firstName))
                .execute(),
            ),
            forms: query(database, "Could not load portal forms", (db) =>
              db
                .select()
                .from(portalForms)
                .where(eq(portalForms.eventId, eventId))
                .orderBy(asc(portalForms.createdAt))
                .execute(),
            ),
            responses: query(database, "Could not load portal responses", (db) =>
              db
                .select({
                  response: portalFormResponses,
                  contact: contacts,
                  submission: submissions,
                })
                .from(portalFormResponses)
                .innerJoin(portalForms, eq(portalForms.id, portalFormResponses.formId))
                .innerJoin(contacts, eq(contacts.id, portalFormResponses.contactId))
                .leftJoin(submissions, eq(submissions.id, portalFormResponses.submissionId))
                .where(eq(portalForms.eventId, eventId))
                .orderBy(desc(portalFormResponses.submittedAt))
                .execute(),
            ),
            fileRequests: query(database, "Could not load file requests", (db) =>
              db
                .select()
                .from(fileRequests)
                .where(eq(fileRequests.eventId, eventId))
                .orderBy(asc(fileRequests.createdAt))
                .execute(),
            ),
            requirements: query(database, "Could not load session file requirements", (db) =>
              db
                .select()
                .from(sessionFileRequirements)
                .where(eq(sessionFileRequirements.eventId, eventId))
                .orderBy(asc(sessionFileRequirements.position))
                .execute(),
            ),
            files: query(database, "Could not load uploaded files", (db) =>
              db
                .select({
                  upload: fileUploads,
                  request: fileRequests,
                  contact: contacts,
                  submission: submissions,
                })
                .from(fileUploads)
                .leftJoin(fileRequests, eq(fileRequests.id, fileUploads.fileRequestId))
                .innerJoin(contacts, eq(contacts.id, fileUploads.contactId))
                .leftJoin(submissions, eq(submissions.id, fileUploads.submissionId))
                .where(eq(contacts.eventId, eventId))
                .orderBy(desc(fileUploads.updatedAt))
                .execute(),
            ),
            versions: query(database, "Could not load file versions", (db) =>
              db
                .select({ version: fileVersions })
                .from(fileVersions)
                .innerJoin(fileUploads, eq(fileUploads.id, fileVersions.fileUploadId))
                .innerJoin(contacts, eq(contacts.id, fileUploads.contactId))
                .where(eq(contacts.eventId, eventId))
                .orderBy(desc(fileVersions.uploadedAt))
                .execute(),
            ),
            comments: query(database, "Could not load file comments", (db) =>
              db
                .select({ comment: fileComments })
                .from(fileComments)
                .innerJoin(fileUploads, eq(fileUploads.id, fileComments.fileUploadId))
                .innerJoin(contacts, eq(contacts.id, fileUploads.contactId))
                .where(eq(contacts.eventId, eventId))
                .orderBy(asc(fileComments.createdAt))
                .execute(),
            ),
            submissions: query(database, "Could not load submissions", (db) =>
              db
                .select()
                .from(submissions)
                .where(eq(submissions.eventId, eventId))
                .orderBy(desc(submissions.updatedAt))
                .execute(),
            ),
            history: query(database, "Could not load submission history", (db) =>
              db
                .select({ history: submissionEditHistory })
                .from(submissionEditHistory)
                .innerJoin(submissions, eq(submissions.id, submissionEditHistory.submissionId))
                .where(eq(submissions.eventId, eventId))
                .orderBy(desc(submissionEditHistory.createdAt))
                .execute(),
            ),
            profileHistory: query(database, "Could not load profile history", (db) =>
              db
                .select({ history: contactEditHistory, contact: contacts })
                .from(contactEditHistory)
                .innerJoin(contacts, eq(contacts.id, contactEditHistory.contactId))
                .where(eq(contacts.eventId, eventId))
                .orderBy(desc(contactEditHistory.createdAt))
                .execute(),
            ),
            fields: query(database, "Could not load form fields", (db) =>
              db
                .select({ field: formFields })
                .from(formFields)
                .innerJoin(forms, eq(forms.id, formFields.formId))
                .where(eq(forms.eventId, eventId))
                .orderBy(asc(formFields.position))
                .execute(),
            ),
            library: Effect.all({
              tracks: query(database, "Could not load tracks", (db) =>
                db
                  .select()
                  .from(tracks)
                  .where(eq(tracks.eventId, eventId))
                  .orderBy(asc(tracks.position))
                  .execute(),
              ),
              formats: query(database, "Could not load formats", (db) =>
                db
                  .select()
                  .from(formats)
                  .where(eq(formats.eventId, eventId))
                  .orderBy(asc(formats.position))
                  .execute(),
              ),
              tags: query(database, "Could not load tags", (db) =>
                db
                  .select()
                  .from(tags)
                  .where(eq(tags.eventId, eventId))
                  .orderBy(asc(tags.position))
                  .execute(),
              ),
              levels: query(database, "Could not load levels", (db) =>
                db
                  .select()
                  .from(levels)
                  .where(eq(levels.eventId, eventId))
                  .orderBy(asc(levels.position))
                  .execute(),
              ),
            }),
          },
          { concurrency: "unbounded" },
        ),
      updateProfile: (contactId, input) =>
        query(database, "Could not update speaker profile", (db) =>
          db.transaction(async (transaction) => {
            const existingRows = await transaction
              .select()
              .from(contacts)
              .where(eq(contacts.id, contactId))
              .limit(1);
            const existing = existingRows[0];
            if (existing === undefined) return [];
            const now = new Date();
            const inputRecord = input as Readonly<Record<string, Schema.Json | undefined>>;
            const gatedChanges = profileKeys.filter(
              (key) =>
                inputRecord[key] !== undefined &&
                JSON.stringify(inputRecord[key] ?? null) !== JSON.stringify(existing[key] ?? null),
            );
            if (existing.confirmedAt === null || gatedChanges.length === 0) {
              return await transaction
                .update(contacts)
                .set({ ...input, updatedAt: now })
                .where(eq(contacts.id, contactId))
                .returning();
            }
            await transaction.insert(contactEditHistory).values({
              contactId,
              authorContactId: contactId,
              authorEventMemberId: null,
              authorName: `${existing.firstName} ${existing.lastName}`,
              changedFields: gatedChanges,
              previousValues: Object.fromEntries(
                gatedChanges.map((key) => [key, existing[key] ?? null]),
              ),
              newValues: Object.fromEntries(
                gatedChanges.map((key) => [key, inputRecord[key] ?? null]),
              ),
              approvalStatus: "pending_review",
              reviewedAt: null,
              reviewedByEventMemberId: null,
            });
            return await transaction
              .update(contacts)
              .set({
                ...input,
                approvedProfile: approvedBaseline(existing),
                profileReviewStatus: "pending_review",
                updatedAt: now,
              })
              .where(eq(contacts.id, contactId))
              .returning();
          }),
        ).pipe(Effect.flatMap((rows) => decodeFound(Contact, "Contact", rows[0]))),
      withdrawSubmission: (contactId, submissionId) =>
        query(database, "Could not withdraw submission", (db) =>
          db
            .update(submissions)
            .set({ status: "withdrawn", updatedAt: new Date() })
            .where(
              and(
                eq(submissions.id, submissionId),
                or(
                  eq(submissions.submitterContactId, contactId),
                  inArray(
                    submissions.id,
                    database
                      .select({ id: submissionParticipants.submissionId })
                      .from(submissionParticipants)
                      .where(eq(submissionParticipants.contactId, contactId)),
                  ),
                ),
              ),
            )
            .returning()
            .execute(),
        ).pipe(
          Effect.filterOrFail(
            (rows) => rows.length > 0,
            () => new Forbidden({ message: "You cannot withdraw this submission" }),
          ),
          Effect.flatMap((rows) => decode(Submission, "Submission", rows[0])),
        ),
      editSubmission: (contactId, submissionId, answers, authorName) =>
        Effect.gen(function* () {
          const owned = yield* query(database, "Could not load submission for editing", (db) =>
            db
              .selectDistinct({ submission: submissions, form: forms, author: contacts })
              .from(submissions)
              .leftJoin(forms, eq(forms.id, submissions.sourceFormId))
              .leftJoin(
                submissionParticipants,
                eq(submissionParticipants.submissionId, submissions.id),
              )
              .leftJoin(contacts, eq(contacts.id, contactId))
              .where(
                and(
                  eq(submissions.id, submissionId),
                  or(
                    eq(submissions.submitterContactId, contactId),
                    eq(submissionParticipants.contactId, contactId),
                  ),
                ),
              )
              .limit(1)
              .execute(),
          );
          const row = owned[0];
          if (row === undefined) {
            return yield* Effect.fail(
              new Forbidden({ message: "You cannot edit this submission" }),
            );
          }
          if (
            row.form !== null &&
            (row.form.status === "closed" ||
              (row.form.closeDate !== null && row.form.closeDate <= new Date()))
          ) {
            return yield* Effect.fail(
              new FormClosed({ message: "This submission form is closed" }),
            );
          }
          const current = yield* decode(Submission, "Submission", row.submission);
          const fields = yield* query(database, "Could not load form fields", (db) =>
            row.form === null
              ? db.select().from(formFields).where(eq(formFields.id, "__none__")).execute()
              : db.select().from(formFields).where(eq(formFields.formId, row.form.id)).execute(),
          );
          const value = (mapsTo: string) => {
            const field = fields.find((item) => item.mapsTo === mapsTo);
            return field === undefined ? undefined : answers[field.id];
          };
          const title = value("title");
          const description = value("description");
          const formatId = value("format_id");
          const levelId = value("level_id");
          const next = {
            ...snapshot(current),
            ...(typeof title === "string" ? { title } : {}),
            ...(typeof description === "string" ? { description } : {}),
            ...(typeof formatId === "string" ? { formatId: formatId || null } : {}),
            ...(typeof levelId === "string" ? { levelId: levelId || null } : {}),
            answers,
          } satisfies ContentSnapshot;
          const before = snapshot(current);
          const changedFields = changedContent(before, next);
          if (changedFields.length === 0) return current;
          const requiresReview = current.status === "accepted";
          const updatedRows = yield* query(database, "Could not update submission", (db) =>
            db
              .update(submissions)
              .set({
                ...contentUpdate(next),
                contentReviewStatus: requiresReview ? "pending_review" : "approved",
                ...(requiresReview ? {} : { approvedSnapshot: next }),
                updatedAt: new Date(),
              })
              .where(eq(submissions.id, submissionId))
              .returning()
              .execute(),
          );
          const updated = yield* decodeFound(Submission, "Submission", updatedRows[0]);
          yield* addHistory({
            submissionId,
            authorContactId: contactId,
            authorEventMemberId: null,
            authorName:
              row.author === null ? authorName : `${row.author.firstName} ${row.author.lastName}`,
            changedFields,
            previousValues: Object.fromEntries(changedFields.map((key) => [key, before[key]])),
            newValues: Object.fromEntries(changedFields.map((key) => [key, next[key]])),
            approvalStatus: requiresReview ? "pending_review" : "approved",
            reviewedAt: requiresReview ? null : new Date(),
            reviewedByEventMemberId: null,
          });
          return updated;
        }),
      restoreHistory: (historyId, actor) =>
        Effect.gen(function* () {
          const rows = yield* query(database, "Could not load submission history", (db) =>
            db
              .select({ history: submissionEditHistory, submission: submissions })
              .from(submissionEditHistory)
              .innerJoin(submissions, eq(submissions.id, submissionEditHistory.submissionId))
              .where(eq(submissionEditHistory.id, historyId))
              .limit(1)
              .execute(),
          );
          const row = rows[0];
          if (row === undefined)
            return yield* Effect.fail(new Forbidden({ message: "You cannot restore this edit" }));
          let memberId: string | null = null;
          if (actor.contactId !== undefined) {
            const allowed = yield* query(database, "Could not verify submission speaker", (db) =>
              db
                .select({ id: submissionParticipants.id })
                .from(submissionParticipants)
                .where(
                  and(
                    eq(submissionParticipants.submissionId, row.submission.id),
                    eq(submissionParticipants.contactId, actor.contactId!),
                  ),
                )
                .limit(1)
                .execute(),
            );
            if (row.submission.submitterContactId !== actor.contactId && allowed.length === 0) {
              return yield* Effect.fail(new Forbidden({ message: "You cannot restore this edit" }));
            }
          } else if (actor.userId !== undefined) {
            const member = yield* memberForAdmin(row.submission.eventId, actor.userId);
            memberId = member.id;
          } else {
            return yield* Effect.fail(new Forbidden({ message: "You cannot restore this edit" }));
          }
          const current = yield* decode(Submission, "Submission", row.submission);
          const before = snapshot(current);
          const restoreValues = yield* decodeJsonRecord(row.history.previousValues);
          const next = yield* applyContentPatch(before, restoreValues);
          const changedFields = changedContent(before, next);
          const requiresReview = current.status === "accepted" && actor.contactId !== undefined;
          const updatedRows = yield* query(database, "Could not restore submission", (db) =>
            db
              .update(submissions)
              .set({
                ...contentUpdate(next),
                contentReviewStatus: requiresReview ? "pending_review" : "approved",
                ...(requiresReview ? {} : { approvedSnapshot: next }),
                updatedAt: new Date(),
              })
              .where(eq(submissions.id, current.id))
              .returning()
              .execute(),
          );
          yield* addHistory({
            submissionId: current.id,
            authorContactId: actor.contactId ?? null,
            authorEventMemberId: memberId,
            authorName: actor.name,
            changedFields,
            previousValues: Object.fromEntries(changedFields.map((key) => [key, before[key]])),
            newValues: Object.fromEntries(changedFields.map((key) => [key, next[key]])),
            approvalStatus: requiresReview ? "pending_review" : "approved",
            reviewedAt: requiresReview ? null : new Date(),
            reviewedByEventMemberId: requiresReview ? null : memberId,
          });
          return yield* decodeFound(Submission, "Submission", updatedRows[0]);
        }),
      completeTask: (contactId, assignmentId) =>
        Effect.gen(function* () {
          yield* assignmentForSpeaker(contactId, assignmentId);
          const rows = yield* setTaskStatus(assignmentId, "done");
          return rows[0];
        }),
      submitPortalForm: (contactId, assignmentId, answers) =>
        Effect.gen(function* () {
          const row = yield* assignmentForSpeaker(contactId, assignmentId);
          if (row.template.portalFormId === null) {
            return yield* Effect.fail(new Forbidden({ message: "This task has no linked form" }));
          }
          const responseRows = yield* query(database, "Could not record form response", (db) =>
            db
              .insert(portalFormResponses)
              .values({
                formId: row.template.portalFormId!,
                contactId,
                submissionId: row.assignment.submissionId,
                answers,
                submittedAt: new Date(),
              })
              .returning()
              .execute(),
          );
          yield* setTaskStatus(assignmentId, "done");
          return responseRows[0];
        }),
      prepareFileUpload: (
        contactId,
        assignmentId,
        requestedFileRequestId,
        submissionId,
        kind,
        requirementId,
        filename,
        size,
      ) =>
        Effect.gen(function* () {
          let fileRequestId = requestedFileRequestId;
          if (requirementId !== null) {
            if (
              assignmentId !== null ||
              fileRequestId !== null ||
              submissionId === null ||
              kind !== "slides"
            ) {
              return yield* Effect.fail(
                new InvalidInput({ message: "Session files need a session and requirement" }),
              );
            }
            const requirementRows = yield* query(
              database,
              "Could not verify session file requirement",
              (db) =>
                db
                  .select({ requirement: sessionFileRequirements })
                  .from(sessionFileRequirements)
                  .innerJoin(
                    submissions,
                    and(
                      eq(submissions.id, submissionId),
                      eq(submissions.eventId, sessionFileRequirements.eventId),
                    ),
                  )
                  .innerJoin(
                    submissionParticipants,
                    and(
                      eq(submissionParticipants.submissionId, submissions.id),
                      eq(submissionParticipants.contactId, contactId),
                    ),
                  )
                  .where(
                    and(
                      eq(sessionFileRequirements.id, requirementId),
                      eq(submissions.status, "accepted"),
                    ),
                  )
                  .limit(1)
                  .execute(),
            );
            const requirement = requirementRows[0]?.requirement;
            if (requirement === undefined) {
              return yield* Effect.fail(
                new Forbidden({ message: "You cannot upload files for this session" }),
              );
            }
            if (requirement.maxSizeMb !== null && size > requirement.maxSizeMb * 1024 * 1024) {
              return yield* Effect.fail(
                new InvalidInput({
                  message: `Files for ${requirement.title} must be ${requirement.maxSizeMb} MB or smaller`,
                }),
              );
            }
            if (requirement.acceptTypes !== null) {
              const accepted = requirement.acceptTypes
                .split(",")
                .map((type) => type.trim().toLowerCase())
                .filter((type) => type.length > 0);
              const lowerFilename = filename.toLowerCase();
              if (!accepted.some((extension) => lowerFilename.endsWith(extension))) {
                return yield* Effect.fail(
                  new InvalidInput({
                    message: `${requirement.title} accepts ${accepted.join(", ")}`,
                  }),
                );
              }
            }
          } else if (kind === "slides") {
            return yield* Effect.fail(
              new InvalidInput({ message: "Choose a session file requirement" }),
            );
          }
          if (assignmentId !== null) {
            const row = yield* assignmentForSpeaker(contactId, assignmentId);
            if (row.template.fileRequestId === null) {
              return yield* Effect.fail(
                new Forbidden({ message: "This task has no file request" }),
              );
            }
            fileRequestId = row.template.fileRequestId;
          }
          if (kind === "request" && fileRequestId === null) {
            return yield* Effect.fail(new InvalidInput({ message: "Choose a file request" }));
          }
          const existing = yield* query(database, "Could not load uploaded file", (db) =>
            db
              .select()
              .from(fileUploads)
              .where(
                and(
                  requirementId === null ? eq(fileUploads.contactId, contactId) : undefined,
                  eq(fileUploads.kind, kind),
                  requirementId === null
                    ? fileRequestId === null
                      ? eq(fileUploads.kind, kind)
                      : eq(fileUploads.fileRequestId, fileRequestId)
                    : eq(fileUploads.requirementId, requirementId),
                  submissionId === null ? undefined : eq(fileUploads.submissionId, submissionId),
                ),
              )
              .limit(1)
              .execute(),
          );
          const upload =
            existing[0] ??
            (yield* query(database, "Could not create uploaded file", (db) =>
              db
                .insert(fileUploads)
                .values({
                  fileRequestId,
                  requirementId,
                  kind,
                  contactId,
                  submissionId,
                  speakerLastReadAt: new Date(),
                  adminLastReadAt: null,
                })
                .returning()
                .execute(),
            ).pipe(Effect.map((rows) => rows[0]!)));
          return { fileUploadId: upload.id, completeAssignmentId: assignmentId };
        }),
      recordFileVersion: (input) =>
        Effect.gen(function* () {
          const versionRows = yield* query(database, "Could not record file version", (db) =>
            db
              .insert(fileVersions)
              .values({
                fileUploadId: input.fileUploadId,
                storageKey: input.storageKey,
                filename: input.filename,
                contentType: input.contentType,
                size: input.size,
                uploaderContactId: input.uploaderContactId,
                uploaderEventMemberId: input.uploaderEventMemberId,
                uploaderName: input.uploaderName,
                uploadedAt: new Date(),
              })
              .returning()
              .execute(),
          );
          yield* query(database, "Could not update uploaded file", (db) =>
            db
              .update(fileUploads)
              .set({ updatedAt: new Date() })
              .where(eq(fileUploads.id, input.fileUploadId))
              .execute(),
          );
          if (input.headshotContactId !== null) {
            const headshotContactId = input.headshotContactId;
            yield* query(database, "Could not update speaker headshot", (db) =>
              db.transaction(async (transaction) => {
                const existingRows = await transaction
                  .select()
                  .from(contacts)
                  .where(eq(contacts.id, headshotContactId))
                  .limit(1);
                const existing = existingRows[0];
                if (existing === undefined) return;
                const now = new Date();
                // Headshots follow the profile approval contract too: a
                // confirmed speaker's new upload waits for organizer review.
                const requiresReview = existing.confirmedAt !== null;
                if (requiresReview) {
                  await transaction.insert(contactEditHistory).values({
                    contactId: headshotContactId,
                    authorContactId: headshotContactId,
                    authorEventMemberId: null,
                    authorName: `${existing.firstName} ${existing.lastName}`,
                    changedFields: ["headshotKey", "headshotUrl"],
                    previousValues: {
                      headshotKey: existing.headshotKey,
                      headshotUrl: existing.headshotUrl,
                    },
                    newValues: { headshotKey: input.storageKey, headshotUrl: null },
                    approvalStatus: "pending_review",
                    reviewedAt: null,
                    reviewedByEventMemberId: null,
                  });
                }
                await transaction
                  .update(contacts)
                  .set({
                    headshotKey: input.storageKey,
                    headshotUrl: null,
                    ...(requiresReview
                      ? {
                          approvedProfile: approvedBaseline(existing),
                          profileReviewStatus: "pending_review" as const,
                        }
                      : {}),
                    updatedAt: now,
                  })
                  .where(eq(contacts.id, headshotContactId));
              }),
            );
          }
          if (input.completeAssignmentId !== null)
            yield* setTaskStatus(input.completeAssignmentId, "done");
          return versionRows[0];
        }),
      addSpeakerComment: (contactId, fileUploadId, name, body) =>
        Effect.gen(function* () {
          const owned = yield* query(database, "Could not verify uploaded file", (db) =>
            db
              .selectDistinct({ id: fileUploads.id })
              .from(fileUploads)
              .leftJoin(
                submissionParticipants,
                eq(submissionParticipants.submissionId, fileUploads.submissionId),
              )
              .where(
                and(
                  eq(fileUploads.id, fileUploadId),
                  or(
                    eq(fileUploads.contactId, contactId),
                    and(
                      isNotNull(fileUploads.requirementId),
                      eq(submissionParticipants.contactId, contactId),
                    ),
                  ),
                ),
              )
              .limit(1)
              .execute(),
          );
          if (owned.length === 0)
            return yield* Effect.fail(
              new Forbidden({ message: "You cannot comment on this file" }),
            );
          const rows = yield* query(database, "Could not add file comment", (db) =>
            db
              .insert(fileComments)
              .values({
                fileUploadId,
                authorContactId: contactId,
                authorEventMemberId: null,
                authorName: name,
                body,
              })
              .returning()
              .execute(),
          );
          return rows[0];
        }),
      addAdminComment: (eventId, userId, fileUploadId, name, body) =>
        Effect.gen(function* () {
          const member = yield* memberForAdmin(eventId, userId);
          const owned = yield* query(database, "Could not verify uploaded file", (db) =>
            db
              .select({ id: fileUploads.id })
              .from(fileUploads)
              .innerJoin(contacts, eq(contacts.id, fileUploads.contactId))
              .where(and(eq(fileUploads.id, fileUploadId), eq(contacts.eventId, eventId)))
              .limit(1)
              .execute(),
          );
          if (owned.length === 0)
            return yield* Effect.fail(
              new Forbidden({ message: "You cannot comment on this file" }),
            );
          const rows = yield* query(database, "Could not add file comment", (db) =>
            db
              .insert(fileComments)
              .values({
                fileUploadId,
                authorContactId: null,
                authorEventMemberId: member.id,
                authorName: name,
                body,
              })
              .returning()
              .execute(),
          );
          return rows[0];
        }),
      getVersionForActor: (versionId, actor) =>
        Effect.gen(function* () {
          const rows = yield* query(database, "Could not load file version", (db) =>
            db
              .select({ version: fileVersions, upload: fileUploads, contact: contacts })
              .from(fileVersions)
              .innerJoin(fileUploads, eq(fileUploads.id, fileVersions.fileUploadId))
              .innerJoin(contacts, eq(contacts.id, fileUploads.contactId))
              .where(eq(fileVersions.id, versionId))
              .limit(1)
              .execute(),
          );
          const row = rows[0];
          if (row === undefined)
            return yield* Effect.fail(new Forbidden({ message: "You cannot download this file" }));
          const staff =
            actor.userId === undefined
              ? []
              : yield* query(database, "Could not verify file access", (db) =>
                  db
                    .select({ id: eventMembers.id })
                    .from(eventMembers)
                    .where(
                      and(
                        eq(eventMembers.eventId, row.contact.eventId),
                        eq(eventMembers.userId, actor.userId!),
                      ),
                    )
                    .limit(1)
                    .execute(),
                );
          const actorContactId = actor.contactId;
          const assetSubmissionId = row.upload.submissionId;
          const participantAccess =
            actorContactId === undefined ||
            row.upload.requirementId === null ||
            assetSubmissionId === null
              ? []
              : yield* query(database, "Could not verify session file access", (db) =>
                  db
                    .select({ id: submissionParticipants.id })
                    .from(submissionParticipants)
                    .where(
                      and(
                        eq(submissionParticipants.submissionId, assetSubmissionId),
                        eq(submissionParticipants.contactId, actorContactId),
                      ),
                    )
                    .limit(1)
                    .execute(),
                );
          const allowed =
            (actor.contactId !== undefined && row.upload.contactId === actor.contactId) ||
            participantAccess.length > 0 ||
            staff.length > 0;
          if (!allowed)
            return yield* Effect.fail(new Forbidden({ message: "You cannot download this file" }));
          return row.version;
        }),
      saveTaskTemplate: (input) =>
        Effect.gen(function* () {
          const positionRows = yield* query(database, "Could not count task templates", (db) =>
            db
              .select({ id: taskTemplates.id })
              .from(taskTemplates)
              .where(eq(taskTemplates.eventId, input.eventId))
              .execute(),
          );
          const values = {
            eventId: input.eventId,
            title: input.title,
            instructions: input.instructions,
            scope: input.scope,
            portalFormId: input.portalFormId,
            fileRequestId: input.fileRequestId,
            autoAssignOnAccept: input.autoAssignOnAccept,
            dueDate: input.dueDate === null ? null : new Date(input.dueDate),
            position: positionRows.length + 1,
          };
          const rows = yield* query(database, "Could not save task template", (db) =>
            input.id === null
              ? db.insert(taskTemplates).values(values).returning().execute()
              : db
                  .update(taskTemplates)
                  .set({ ...values, updatedAt: new Date() })
                  .where(eq(taskTemplates.id, input.id))
                  .returning()
                  .execute(),
          );
          return rows[0];
        }),
      waiveAssignment: (eventId, assignmentId) =>
        Effect.gen(function* () {
          const owned = yield* query(database, "Could not verify task assignment", (db) =>
            db
              .select({ id: taskAssignments.id })
              .from(taskAssignments)
              .innerJoin(taskTemplates, eq(taskTemplates.id, taskAssignments.taskTemplateId))
              .where(and(eq(taskAssignments.id, assignmentId), eq(taskTemplates.eventId, eventId)))
              .limit(1)
              .execute(),
          );
          if (owned.length === 0)
            return yield* Effect.fail(new Forbidden({ message: "You cannot waive this task" }));
          const rows = yield* setTaskStatus(assignmentId, "waived");
          return rows[0];
        }),
      manualAssign: (input) =>
        Effect.gen(function* () {
          if ((input.contactId === null) === (input.submissionId === null)) {
            return yield* Effect.fail(
              new InvalidInput({ message: "Choose one contact or submission" }),
            );
          }
          const rows = yield* query(database, "Could not assign task", (db) =>
            db
              .insert(taskAssignments)
              .values({
                taskTemplateId: input.taskTemplateId,
                contactId: input.contactId,
                submissionId: input.submissionId,
                status: "todo",
                completedAt: null,
              })
              .onConflictDoNothing()
              .returning()
              .execute(),
          );
          return rows[0] ?? null;
        }),
      savePortalForm: (input) =>
        query(database, "Could not save portal form", (db) =>
          input.id === null
            ? db
                .insert(portalForms)
                .values({ ...input, id: undefined })
                .returning()
                .execute()
            : db
                .update(portalForms)
                .set({ ...input, id: undefined, updatedAt: new Date() })
                .where(eq(portalForms.id, input.id))
                .returning()
                .execute(),
        ).pipe(Effect.map((rows) => rows[0])),
      createFileRequest: (input) =>
        query(database, "Could not create file request", (db) =>
          db.insert(fileRequests).values(input).returning().execute(),
        ).pipe(Effect.map((rows) => rows[0])),
      saveSessionFileRequirement: (input) =>
        Effect.gen(function* () {
          const requirementId = input.id;
          const existing =
            requirementId === null
              ? []
              : yield* query(database, "Could not load session file requirement", (db) =>
                  db
                    .select()
                    .from(sessionFileRequirements)
                    .where(
                      and(
                        eq(sessionFileRequirements.id, requirementId),
                        eq(sessionFileRequirements.eventId, input.eventId),
                      ),
                    )
                    .limit(1)
                    .execute(),
                );
          const positions = yield* query(
            database,
            "Could not order session file requirement",
            (db) =>
              db
                .select({ id: sessionFileRequirements.id })
                .from(sessionFileRequirements)
                .where(eq(sessionFileRequirements.eventId, input.eventId))
                .execute(),
          );
          const values = {
            eventId: input.eventId,
            title: input.title.trim(),
            description: input.description.trim(),
            dueAt: input.dueAt === null ? null : new Date(input.dueAt),
            acceptTypes:
              input.acceptTypes === null || input.acceptTypes.trim().length === 0
                ? null
                : input.acceptTypes.trim(),
            maxSizeMb: input.maxSizeMb,
            position: existing[0]?.position ?? positions.length + 1,
          };
          return yield* query(database, "Could not save session file requirement", (db) =>
            requirementId === null
              ? db.insert(sessionFileRequirements).values(values).returning().execute()
              : db
                  .update(sessionFileRequirements)
                  .set({ ...values, updatedAt: new Date() })
                  .where(
                    and(
                      eq(sessionFileRequirements.id, requirementId),
                      eq(sessionFileRequirements.eventId, input.eventId),
                    ),
                  )
                  .returning()
                  .execute(),
          ).pipe(Effect.map((rows) => rows[0]));
        }),
      reviewContent: (eventId, userId, historyId, decision) =>
        Effect.gen(function* () {
          const member = yield* memberForAdmin(eventId, userId);
          const rows = yield* query(database, "Could not load pending content edit", (db) =>
            db
              .select({ history: submissionEditHistory, submission: submissions })
              .from(submissionEditHistory)
              .innerJoin(submissions, eq(submissions.id, submissionEditHistory.submissionId))
              .where(
                and(
                  eq(submissionEditHistory.id, historyId),
                  eq(submissions.eventId, eventId),
                  eq(submissionEditHistory.approvalStatus, "pending_review"),
                ),
              )
              .limit(1)
              .execute(),
          );
          const row = rows[0];
          if (row === undefined)
            return yield* Effect.fail(
              new Forbidden({ message: "This content edit is not pending" }),
            );
          const current = yield* decode(Submission, "Submission", row.submission);
          const approved = yield* applyContentPatch(snapshot(current), current.approvedSnapshot);
          const newValues = yield* decodeJsonRecord(row.history.newValues);
          const nextApproved =
            decision === "approved" ? yield* applyContentPatch(approved, newValues) : approved;
          const nextCurrent = decision === "approved" ? snapshot(current) : approved;
          yield* query(database, "Could not review content edit", (db) =>
            db
              .update(submissionEditHistory)
              .set({
                approvalStatus: decision,
                reviewedAt: new Date(),
                reviewedByEventMemberId: member.id,
                updatedAt: new Date(),
              })
              .where(eq(submissionEditHistory.id, historyId))
              .execute(),
          );
          const pending = yield* query(database, "Could not count pending content edits", (db) =>
            db
              .select({ id: submissionEditHistory.id })
              .from(submissionEditHistory)
              .where(
                and(
                  eq(submissionEditHistory.submissionId, current.id),
                  eq(submissionEditHistory.approvalStatus, "pending_review"),
                ),
              )
              .execute(),
          );
          const updatedRows = yield* query(
            database,
            "Could not update approved submission content",
            (db) =>
              db
                .update(submissions)
                .set({
                  ...contentUpdate(nextCurrent),
                  approvedSnapshot: nextApproved,
                  contentReviewStatus: pending.length === 0 ? "approved" : "pending_review",
                  updatedAt: new Date(),
                })
                .where(eq(submissions.id, current.id))
                .returning()
                .execute(),
          );
          return yield* decodeFound(Submission, "Submission", updatedRows[0]);
        }),
      reviewProfile: (eventId, userId, historyId, decision) =>
        Effect.gen(function* () {
          const member = yield* memberForAdmin(eventId, userId);
          const rows = yield* query(database, "Could not load pending profile edit", (db) =>
            db
              .select({ history: contactEditHistory, contact: contacts })
              .from(contactEditHistory)
              .innerJoin(contacts, eq(contacts.id, contactEditHistory.contactId))
              .where(
                and(
                  eq(contactEditHistory.id, historyId),
                  eq(contacts.eventId, eventId),
                  eq(contactEditHistory.approvalStatus, "pending_review"),
                ),
              )
              .limit(1)
              .execute(),
          );
          const row = rows[0];
          if (row === undefined)
            return yield* Effect.fail(
              new Forbidden({ message: "This profile edit is not pending" }),
            );
          const newValues = yield* decodeJsonRecord(row.history.newValues);
          const approved = yield* decodeJsonRecord(row.contact.approvedProfile);
          const nextApproved = decision === "approved" ? { ...approved, ...newValues } : approved;
          yield* query(database, "Could not review profile edit", (db) =>
            db
              .update(contactEditHistory)
              .set({
                approvalStatus: decision,
                reviewedAt: new Date(),
                reviewedByEventMemberId: member.id,
                updatedAt: new Date(),
              })
              .where(eq(contactEditHistory.id, historyId))
              .execute(),
          );
          const pending = yield* query(database, "Could not count pending profile edits", (db) =>
            db
              .select({ id: contactEditHistory.id })
              .from(contactEditHistory)
              .where(
                and(
                  eq(contactEditHistory.contactId, row.contact.id),
                  eq(contactEditHistory.approvalStatus, "pending_review"),
                ),
              )
              .execute(),
          );
          // Rejection reverts the live row to the approved values for the
          // fields this edit touched; approval folds them into the snapshot.
          const revert =
            decision === "rejected"
              ? (Object.fromEntries(
                  row.history.changedFields
                    .filter((key): key is ProfileKey =>
                      (profileKeys as ReadonlyArray<string>).includes(key),
                    )
                    .map((key) => [key, approved[key] ?? null]),
                ) as Partial<typeof contacts.$inferInsert>)
              : {};
          const updatedRows = yield* query(
            database,
            "Could not update approved profile content",
            (db) =>
              db
                .update(contacts)
                .set({
                  ...revert,
                  approvedProfile: nextApproved,
                  profileReviewStatus: pending.length === 0 ? "approved" : "pending_review",
                  updatedAt: new Date(),
                })
                .where(eq(contacts.id, row.contact.id))
                .returning()
                .execute(),
          );
          return yield* decodeFound(Contact, "Contact", updatedRows[0]);
        }),
      acceptSubmission: (eventId, submissionId) =>
        Effect.gen(function* () {
          const loaded = yield* query(database, "Could not load submission", (db) =>
            db
              .select()
              .from(submissions)
              .where(and(eq(submissions.id, submissionId), eq(submissions.eventId, eventId)))
              .limit(1)
              .execute(),
          );
          const current = yield* decodeFound(Submission, "Submission", loaded[0]);
          const approvedSnapshot = snapshot(current);
          const updatedRows = yield* query(database, "Could not accept submission", (db) =>
            db
              .update(submissions)
              // Accepted abstracts graduate into sessions (Sessionboard
              // lifecycle); the row keeps its code, reviews, and history.
              .set({
                status: "accepted",
                kind: "session",
                approvedSnapshot,
                contentReviewStatus: "approved",
                updatedAt: new Date(),
              })
              .where(eq(submissions.id, submissionId))
              .returning()
              .execute(),
          );
          const [participants, templates] = yield* Effect.all([
            query(database, "Could not load submission speakers", (db) =>
              db
                .select()
                .from(submissionParticipants)
                .where(eq(submissionParticipants.submissionId, submissionId))
                .execute(),
            ),
            query(database, "Could not load automatic tasks", (db) =>
              db
                .select()
                .from(taskTemplates)
                .where(
                  and(
                    eq(taskTemplates.eventId, eventId),
                    eq(taskTemplates.autoAssignOnAccept, true),
                  ),
                )
                .execute(),
            ),
          ]);
          const contactIds = Array.from(
            new Set(participants.map((participant) => participant.contactId)),
          );
          const assignments: Array<typeof taskAssignments.$inferInsert> = [];
          for (const template of templates) {
            if (template.scope === "submission") {
              assignments.push({
                taskTemplateId: template.id,
                contactId: null,
                submissionId,
                status: "todo",
                completedAt: null,
              });
              continue;
            }
            for (const contactId of contactIds) {
              assignments.push({
                taskTemplateId: template.id,
                contactId,
                submissionId: null,
                status: "todo",
                completedAt: null,
              });
            }
          }
          if (assignments.length > 0) {
            yield* query(database, "Could not assign automatic tasks", (db) =>
              db.insert(taskAssignments).values(assignments).onConflictDoNothing().execute(),
            );
          }
          return yield* decodeFound(Submission, "Submission", updatedRows[0]);
        }),
    };
  }),
);
