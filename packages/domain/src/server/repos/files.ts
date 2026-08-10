import { asc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

import { fileRequests, fileUploads } from "../../db/schema";
import { Db } from "../db";
import type { DbError, NotFound } from "../errors";
import {
  FileRequest,
  type FileRequestCreate,
  type FileRequestUpdate,
  FileUpload,
  type FileUploadCreate,
} from "../schema/portal";
import { decode, decodeFound, decodeMany, query } from "./shared";

interface FilesService {
  readonly listRequests: (eventId: string) => Effect.Effect<ReadonlyArray<FileRequest>, DbError>;
  readonly createRequest: (input: FileRequestCreate) => Effect.Effect<FileRequest, DbError>;
  readonly updateRequest: (
    id: string,
    input: FileRequestUpdate,
  ) => Effect.Effect<FileRequest, DbError | NotFound>;
  readonly addUpload: (input: FileUploadCreate) => Effect.Effect<FileUpload, DbError>;
  readonly listUploads: (
    fileRequestId: string,
  ) => Effect.Effect<ReadonlyArray<FileUpload>, DbError>;
}

export class Files extends Context.Service<Files, FilesService>()("opensesh/Files") {}

export const FilesLive = Layer.effect(
  Files,
  Effect.gen(function* () {
    const { database } = yield* Db;
    return {
      listRequests: (eventId) =>
        query(database, "Could not list file requests", (db) =>
          db
            .select()
            .from(fileRequests)
            .where(eq(fileRequests.eventId, eventId))
            .orderBy(asc(fileRequests.createdAt))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(FileRequest, "file request", rows))),
      createRequest: (input) =>
        query(database, "Could not create file request", (db) =>
          db.insert(fileRequests).values(input).returning().execute(),
        ).pipe(Effect.flatMap((rows) => decode(FileRequest, "file request", rows[0]))),
      updateRequest: (id, input) =>
        query(database, "Could not update file request", (db) =>
          db
            .update(fileRequests)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(fileRequests.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(FileRequest, "File request", rows[0]))),
      addUpload: (input) =>
        query(database, "Could not add file upload", (db) =>
          db.insert(fileUploads).values(input).returning().execute(),
        ).pipe(Effect.flatMap((rows) => decode(FileUpload, "file upload", rows[0]))),
      listUploads: (fileRequestId) =>
        query(database, "Could not list file uploads", (db) =>
          db
            .select()
            .from(fileUploads)
            .where(eq(fileUploads.fileRequestId, fileRequestId))
            .orderBy(asc(fileUploads.uploadedAt))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(FileUpload, "file upload", rows))),
    };
  }),
);
