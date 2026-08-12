import { requireEventAccess } from "@opensesh/domain/server/current-user";
import { InvalidInput } from "@opensesh/domain/server/errors";
import { Resources } from "@opensesh/domain/server/repos";
import {
  ResourceAdmin,
  ResourceAudienceMode,
  validateEmbedUrl,
} from "@opensesh/domain/server/schema/resources";
import { Effect, Schema } from "effect";

import { endpoint, type ApiEndpoint } from "../types";

const ApiAttachmentKind = Schema.NullOr(Schema.Literals(["link", "embed"]));
const ResourceBody = Schema.Struct({
  title: Schema.String,
  subtitle: Schema.String,
  body: Schema.String,
  published: Schema.Boolean,
  audienceMode: ResourceAudienceMode,
  attachmentKind: ApiAttachmentKind,
  linkUrl: Schema.NullOr(Schema.String),
  embedUrl: Schema.NullOr(Schema.String),
  trackIds: Schema.Array(Schema.String),
  contactIds: Schema.Array(Schema.String),
});
const ReorderBody = Schema.Struct({ resourceIds: Schema.Array(Schema.String) });

const validateBody = (body: typeof ResourceBody.Type) =>
  Effect.gen(function* () {
    if (body.title.trim().length === 0)
      return yield* Effect.fail(new InvalidInput({ message: "Enter a resource title" }));
    if (body.audienceMode === "tracks" && body.trackIds.length === 0)
      return yield* Effect.fail(new InvalidInput({ message: "Select at least one track" }));
    if (body.audienceMode === "contacts" && body.contactIds.length === 0)
      return yield* Effect.fail(new InvalidInput({ message: "Select at least one speaker" }));
    if (body.attachmentKind === "link") {
      let valid = false;
      if (body.linkUrl !== null) {
        try {
          valid = new URL(body.linkUrl).protocol === "https:";
        } catch {
          valid = false;
        }
      }
      if (!valid)
        return yield* Effect.fail(new InvalidInput({ message: "Enter a valid HTTPS link URL" }));
    }
    if (body.attachmentKind === "embed") {
      const error = body.embedUrl === null ? "Enter an embed URL" : validateEmbedUrl(body.embedUrl);
      if (error !== undefined) return yield* Effect.fail(new InvalidInput({ message: error }));
    }
    return body;
  });

const saveValues = (eventId: string, id: string | null, body: typeof ResourceBody.Type) => ({
  eventId,
  id,
  title: body.title.trim(),
  subtitle: body.subtitle.trim(),
  body: body.body.trim(),
  published: body.published,
  audienceMode: body.audienceMode,
  attachmentKind: body.attachmentKind,
  linkUrl: body.attachmentKind === "link" ? body.linkUrl : null,
  embedUrl: body.attachmentKind === "embed" ? body.embedUrl : null,
  fileStorageKey: null,
  fileName: null,
  fileContentType: null,
  fileSize: null,
  trackIds: body.audienceMode === "tracks" ? body.trackIds : [],
  contactIds: body.audienceMode === "contacts" ? body.contactIds : [],
});

export const resourceEndpoints: ReadonlyArray<ApiEndpoint> = [
  endpoint({
    method: "GET",
    path: "/events/{eventId}/resources",
    operationId: "listResources",
    summary: "List resources",
    description:
      "Lists draft and published speaker resources in manual order, including audience assignments. File resources can be read here but file upload is app-only.",
    tag: "Resources",
    successSchema: Schema.Array(ResourceAdmin),
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const resources = yield* Resources;
        return yield* resources.listByEvent(access.event.id);
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/resources",
    operationId: "createResource",
    summary: "Create a resource",
    description:
      "Creates a draft or published resource with no attachment, an HTTPS link, or an allowlisted embed. File upload is available in the organizer app only.",
    tag: "Resources",
    bodySchema: ResourceBody,
    successStatus: 201,
    successSchema: ResourceAdmin,
    handler: (context) =>
      Effect.gen(function* () {
        const body = yield* validateBody(context.body as typeof ResourceBody.Type);
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const resources = yield* Resources;
        return yield* resources.save(saveValues(access.event.id, null, body));
      }),
  }),
  endpoint({
    method: "PATCH",
    path: "/events/{eventId}/resources/{resourceId}",
    operationId: "updateResource",
    summary: "Update a resource",
    description:
      "Full resource update, including publication state and audience replacement. Existing file attachments can be replaced or removed in the organizer app; the API supports link and embed attachments.",
    tag: "Resources",
    bodySchema: ResourceBody,
    successSchema: ResourceAdmin,
    handler: (context) =>
      Effect.gen(function* () {
        const body = yield* validateBody(context.body as typeof ResourceBody.Type);
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const resources = yield* Resources;
        return yield* resources.save(
          saveValues(access.event.id, context.params.resourceId ?? "", body),
        );
      }),
  }),
  endpoint({
    method: "DELETE",
    path: "/events/{eventId}/resources/{resourceId}",
    operationId: "deleteResource",
    summary: "Delete a resource",
    tag: "Resources",
    successStatus: 204,
    successSchema: Schema.Void,
    handler: (context) =>
      Effect.gen(function* () {
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const resources = yield* Resources;
        yield* resources.delete(access.event.id, context.params.resourceId ?? "");
      }),
  }),
  endpoint({
    method: "POST",
    path: "/events/{eventId}/resources/reorder",
    operationId: "reorderResources",
    summary: "Reorder resources",
    tag: "Resources",
    bodySchema: ReorderBody,
    successStatus: 204,
    successSchema: Schema.Void,
    handler: (context) =>
      Effect.gen(function* () {
        const body = context.body as typeof ReorderBody.Type;
        const access = yield* requireEventAccess(context.params.eventId ?? "", "admin");
        const resources = yield* Resources;
        yield* resources.reorder(access.event.id, body.resourceIds);
      }),
  }),
];
