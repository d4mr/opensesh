import {
  DbError,
  Forbidden,
  InvalidInput,
  NotFound,
  ResourceDeleteRequest,
  ResourceDownloadRequest,
  ResourceReorderRequest,
  ResourceSave,
  ResourceUploadRequest,
  validateEmbedUrl,
} from "@opensesh/domain";
import { getCurrentUser, requireEventAccess } from "@opensesh/domain/server/current-user";
import { Contacts, Events, Resources } from "@opensesh/domain/server/repos";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";

import { runServer } from "@/server/runtime";
import { seedPlaceholder } from "@/server-fns/portal";

const requireAdminEvent = (eventId: string) => requireEventAccess(eventId, "admin");

const validateHttpsUrl = (url: string, label: string): string | undefined => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? undefined : `${label} must use HTTPS`;
  } catch {
    return `Enter a valid HTTPS ${label.toLowerCase()}`;
  }
};

const portalContact = Effect.gen(function* () {
  const user = yield* getCurrentUser;
  const contacts = yield* Contacts;
  if (user.roles.contactId !== undefined) {
    const contact = yield* contacts.get(user.roles.contactId);
    return { contact, preview: false };
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
  return { contact: yield* contacts.findPreviewByEvent(event.id), preview: true };
});

const validateSave = (data: typeof ResourceSave.Type) =>
  Effect.gen(function* () {
    if (data.title.trim().length === 0)
      return yield* Effect.fail(new InvalidInput({ message: "Enter a resource title" }));
    if (data.audienceMode === "tracks" && data.trackIds.length === 0)
      return yield* Effect.fail(new InvalidInput({ message: "Select at least one track" }));
    if (data.audienceMode === "contacts" && data.contactIds.length === 0)
      return yield* Effect.fail(new InvalidInput({ message: "Select at least one speaker" }));
    if (data.attachmentKind === "link") {
      const error =
        data.linkUrl === null ? "Enter a link URL" : validateHttpsUrl(data.linkUrl, "Link URL");
      if (error !== undefined) return yield* Effect.fail(new InvalidInput({ message: error }));
    }
    if (data.attachmentKind === "embed") {
      const error = data.embedUrl === null ? "Enter an embed URL" : validateEmbedUrl(data.embedUrl);
      if (error !== undefined) return yield* Effect.fail(new InvalidInput({ message: error }));
    }
    if (
      data.attachmentKind === "file" &&
      (data.fileStorageKey === null ||
        data.fileName === null ||
        data.fileContentType === null ||
        data.fileSize === null)
    )
      return yield* Effect.fail(new InvalidInput({ message: "Upload a file for this resource" }));
    return data;
  });

export const getAdminResources = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(Schema.Struct({ eventId: Schema.String })))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const resources = yield* Resources;
        const events = yield* Events;
        const contacts = yield* Contacts;
        const [items, tracks, speakers] = yield* Effect.all([
          resources.listByEvent(data.eventId),
          events.listTracks(data.eventId),
          contacts.listByEvent(data.eventId),
        ]);
        return { items, tracks, contacts: speakers };
      }),
      { require: "staff" },
    ),
  );

export const saveResource = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ResourceSave))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const valid = yield* validateSave(data);
        const resources = yield* Resources;
        return yield* resources.save({
          ...valid,
          title: valid.title.trim(),
          subtitle: valid.subtitle.trim(),
          body: valid.body.trim(),
          trackIds: valid.audienceMode === "tracks" ? valid.trackIds : [],
          contactIds: valid.audienceMode === "contacts" ? valid.contactIds : [],
          linkUrl: valid.attachmentKind === "link" ? valid.linkUrl : null,
          embedUrl: valid.attachmentKind === "embed" ? valid.embedUrl : null,
          fileStorageKey: valid.attachmentKind === "file" ? valid.fileStorageKey : null,
          fileName: valid.attachmentKind === "file" ? valid.fileName : null,
          fileContentType: valid.attachmentKind === "file" ? valid.fileContentType : null,
          fileSize: valid.attachmentKind === "file" ? valid.fileSize : null,
        });
      }),
      { require: "staff" },
    ),
  );

export const deleteResource = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ResourceDeleteRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const resources = yield* Resources;
        return yield* resources.delete(data.eventId, data.id);
      }),
      { require: "staff" },
    ),
  );

export const reorderResources = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ResourceReorderRequest))
  .handler(async ({ data }) =>
    runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        const resources = yield* Resources;
        return yield* resources.reorder(data.eventId, data.resourceIds);
      }),
      { require: "staff" },
    ),
  );

export const uploadResourceFile = createServerFn({ method: "POST" })
  .validator(Schema.toStandardSchemaV1(ResourceUploadRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    return runServer(
      Effect.gen(function* () {
        yield* requireAdminEvent(data.eventId);
        if (data.filename.trim().length === 0 || data.size <= 0)
          return yield* Effect.fail(new InvalidInput({ message: "Choose a file to upload" }));
        const bytes = yield* Effect.try({
          try: () => Uint8Array.from(atob(data.base64), (character) => character.charCodeAt(0)),
          catch: () => new InvalidInput({ message: "The uploaded file is invalid" }),
        });
        if (bytes.byteLength !== data.size)
          return yield* Effect.fail(
            new InvalidInput({ message: "The uploaded file is incomplete" }),
          );
        const resources = yield* Resources;
        const existing = yield* resources.listByEvent(data.eventId);
        if (!existing.some((resource) => resource.id === data.resourceId))
          return yield* Effect.fail(new NotFound({ message: "Resource not found" }));
        const storageKey = `resources/${data.eventId}/${data.resourceId}/${crypto.randomUUID()}`;
        yield* Effect.tryPromise({
          try: () =>
            env.FILES.put(storageKey, bytes, {
              httpMetadata: {
                contentType: data.contentType,
                contentDisposition: `attachment; filename="${data.filename.replaceAll('"', "")}"`,
              },
            }),
          catch: (cause) => new DbError({ message: "Could not store the resource file", cause }),
        });
        return yield* resources.attachFile(data.eventId, data.resourceId, {
          storageKey,
          filename: data.filename,
          contentType: data.contentType || "application/octet-stream",
          size: data.size,
        });
      }),
      { require: "staff" },
    );
  });

export const getPortalResources = createServerFn({ method: "GET" }).handler(async () =>
  runServer(
    Effect.gen(function* () {
      const { contact } = yield* portalContact;
      const resources = yield* Resources;
      return yield* resources.listForContact(contact.eventId, contact.id);
    }),
    { require: "session" },
  ),
);

export const downloadResourceFile = createServerFn({ method: "GET" })
  .validator(Schema.toStandardSchemaV1(ResourceDownloadRequest))
  .handler(async ({ data }) => {
    const { env } = await import("cloudflare:workers");
    return runServer(
      Effect.gen(function* () {
        const { contact } = yield* portalContact;
        const resources = yield* Resources;
        const file = yield* resources.downloadForContact(
          data.resourceId,
          contact.eventId,
          contact.id,
        );
        const object = yield* Effect.tryPromise({
          try: () => env.FILES.get(file.storageKey),
          catch: (cause) => new DbError({ message: "Could not load the resource file", cause }),
        });
        const fallback =
          object === null ? seedPlaceholder(file.storageKey, file.contentType) : null;
        if (object === null && fallback === null)
          return yield* Effect.fail(
            new DbError({ message: "The resource file is missing", cause: file.storageKey }),
          );
        const bytes =
          object === null
            ? fallback === null
              ? new Uint8Array()
              : fallback
            : new Uint8Array(yield* Effect.promise(() => object.arrayBuffer()));
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return {
          filename: file.filename,
          contentType: file.contentType,
          size: bytes.byteLength,
          base64: btoa(binary),
        };
      }),
      { require: "session" },
    );
  });
