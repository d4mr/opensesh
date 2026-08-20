import {
  AdminFilesExportRequest,
  AdminSessionContentRequest,
  buildZip,
  AdminAssignmentRequest,
  ContentReviewRequest,
  DbError,
  FileCommentRequest,
  FileRequestMutationRequest,
  FileUploadRequest,
  FileVersionRequest,
  Forbidden,
  InvalidInput,
  ManualAssignRequest,
  PortalFormMutationRequest,
  PortalFormResponseRequest,
  PortalProfileUpdateRequest,
  PortalSubmissionEditRequest,
  PortalSubmissionParticipantsRequest,
  PortalSubmissionRequest,
  RestoreHistoryRequest,
  SessionFileRequirementMutationRequest,
  SessionFileRequirementDeleteRequest,
  PortalSessionCancelRequest,
  TaskAssignmentRequest,
  TaskTemplateMutationRequest,
} from "@opensesh/domain";
import { editCfpParticipants } from "@opensesh/domain/server/cfp";
import { getCurrentUser, requireEventAccess } from "@opensesh/domain/server/current-user";
import { Contacts, Events, Portal, Sessions, SpeakerComms } from "@opensesh/domain/server/repos";
import { Mail } from "@opensesh/domain/server/mail";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Effect, Schema } from "effect";

import { previewContactIdFromCookieHeader } from "@/lib/portal-preview";
import { MailQueue } from "@/server/mail-queue";
import { runServer } from "@/server/runtime";

const requireSpeaker = Effect.fn("requirePortalSpeaker")(function* () {
  const user = yield* getCurrentUser;
  const contactId = user.roles.contactId;
  if (contactId === undefined) {
    return yield* Effect.fail(new Forbidden({ message: "You do not have a speaker portal" }));
  }
  return { user, contactId };
});

const requireAdminEvent = (eventId: string) => requireEventAccess(eventId, "admin");

export const getSpeakerPortal = createServerFn({ method: "GET" }).handler(async () => {
  const previewContactId = previewContactIdFromCookieHeader(getRequest().headers.get("cookie"));
  return runServer(
    Effect.gen(function* () {
      const user = yield* getCurrentUser;
      const portal = yield* Portal;
      const staff = user.roles.admin || user.roles.reviewer || user.roles.member;
      // Staff impersonation wins even for an admin who is also a speaker —
      // the picker is how they get back to any view, their own included.
      if (staff && user.eventSlug !== null && previewContactId !== null) {
        const events = yield* Events;
        const event = yield* events.getBySlug(user.eventSlug);
        const contacts = yield* Contacts;
        const requested = yield* contacts
          .get(previewContactId)
          .pipe(Effect.catchTag("NotFound", () => Effect.succeed(null)));
        // A pinned contact from another event (or a reseeded one) simply
        // falls through to the defaults below.
        if (event.organizationId === user.orgId && requested?.eventId === event.id) {
          const bootstrap = yield* portal.speakerBootstrap(requested.id);
          return {
            ...bootstrap,
            preview: {
              contactId: requested.id,
              contactName: `${requested.firstName} ${requested.lastName}`,
            },
          };
        }
      }
      if (user.roles.contactId !== undefined) {
        return yield* portal.speakerBootstrap(user.roles.contactId);
      }
      if (!staff) {
        return yield* Effect.fail(new Forbidden({ message: "You do not have a speaker portal" }));
      }
      if (user.eventSlug === null) {
        return yield* Effect.fail(new Forbidden({ message: "There is no event to preview" }));
      }
      const events = yield* Events;
      const event = yield* events.getBySlug(user.eventSlug);
      if (event.organizationId !== user.orgId) {
        return yield* Effect.fail(new Forbidden({ message: "You cannot preview this event" }));
      }
      const contacts = yield* Contacts;
      const contact = yield* contacts.findPreviewByEvent(event.id).pipe(
        Effect.catchTag("NotFound", () =>
          Effect.fail(
            new Forbidden({
              message:
                "This event has no speakers to preview yet. Add a speaker or accept a submission first.",
            }),
          ),
        ),
      );
      const bootstrap = yield* portal.speakerBootstrap(contact.id);
      return {
        ...bootstrap,
        preview: {
          contactId: contact.id,
          contactName: `${contact.firstName} ${contact.lastName}`,
        },
      };
    }),
    { require: "session" },
  );
});

export const getPortalAdmin = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ eventId: Schema.String })))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user } = yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        return yield* portal.adminBootstrap(data.eventId, {
          userId: user.userId,
          name: user.name,
        });
      }),
      { require: "staff" },
    ),
  );

export const searchEventContacts = createServerFn({ method: "GET" })
  .validator(
    Schema.toStandardSchemaV1(Schema.Struct({ eventId: Schema.String, query: Schema.String })),
  )
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const contacts = yield* Contacts;
        const query = data.query.trim().toLocaleLowerCase();
        // Speakerhood is derived (accepted submission or explicitly added),
        // not the raw participation column — badge accordingly.
        const [rows, speakerRows] = yield* Effect.all(
          [contacts.listAllByEvent(data.eventId), contacts.listByEvent(data.eventId)],
          { concurrency: "unbounded" },
        );
        const speakerIds = new Set(speakerRows.map((contact) => contact.id));
        return rows
          .filter((contact) =>
            [contact.firstName, contact.lastName, contact.email, contact.title, contact.company]
              .filter((value): value is string => value !== null)
              .join(" ")
              .toLocaleLowerCase()
              .includes(query),
          )
          .slice(0, 200)
          .map((contact) => ({ ...contact, speaker: speakerIds.has(contact.id) }));
      }),
      { require: "staff" },
    ),
  );

export const getEventContactProfile = createServerFn({ method: "GET" })
  .validator(
    Schema.toStandardSchemaV1(Schema.Struct({ eventId: Schema.String, contactId: Schema.String })),
  )
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const contacts = yield* Contacts;
        const contact = yield* contacts.get(data.contactId);
        if (contact.eventId !== data.eventId) {
          return yield* Effect.fail(
            new Forbidden({ message: "This person does not belong to the event" }),
          );
        }
        const portal = yield* Portal;
        const user = yield* getCurrentUser;
        const admin = yield* portal.adminBootstrap(data.eventId, {
          userId: user.userId,
          name: user.name,
        });
        const sessionCount = new Set(
          admin.participants
            .filter((row) => row.contact.id === contact.id && row.submission.status === "accepted")
            .map((row) => row.submission.id),
        ).size;
        return {
          contact: {
            ...contact,
            pipeline:
              admin.contacts.find((candidate) => candidate.id === contact.id)?.pipeline ?? null,
          },
          sessionCount,
        };
      }),
      { require: "staff" },
    ),
  );

export const updateAdminSessionContent = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(AdminSessionContentRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user } = yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        return yield* portal.editAdminSubmission(
          data.eventId,
          { userId: user.userId, name: user.name },
          data.submissionId,
          data.title,
          data.description,
        );
      }),
      { require: "staff" },
    ),
  );

// Seeded upload rows reference `seed/…` keys that have no stored object;
// serve a deterministic placeholder so demo downloads and exports work.
const SEED_PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 68>>stream
BT /F1 18 Tf 72 720 Td (OpenSesh demo fixture file) Tj ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`;
export const seedPlaceholder = (storageKey: string, contentType: string): Uint8Array | null => {
  if (!storageKey.startsWith("seed/")) return null;
  if (contentType.includes("pdf")) return new TextEncoder().encode(SEED_PDF);
  return new TextEncoder().encode(`OpenSesh demo fixture file (${storageKey})`);
};

const safeZipSegment = (value: string, fallback: string) =>
  value
    .replaceAll("/", "-")
    .replaceAll("\\", "-")
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .trim() || fallback;

export const exportAdminFilesZip = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(AdminFilesExportRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    return runServer(
      Effect.gen(function* () {
        const { user } = yield* requireAdminEvent(data.eventId);
        const selectedIds = new Set(data.uploadIds);
        if (selectedIds.size === 0) {
          return yield* Effect.fail(new InvalidInput({ message: "Select at least one file" }));
        }
        const portal = yield* Portal;
        const admin = yield* portal.adminBootstrap(data.eventId, {
          userId: user.userId,
          name: user.name,
        });
        const selected = admin.files.filter((row) => selectedIds.has(row.upload.id));
        if (selected.length !== selectedIds.size) {
          return yield* Effect.fail(
            new Forbidden({ message: "One or more selected files are unavailable" }),
          );
        }
        const entries = yield* Effect.forEach(
          selected,
          (row) =>
            Effect.gen(function* () {
              const latest = admin.versions
                .map((item) => item.version)
                .filter((version) => version.fileUploadId === row.upload.id)
                .sort(
                  (left, right) =>
                    new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime(),
                )[0];
              if (latest === undefined) {
                return yield* Effect.fail(
                  new InvalidInput({ message: "A selected file has no uploaded version" }),
                );
              }
              const object = yield* Effect.tryPromise({
                try: () => env.FILES.get(latest.storageKey),
                catch: (cause) => new DbError({ message: "Could not load an export file", cause }),
              });
              const fallback =
                object === null ? seedPlaceholder(latest.storageKey, latest.contentType) : null;
              if (object === null && fallback === null) {
                return yield* Effect.fail(
                  new DbError({ message: "A selected export file is missing", cause: latest.id }),
                );
              }
              const bytes =
                object === null
                  ? (fallback as Uint8Array)
                  : new Uint8Array(yield* Effect.promise(() => object.arrayBuffer()));
              const group =
                data.grouping === "session"
                  ? safeZipSegment(row.submission?.code ?? "No session", "No session")
                  : safeZipSegment(
                      `${row.contact.firstName} ${row.contact.lastName}`,
                      "Unknown speaker",
                    );
              return {
                path: `${group}/${safeZipSegment(latest.filename, "file")}`,
                bytes,
              };
            }),
          { concurrency: 5 },
        );
        const zip = buildZip(entries);
        let binary = "";
        for (const byte of zip) binary += String.fromCharCode(byte);
        return {
          filename: `event-files-by-${data.grouping}.zip`,
          contentType: "application/zip",
          count: entries.length,
          base64: btoa(binary),
        };
      }),
      { require: "staff" },
    );
  });

export const updatePortalProfile = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(PortalProfileUpdateRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { contactId } = yield* requireSpeaker();
        const portal = yield* Portal;
        return yield* portal.updateProfile(contactId, data);
      }),
      { require: "speaker" },
    ),
  );

export const confirmPortalParticipation = createServerFn({ method: "POST" }).handler(async () =>
  runServer(
    Effect.gen(function* () {
      const { contactId } = yield* requireSpeaker();
      const portal = yield* Portal;
      return yield* portal.confirmParticipation(contactId);
    }),
    { require: "speaker" },
  ),
);

// The speaker's own session cancellation: same lifecycle transition as the
// admin cancel, cause "speaker", always notifying (the speaker gets the
// confirmation email, the organizer sees it on the desk and timeline).
export const cancelPortalSession = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(PortalSessionCancelRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { contactId } = yield* requireSpeaker();
        const portal = yield* Portal;
        yield* portal.assertSubmitter(contactId, data.submissionId);
        const contacts = yield* Contacts;
        const contact = yield* contacts.get(contactId);
        const sessions = yield* Sessions;
        const mail = yield* Mail;
        const cancelled = yield* sessions.cancel({
          eventId: contact.eventId,
          submissionId: data.submissionId,
          cause: "speaker",
          message: data.message,
          notifySpeakers: true,
          actor: {
            kind: "contact",
            contactId,
            name: `${contact.firstName} ${contact.lastName}`,
          },
        });
        yield* Effect.forEach(cancelled.logIds, (logId) => mail.sendQueued(logId), {
          concurrency: 5,
        });
        return cancelled.result;
      }),
      { require: "speaker" },
    ),
  );

export const withdrawPortalSubmission = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(PortalSubmissionRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { contactId } = yield* requireSpeaker();
        const portal = yield* Portal;
        return yield* portal.withdrawSubmission(contactId, data.submissionId);
      }),
      { require: "speaker" },
    ),
  );

export const editPortalSubmission = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(PortalSubmissionEditRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { contactId } = yield* requireSpeaker();
        const portal = yield* Portal;
        return yield* portal.editSubmission(contactId, data.submissionId, data.answers);
      }),
      { require: "speaker" },
    ),
  );

export const editPortalParticipants = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(PortalSubmissionParticipantsRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { contactId } = yield* requireSpeaker();
        const result = yield* editCfpParticipants(contactId, data.submissionId, data.participants);
        // Being added to the lineup grants portal access: newly added
        // co-speakers get their tokened invitation right away.
        if (result.addedContactIds.length > 0) {
          const comms = yield* SpeakerComms;
          const logIds = yield* comms.queueCoSpeakerInvitations({
            eventId: result.eventId,
            submissionId: data.submissionId,
            contactIds: result.addedContactIds,
            portalOrigin: new URL(getRequest().url).origin,
          });
          const queue = yield* MailQueue;
          yield* queue.enqueue(logIds);
        }
        return result.participants;
      }),
      { require: "speaker" },
    ),
  );

export const restorePortalHistory = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(RestoreHistoryRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { contactId } = yield* requireSpeaker();
        const portal = yield* Portal;
        return yield* portal.restoreHistory(data.historyId, {
          contactId,
        });
      }),
      { require: "speaker" },
    ),
  );

export const restoreAdminHistory = createServerFn({ method: "POST" })
  .validator(
    Schema.toStandardSchemaV1(Schema.Struct({ eventId: Schema.String, historyId: Schema.String })),
  )
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user } = yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        return yield* portal.restoreHistory(data.historyId, {
          user: { userId: user.userId, name: user.name },
        });
      }),
      { require: "staff" },
    ),
  );

export const completePortalTask = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(TaskAssignmentRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { contactId } = yield* requireSpeaker();
        const portal = yield* Portal;
        return yield* portal.completeTask(contactId, data.assignmentId);
      }),
      { require: "speaker" },
    ),
  );

export const submitPortalFormResponse = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(PortalFormResponseRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { contactId } = yield* requireSpeaker();
        const portal = yield* Portal;
        return yield* portal.submitPortalForm(contactId, data.assignmentId, data.answers);
      }),
      { require: "speaker" },
    ),
  );

const decodeBase64 = (base64: string) => {
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

export const uploadPortalFile = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(FileUploadRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    return await runServer(
      Effect.gen(function* () {
        const { contactId } = yield* requireSpeaker();
        const portal = yield* Portal;
        if (data.requirementId === null && data.size > 8 * 1024 * 1024) {
          return yield* Effect.fail(new InvalidInput({ message: "Files must be 8 MB or smaller" }));
        }
        const bytes = decodeBase64(data.base64);
        if (bytes.byteLength !== data.size) {
          return yield* Effect.fail(
            new InvalidInput({ message: "The uploaded file is incomplete" }),
          );
        }
        const prepared = yield* portal.prepareFileUpload(
          contactId,
          data.assignmentId,
          data.fileRequestId,
          data.submissionId,
          data.kind,
          data.requirementId,
          data.filename,
          data.size,
        );
        const storageKey = `${contactId}/${prepared.fileUploadId}/${crypto.randomUUID()}`;
        yield* Effect.tryPromise({
          try: () =>
            env.FILES.put(storageKey, bytes, {
              httpMetadata: {
                contentType: data.contentType || "application/octet-stream",
                contentDisposition: `attachment; filename="${data.filename.replaceAll('"', "")}"`,
              },
            }),
          catch: (cause) => new DbError({ message: "Could not store the uploaded file", cause }),
        });
        return yield* portal.recordFileVersion({
          fileUploadId: prepared.fileUploadId,
          storageKey,
          filename: data.filename,
          contentType: data.contentType || "application/octet-stream",
          size: data.size,
          uploaderContactId: contactId,
          uploaderUserId: null,
          headshotContactId: data.kind === "headshot" ? contactId : null,
          adminApproved: false,
          completeAssignmentId: prepared.completeAssignmentId,
        });
      }),
      { require: "speaker" },
    );
  });

export const downloadPortalFile = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(FileVersionRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    return await runServer(
      Effect.gen(function* () {
        const user = yield* getCurrentUser;
        const portal = yield* Portal;
        const version = yield* portal.getVersionForActor(data.versionId, {
          ...(user.roles.contactId === undefined ? {} : { contactId: user.roles.contactId }),
          ...(user.roles.admin || user.roles.reviewer ? { userId: user.userId } : {}),
        });
        const object = yield* Effect.tryPromise({
          try: () => env.FILES.get(version.storageKey),
          catch: (cause) => new DbError({ message: "Could not load the file", cause }),
        });
        const fallback =
          object === null ? seedPlaceholder(version.storageKey, version.contentType) : null;
        if (object === null && fallback === null) {
          return yield* Effect.fail(
            new DbError({ message: "The stored file is missing", cause: version }),
          );
        }
        const bytes =
          object === null
            ? (fallback as Uint8Array)
            : new Uint8Array(yield* Effect.promise(() => object.arrayBuffer()));
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return {
          filename: version.filename,
          contentType: version.contentType,
          base64: btoa(binary),
        };
      }),
      { require: "session" },
    );
  });

export const addPortalFileComment = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(FileCommentRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { contactId } = yield* requireSpeaker();
        if (data.body.trim().length === 0) {
          return yield* Effect.fail(new InvalidInput({ message: "Write a comment first" }));
        }
        const portal = yield* Portal;
        return yield* portal.addSpeakerComment(contactId, data.fileUploadId, data.body.trim());
      }),
      { require: "speaker" },
    ),
  );

export const addAdminFileComment = createServerFn({ method: "POST" })
  .validator(
    Schema.toStandardSchemaV1(
      Schema.Struct({ eventId: Schema.String, fileUploadId: Schema.String, body: Schema.String }),
    ),
  )
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user } = yield* requireAdminEvent(data.eventId);
        if (data.body.trim().length === 0) {
          return yield* Effect.fail(new InvalidInput({ message: "Write a comment first" }));
        }
        const portal = yield* Portal;
        return yield* portal.addAdminComment(
          data.eventId,
          { userId: user.userId, name: user.name },
          data.fileUploadId,
          data.body.trim(),
        );
      }),
      { require: "staff" },
    ),
  );

export const saveAdminTaskTemplate = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(TaskTemplateMutationRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        return yield* portal.saveTaskTemplate(data);
      }),
      { require: "staff" },
    ),
  );

export const waiveAdminAssignment = createServerFn({ method: "POST" })
  .validator(
    Schema.toStandardSchemaV1(
      Schema.Struct({ eventId: Schema.String, ...AdminAssignmentRequest.fields }),
    ),
  )
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        return yield* portal.waiveAssignment(data.eventId, data.assignmentId);
      }),
      { require: "staff" },
    ),
  );

export const manualAssignAdminTask = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ManualAssignRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        return yield* portal.manualAssign(data);
      }),
      { require: "staff" },
    ),
  );

export const saveAdminPortalForm = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(PortalFormMutationRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        return yield* portal.savePortalForm(data);
      }),
      { require: "staff" },
    ),
  );

export const createAdminFileRequest = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(FileRequestMutationRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        return yield* portal.createFileRequest(data);
      }),
      { require: "staff" },
    ),
  );

export const saveAdminSessionFileRequirement = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(SessionFileRequirementMutationRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        if (data.title.trim().length === 0) {
          return yield* Effect.fail(new InvalidInput({ message: "Add a requirement title" }));
        }
        if (data.maxSizeMb !== null && (!Number.isInteger(data.maxSizeMb) || data.maxSizeMb < 1)) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Size limit must be a whole number of megabytes" }),
          );
        }
        const portal = yield* Portal;
        return yield* portal.saveSessionFileRequirement(data);
      }),
      { require: "staff" },
    ),
  );

export const deleteAdminSessionFileRequirement = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(SessionFileRequirementDeleteRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        return yield* portal.deleteSessionFileRequirement(data.eventId, data.requirementId);
      }),
      { require: "staff" },
    ),
  );

export const approveSessionContent = createServerFn({ method: "POST" })
  .validator(
    Schema.toStandardSchemaV1(
      Schema.Struct({ eventId: Schema.String, submissionIds: Schema.Array(Schema.String) }),
    ),
  )
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user } = yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        const approved = yield* portal.approveSessionContent(data.eventId, data.submissionIds, {
          userId: user.userId,
          name: user.name,
        });
        return { approved };
      }),
      { require: "staff" },
    ),
  );

export const setSessionContentApproval = createServerFn({ method: "POST" })
  .validator(
    Schema.toStandardSchemaV1(
      Schema.Struct({
        eventId: Schema.String,
        submissionId: Schema.String,
        approved: Schema.Boolean,
      }),
    ),
  )
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user } = yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        if (!data.approved) {
          yield* portal.unapproveSessionContent(data.eventId, data.submissionId);
          return { approved: false };
        }
        const approved = yield* portal.approveSessionContent(data.eventId, [data.submissionId], {
          userId: user.userId,
          name: user.name,
        });
        return { approved: approved > 0 };
      }),
      { require: "staff" },
    ),
  );

export const approveContentChange = createServerFn({ method: "POST" })
  .validator(
    Schema.toStandardSchemaV1(
      Schema.Struct({ eventId: Schema.String, ...ContentReviewRequest.fields }),
    ),
  )
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user } = yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        return yield* portal.reviewContent(
          data.eventId,
          { userId: user.userId, name: user.name },
          data.historyId,
          "approved",
        );
      }),
      { require: "staff" },
    ),
  );

export const rejectContentChange = createServerFn({ method: "POST" })
  .validator(
    Schema.toStandardSchemaV1(
      Schema.Struct({ eventId: Schema.String, ...ContentReviewRequest.fields }),
    ),
  )
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user } = yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        return yield* portal.reviewContent(
          data.eventId,
          { userId: user.userId, name: user.name },
          data.historyId,
          "rejected",
        );
      }),
      { require: "staff" },
    ),
  );

export const approveProfileChange = createServerFn({ method: "POST" })
  .validator(
    Schema.toStandardSchemaV1(
      Schema.Struct({ eventId: Schema.String, ...ContentReviewRequest.fields }),
    ),
  )
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user } = yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        return yield* portal.reviewProfile(
          data.eventId,
          { userId: user.userId, name: user.name },
          data.historyId,
          "approved",
        );
      }),
      { require: "staff" },
    ),
  );

export const rejectProfileChange = createServerFn({ method: "POST" })
  .validator(
    Schema.toStandardSchemaV1(
      Schema.Struct({ eventId: Schema.String, ...ContentReviewRequest.fields }),
    ),
  )
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user } = yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        return yield* portal.reviewProfile(
          data.eventId,
          { userId: user.userId, name: user.name },
          data.historyId,
          "rejected",
        );
      }),
      { require: "staff" },
    ),
  );
