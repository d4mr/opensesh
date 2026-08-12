import { Schema } from "effect";

import { EntityFields, NullableNumber, NullableString } from "./common";

export const ResourceAudienceMode = Schema.Literals(["all", "tracks", "contacts"]);
export type ResourceAudienceMode = typeof ResourceAudienceMode.Type;
export const ResourceAttachmentKind = Schema.Literals(["link", "file", "embed"]);
export type ResourceAttachmentKind = typeof ResourceAttachmentKind.Type;

// Security boundary for organizer-authored iframes. Keep every permitted host
// here so validation and rendering policy cannot quietly diverge.
export const RESOURCE_EMBED_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "vimeo.com",
  "www.vimeo.com",
  "loom.com",
  "www.loom.com",
  "docs.google.com",
  "www.docs.google.com",
  "drive.google.com",
  "www.drive.google.com",
  "figma.com",
  "www.figma.com",
] as const;

const embedHosts = new Set<string>(RESOURCE_EMBED_HOSTS);

export const validateEmbedUrl = (url: string): string | undefined => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "Enter a valid HTTPS embed URL";
  }
  if (parsed.protocol !== "https:") return "Embed URLs must use HTTPS";
  if (!embedHosts.has(parsed.hostname.toLowerCase())) {
    return "Embed host is not allowed. Use YouTube, Vimeo, Loom, Google Docs, Google Drive, or Figma";
  }
  return undefined;
};

const resourceFields = {
  eventId: Schema.String,
  title: Schema.String,
  subtitle: Schema.String,
  body: Schema.String,
  position: Schema.Number,
  published: Schema.Boolean,
  audienceMode: ResourceAudienceMode,
  attachmentKind: Schema.NullOr(ResourceAttachmentKind),
  linkUrl: NullableString,
  embedUrl: NullableString,
  fileStorageKey: NullableString,
  fileName: NullableString,
  fileContentType: NullableString,
  fileSize: NullableNumber,
};

export const Resource = Schema.Struct({ ...EntityFields, ...resourceFields });
export type Resource = typeof Resource.Type;

export const ResourceAdmin = Schema.Struct({
  ...EntityFields,
  ...resourceFields,
  trackIds: Schema.Array(Schema.String),
  contactIds: Schema.Array(Schema.String),
});
export type ResourceAdmin = typeof ResourceAdmin.Type;

export const ResourceSave = Schema.Struct({
  eventId: Schema.String,
  id: Schema.NullOr(Schema.String),
  title: Schema.String,
  subtitle: Schema.String,
  body: Schema.String,
  published: Schema.Boolean,
  audienceMode: ResourceAudienceMode,
  attachmentKind: Schema.NullOr(ResourceAttachmentKind),
  linkUrl: NullableString,
  embedUrl: NullableString,
  fileStorageKey: NullableString,
  fileName: NullableString,
  fileContentType: NullableString,
  fileSize: NullableNumber,
  trackIds: Schema.Array(Schema.String),
  contactIds: Schema.Array(Schema.String),
});
export type ResourceSave = typeof ResourceSave.Type;

export const ResourceView = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  subtitle: Schema.String,
  body: Schema.String,
  position: Schema.Number,
  attachmentKind: Schema.NullOr(ResourceAttachmentKind),
  linkUrl: NullableString,
  embedUrl: NullableString,
  fileName: NullableString,
  fileContentType: NullableString,
  fileSize: NullableNumber,
});
export type ResourceView = typeof ResourceView.Type;

export const ResourceDeleteRequest = Schema.Struct({ eventId: Schema.String, id: Schema.String });
export const ResourceReorderRequest = Schema.Struct({
  eventId: Schema.String,
  resourceIds: Schema.Array(Schema.String),
});
export const ResourceUploadRequest = Schema.Struct({
  eventId: Schema.String,
  resourceId: Schema.String,
  filename: Schema.String,
  contentType: Schema.String,
  size: Schema.Number,
  base64: Schema.String,
});
export const ResourceDownloadRequest = Schema.Struct({ resourceId: Schema.String });
