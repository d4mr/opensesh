import {
  AdminFilesExportRequest,
  AdminHeadshotUploadRequest,
  AdminSessionContentRequest,
  AdminSpeakerProfileRequest,
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
  PortalSubmissionRequest,
  RestoreHistoryRequest,
  SessionFileRequirementMutationRequest,
  TaskAssignmentRequest,
  TaskTemplateMutationRequest,
} from "@opensesh/domain";
import { getCurrentUser } from "@opensesh/domain/server/current-user";
import { Contacts, Events, Portal } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { runServer } from "@/server/runtime";

const requireSpeaker = Effect.fn("requirePortalSpeaker")(function* () {
  const user = yield* getCurrentUser;
  const contactId = user.roles.contactId;
  if (contactId === undefined) {
    return yield* Effect.fail(new Forbidden({ message: "You do not have a speaker portal" }));
  }
  return { user, contactId };
});

const requireAdminEvent = Effect.fn("requirePortalAdminEvent")(function* (eventId: string) {
  const user = yield* getCurrentUser;
  if (!user.roles.admin) {
    return yield* Effect.fail(new Forbidden({ message: "You cannot manage portal content" }));
  }
  const events = yield* Events;
  const event = yield* events.get(eventId);
  if (event.organizationId !== user.orgId) {
    return yield* Effect.fail(new Forbidden({ message: "You cannot manage this event" }));
  }
  return { user, event };
});

export const getSpeakerPortal = createServerFn({ method: "GET" }).handler(async () =>
  runServer(
    Effect.gen(function* () {
      const user = yield* getCurrentUser;
      const portal = yield* Portal;
      if (user.roles.contactId !== undefined) {
        return yield* portal.speakerBootstrap(user.roles.contactId);
      }
      if (!user.roles.admin && !user.roles.reviewer && !user.roles.member) {
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
      const contact = yield* contacts.findPreviewByEvent(event.id);
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
  ),
);

export const getPortalAdmin = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ eventId: Schema.String })))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user } = yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        return yield* portal.adminBootstrap(data.eventId, user.userId);
      }),
      { require: "admin" },
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
        const rows = yield* contacts.listByEvent(data.eventId);
        return rows
          .filter((contact) =>
            [contact.firstName, contact.lastName, contact.email, contact.title, contact.company]
              .filter((value): value is string => value !== null)
              .join(" ")
              .toLocaleLowerCase()
              .includes(query),
          )
          .slice(0, 50);
      }),
      { require: "admin" },
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
        const admin = yield* portal.adminBootstrap(data.eventId, user.userId);
        const sessionCount = new Set(
          admin.participants
            .filter((row) => row.contact.id === contact.id)
            .map((row) => row.submission.id),
        ).size;
        return { contact, sessionCount };
      }),
      { require: "admin" },
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
          user.userId,
          data.submissionId,
          data.title,
          data.description,
        );
      }),
      { require: "admin" },
    ),
  );

export const updateAdminSpeakerProfile = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(AdminSpeakerProfileRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        const { user } = yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        return yield* portal.editAdminProfile(data.eventId, user.userId, data.contactId, data.bio);
      }),
      { require: "admin" },
    ),
  );

export const uploadAdminHeadshot = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(AdminHeadshotUploadRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    return runServer(
      Effect.gen(function* () {
        const { user } = yield* requireAdminEvent(data.eventId);
        if (data.size > 5 * 1024 * 1024) {
          return yield* Effect.fail(
            new InvalidInput({ message: "Headshots must be 5 MB or smaller" }),
          );
        }
        if (data.contentType !== "image/png" && data.contentType !== "image/jpeg") {
          return yield* Effect.fail(new InvalidInput({ message: "Use a PNG or JPG headshot" }));
        }
        const bytes = decodeBase64(data.base64);
        if (bytes.byteLength !== data.size) {
          return yield* Effect.fail(
            new InvalidInput({ message: "The uploaded headshot is incomplete" }),
          );
        }
        const portal = yield* Portal;
        const prepared = yield* portal.prepareAdminHeadshot(
          data.eventId,
          user.userId,
          data.contactId,
        );
        const storageKey = `${data.contactId}/${prepared.fileUploadId}/${crypto.randomUUID()}`;
        yield* Effect.tryPromise({
          try: () =>
            env.FILES.put(storageKey, bytes, {
              httpMetadata: {
                contentType: data.contentType,
                contentDisposition: `inline; filename="${data.filename.replaceAll('"', "")}"`,
              },
            }),
          catch: (cause) => new DbError({ message: "Could not store the headshot", cause }),
        });
        return yield* portal.recordFileVersion({
          fileUploadId: prepared.fileUploadId,
          storageKey,
          filename: data.filename,
          contentType: data.contentType,
          size: data.size,
          uploaderContactId: null,
          uploaderEventMemberId: prepared.eventMemberId,
          headshotContactId: data.contactId,
          adminApproved: true,
          completeAssignmentId: null,
        });
      }),
      { require: "admin" },
    );
  });

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
const seedPlaceholder = (storageKey: string, contentType: string): Uint8Array | null => {
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
        const admin = yield* portal.adminBootstrap(data.eventId, user.userId);
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
      { require: "admin" },
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
          userId: user.userId,
        });
      }),
      { require: "admin" },
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
          uploaderEventMemberId: null,
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
          user.userId,
          data.fileUploadId,
          data.body.trim(),
        );
      }),
      { require: "admin" },
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
      { require: "admin" },
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
      { require: "admin" },
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
      { require: "admin" },
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
      { require: "admin" },
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
      { require: "admin" },
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
      { require: "admin" },
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
        return yield* portal.reviewContent(data.eventId, user.userId, data.historyId, "approved");
      }),
      { require: "admin" },
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
        return yield* portal.reviewContent(data.eventId, user.userId, data.historyId, "rejected");
      }),
      { require: "admin" },
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
        return yield* portal.reviewProfile(data.eventId, user.userId, data.historyId, "approved");
      }),
      { require: "admin" },
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
        return yield* portal.reviewProfile(data.eventId, user.userId, data.historyId, "rejected");
      }),
      { require: "admin" },
    ),
  );

export const acceptPortalSubmission = createServerFn({ method: "POST" })
  .validator(
    Schema.toStandardSchemaV1(
      Schema.Struct({ eventId: Schema.String, submissionId: Schema.String }),
    ),
  )
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const portal = yield* Portal;
        return yield* portal.acceptSubmission(data.eventId, data.submissionId);
      }),
      { require: "admin" },
    ),
  );
