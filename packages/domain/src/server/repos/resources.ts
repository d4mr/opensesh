import { and, asc, eq, exists, inArray, max, or } from "drizzle-orm";
import { Context, Effect, Layer, Schema } from "effect";

import {
  contacts,
  resourceContacts,
  resources,
  resourceTracks,
  submissionParticipants,
  submissions,
  submissionTracks,
  tracks,
} from "../../db/schema";
import { Db } from "../db";
import { InvalidInput, NotFound, type DbError } from "../errors";
import {
  Resource,
  ResourceAdmin,
  type ResourceAdmin as ResourceAdminData,
  type ResourceAudienceMode,
  type ResourceSave,
  ResourceView,
  type ResourceView as ResourceViewData,
} from "../schema/resources";
import { activeSession, decodeFound, decodeMany, query } from "./shared";

const ResourceId = Schema.Struct({ id: Schema.String });

export const resourceAudienceVisible = (
  mode: ResourceAudienceMode,
  selectedTrackIds: ReadonlySet<string>,
  selectedContactIds: ReadonlySet<string>,
  activeTrackIds: ReadonlySet<string>,
  contactId: string,
) =>
  mode === "all" ||
  (mode === "contacts" && selectedContactIds.has(contactId)) ||
  (mode === "tracks" && Array.from(selectedTrackIds).some((id) => activeTrackIds.has(id)));

interface FileAttachment {
  readonly storageKey: string;
  readonly filename: string;
  readonly contentType: string;
  readonly size: number;
}

interface ResourcesService {
  readonly listByEvent: (
    eventId: string,
  ) => Effect.Effect<ReadonlyArray<ResourceAdminData>, DbError>;
  readonly save: (
    input: ResourceSave,
  ) => Effect.Effect<ResourceAdminData, DbError | InvalidInput | NotFound>;
  readonly delete: (eventId: string, id: string) => Effect.Effect<void, DbError | NotFound>;
  readonly reorder: (eventId: string, ids: ReadonlyArray<string>) => Effect.Effect<void, DbError>;
  readonly listForContact: (
    eventId: string,
    contactId: string,
  ) => Effect.Effect<ReadonlyArray<ResourceViewData>, DbError>;
  readonly attachFile: (
    eventId: string,
    id: string,
    file: FileAttachment,
  ) => Effect.Effect<ResourceAdminData, DbError | NotFound>;
  readonly downloadForContact: (
    resourceId: string,
    eventId: string,
    contactId: string,
  ) => Effect.Effect<FileAttachment, DbError | NotFound>;
}

export class Resources extends Context.Service<Resources, ResourcesService>()(
  "opensesh/Resources",
) {}

export const ResourcesLive = Layer.effect(
  Resources,
  Effect.gen(function* () {
    const { database } = yield* Db;

    const listByEvent = (eventId: string) =>
      Effect.gen(function* () {
        const [rows, trackRows, contactRows] = yield* Effect.all([
          query(database, "Could not list resources", (db) =>
            db
              .select()
              .from(resources)
              .where(eq(resources.eventId, eventId))
              .orderBy(asc(resources.position), asc(resources.createdAt))
              .execute(),
          ),
          query(database, "Could not list resource tracks", (db) =>
            db
              .select({ resourceId: resourceTracks.resourceId, trackId: resourceTracks.trackId })
              .from(resourceTracks)
              .innerJoin(resources, eq(resources.id, resourceTracks.resourceId))
              .where(eq(resources.eventId, eventId))
              .execute(),
          ),
          query(database, "Could not list resource contacts", (db) =>
            db
              .select({
                resourceId: resourceContacts.resourceId,
                contactId: resourceContacts.contactId,
              })
              .from(resourceContacts)
              .innerJoin(resources, eq(resources.id, resourceContacts.resourceId))
              .where(eq(resources.eventId, eventId))
              .execute(),
          ),
        ]);
        const decoded = yield* decodeMany(Resource, "resource", rows);
        return yield* decodeMany(
          ResourceAdmin,
          "resource",
          decoded.map((resource) => ({
            ...resource,
            trackIds: trackRows
              .filter((row) => row.resourceId === resource.id)
              .map((row) => row.trackId),
            contactIds: contactRows
              .filter((row) => row.resourceId === resource.id)
              .map((row) => row.contactId),
          })),
        );
      });

    const findAdmin = (eventId: string, id: string) =>
      listByEvent(eventId).pipe(
        Effect.flatMap((items) =>
          decodeFound(
            ResourceAdmin,
            "Resource",
            items.find((item) => item.id === id),
          ),
        ),
      );

    return {
      listByEvent,
      save: (input) =>
        Effect.gen(function* () {
          const result = yield* query(database, "Could not save resource", (db) =>
            db.transaction(async (transaction) => {
              const trackIds = Array.from(new Set(input.trackIds));
              const contactIds = Array.from(new Set(input.contactIds));
              if (input.audienceMode === "tracks") {
                const valid =
                  trackIds.length === 0
                    ? []
                    : await transaction
                        .select({ id: tracks.id })
                        .from(tracks)
                        .where(and(eq(tracks.eventId, input.eventId), inArray(tracks.id, trackIds)))
                        .execute();
                if (valid.length !== trackIds.length) return { kind: "invalidTracks" as const };
              }
              if (input.audienceMode === "contacts") {
                const valid =
                  contactIds.length === 0
                    ? []
                    : await transaction
                        .select({ id: contacts.id })
                        .from(contacts)
                        .where(
                          and(
                            eq(contacts.eventId, input.eventId),
                            inArray(contacts.id, contactIds),
                          ),
                        )
                        .execute();
                if (valid.length !== contactIds.length) return { kind: "invalidContacts" as const };
              }
              const values = {
                title: input.title,
                subtitle: input.subtitle,
                body: input.body,
                published: input.published,
                audienceMode: input.audienceMode,
                attachmentKind: input.attachmentKind,
                linkUrl: input.linkUrl,
                embedUrl: input.embedUrl,
                fileStorageKey: input.fileStorageKey,
                fileName: input.fileName,
                fileContentType: input.fileContentType,
                fileSize: input.fileSize,
                updatedAt: new Date(),
              };
              let id = input.id;
              if (id === null) {
                const [last] = await transaction
                  .select({ position: max(resources.position) })
                  .from(resources)
                  .where(eq(resources.eventId, input.eventId))
                  .execute();
                const [created] = await transaction
                  .insert(resources)
                  .values({
                    ...values,
                    eventId: input.eventId,
                    position: (last?.position ?? 0) + 1,
                  })
                  .returning({ id: resources.id })
                  .execute();
                id = created?.id ?? null;
              } else {
                const updated = await transaction
                  .update(resources)
                  .set(values)
                  .where(and(eq(resources.id, id), eq(resources.eventId, input.eventId)))
                  .returning({ id: resources.id })
                  .execute();
                if (updated.length === 0) return { kind: "notFound" as const };
              }
              if (id === null) return { kind: "notFound" as const };
              await transaction.delete(resourceTracks).where(eq(resourceTracks.resourceId, id));
              await transaction.delete(resourceContacts).where(eq(resourceContacts.resourceId, id));
              const now = new Date();
              if (input.audienceMode === "tracks" && trackIds.length > 0) {
                await transaction.insert(resourceTracks).values(
                  trackIds.map((trackId) => ({
                    resourceId: id,
                    trackId,
                    createdAt: now,
                    updatedAt: now,
                  })),
                );
              }
              if (input.audienceMode === "contacts" && contactIds.length > 0) {
                await transaction.insert(resourceContacts).values(
                  contactIds.map((contactId) => ({
                    resourceId: id,
                    contactId,
                    createdAt: now,
                    updatedAt: now,
                  })),
                );
              }
              return { kind: "ok" as const, id };
            }),
          );
          if (result.kind === "invalidTracks")
            return yield* Effect.fail(
              new InvalidInput({ message: "Choose tracks from this event" }),
            );
          if (result.kind === "invalidContacts")
            return yield* Effect.fail(
              new InvalidInput({ message: "Choose speakers from this event" }),
            );
          if (result.kind === "notFound")
            return yield* decodeFound(ResourceAdmin, "Resource", undefined);
          return yield* findAdmin(input.eventId, result.id);
        }),
      delete: (eventId, id) =>
        query(database, "Could not delete resource", (db) =>
          db
            .delete(resources)
            .where(and(eq(resources.id, id), eq(resources.eventId, eventId)))
            .returning({ id: resources.id })
            .execute(),
        ).pipe(
          Effect.flatMap((rows) => decodeFound(ResourceId, "Resource", rows[0])),
          Effect.asVoid,
        ),
      reorder: (eventId, ids) =>
        query(database, "Could not reorder resources", (db) =>
          db.transaction(async (transaction) => {
            for (const [index, id] of Array.from(new Set(ids)).entries()) {
              await transaction
                .update(resources)
                .set({ position: index + 1, updatedAt: new Date() })
                .where(and(eq(resources.id, id), eq(resources.eventId, eventId)))
                .execute();
            }
          }),
        ).pipe(Effect.asVoid),
      listForContact: (eventId, contactId) =>
        query(database, "Could not list speaker resources", (db) => {
          const contactAudience = db
            .select({ id: resourceContacts.id })
            .from(resourceContacts)
            .where(
              and(
                eq(resourceContacts.resourceId, resources.id),
                eq(resourceContacts.contactId, contactId),
              ),
            );
          const trackAudience = db
            .select({ id: resourceTracks.id })
            .from(resourceTracks)
            .innerJoin(submissionTracks, eq(submissionTracks.trackId, resourceTracks.trackId))
            .innerJoin(submissions, eq(submissions.id, submissionTracks.submissionId))
            .innerJoin(
              submissionParticipants,
              eq(submissionParticipants.submissionId, submissions.id),
            )
            .where(
              and(
                eq(resourceTracks.resourceId, resources.id),
                eq(submissionParticipants.contactId, contactId),
                eq(submissions.eventId, eventId),
                activeSession,
              ),
            );
          return db
            .select()
            .from(resources)
            .where(
              and(
                eq(resources.eventId, eventId),
                eq(resources.published, true),
                or(
                  eq(resources.audienceMode, "all"),
                  and(eq(resources.audienceMode, "contacts"), exists(contactAudience)),
                  and(eq(resources.audienceMode, "tracks"), exists(trackAudience)),
                ),
              ),
            )
            .orderBy(asc(resources.position), asc(resources.createdAt))
            .execute();
        }).pipe(
          Effect.flatMap((rows) =>
            decodeMany(
              ResourceView,
              "resource",
              rows.map(
                ({
                  fileStorageKey: _fileStorageKey,
                  eventId: _eventId,
                  published: _published,
                  audienceMode: _audienceMode,
                  createdAt: _createdAt,
                  updatedAt: _updatedAt,
                  ...row
                }) => row,
              ),
            ),
          ),
        ),
      attachFile: (eventId, id, file) =>
        query(database, "Could not attach resource file", (db) =>
          db
            .update(resources)
            .set({
              attachmentKind: "file",
              linkUrl: null,
              embedUrl: null,
              fileStorageKey: file.storageKey,
              fileName: file.filename,
              fileContentType: file.contentType,
              fileSize: file.size,
              updatedAt: new Date(),
            })
            .where(and(eq(resources.id, id), eq(resources.eventId, eventId)))
            .returning({ id: resources.id })
            .execute(),
        ).pipe(
          Effect.flatMap((rows) => decodeFound(ResourceId, "Resource", rows[0])),
          Effect.flatMap(() => findAdmin(eventId, id)),
        ),
      downloadForContact: (resourceId, eventId, contactId) =>
        Effect.gen(function* () {
          const visible = yield* query(database, "Could not load resource download", (db) => {
            const contactAudience = db
              .select({ id: resourceContacts.id })
              .from(resourceContacts)
              .where(
                and(
                  eq(resourceContacts.resourceId, resources.id),
                  eq(resourceContacts.contactId, contactId),
                ),
              );
            const trackAudience = db
              .select({ id: resourceTracks.id })
              .from(resourceTracks)
              .innerJoin(submissionTracks, eq(submissionTracks.trackId, resourceTracks.trackId))
              .innerJoin(submissions, eq(submissions.id, submissionTracks.submissionId))
              .innerJoin(
                submissionParticipants,
                eq(submissionParticipants.submissionId, submissions.id),
              )
              .where(
                and(
                  eq(resourceTracks.resourceId, resources.id),
                  eq(submissionParticipants.contactId, contactId),
                  eq(submissions.eventId, eventId),
                  activeSession,
                ),
              );
            return db
              .select({
                storageKey: resources.fileStorageKey,
                filename: resources.fileName,
                contentType: resources.fileContentType,
                size: resources.fileSize,
              })
              .from(resources)
              .where(
                and(
                  eq(resources.id, resourceId),
                  eq(resources.eventId, eventId),
                  eq(resources.published, true),
                  eq(resources.attachmentKind, "file"),
                  or(
                    eq(resources.audienceMode, "all"),
                    and(eq(resources.audienceMode, "contacts"), exists(contactAudience)),
                    and(eq(resources.audienceMode, "tracks"), exists(trackAudience)),
                  ),
                ),
              )
              .limit(1)
              .execute();
          });
          const row = visible[0];
          if (
            row === undefined ||
            row.storageKey === null ||
            row.filename === null ||
            row.contentType === null ||
            row.size === null
          )
            return yield* Effect.fail(new NotFound({ message: "Resource file not found" }));
          return {
            storageKey: row.storageKey,
            filename: row.filename,
            contentType: row.contentType,
            size: row.size,
          };
        }),
    };
  }),
);
