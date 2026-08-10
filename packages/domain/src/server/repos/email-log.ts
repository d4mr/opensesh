import { desc, eq } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

import { emailLog } from "../../db/schema";
import { Db } from "../db";
import type { DbError, NotFound } from "../errors";
import { type EmailLogCreate, EmailLogEntry, type EmailStatus } from "../schema/portal";
import { decode, decodeFound, decodeMany, query } from "./shared";

interface EmailLogService {
  readonly listByContact: (
    contactId: string,
  ) => Effect.Effect<ReadonlyArray<EmailLogEntry>, DbError>;
  readonly create: (input: EmailLogCreate) => Effect.Effect<EmailLogEntry, DbError>;
  readonly updateStatus: (
    id: string,
    status: EmailStatus,
    sentAt?: Date | null,
  ) => Effect.Effect<EmailLogEntry, DbError | NotFound>;
}

export class EmailLog extends Context.Service<EmailLog, EmailLogService>()("opensesh/EmailLog") {}

export const EmailLogLive = Layer.effect(
  EmailLog,
  Effect.gen(function* () {
    const { database } = yield* Db;
    return {
      listByContact: (contactId) =>
        query(database, "Could not list email log", (db) =>
          db
            .select()
            .from(emailLog)
            .where(eq(emailLog.contactId, contactId))
            .orderBy(desc(emailLog.createdAt))
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeMany(EmailLogEntry, "email log entry", rows))),
      create: (input) =>
        query(database, "Could not create email log entry", (db) =>
          db.insert(emailLog).values(input).returning().execute(),
        ).pipe(Effect.flatMap((rows) => decode(EmailLogEntry, "email log entry", rows[0]))),
      updateStatus: (id, status, sentAt) =>
        query(database, "Could not update email log entry", (db) =>
          db
            .update(emailLog)
            .set({
              status,
              ...(sentAt === undefined ? {} : { sentAt }),
              updatedAt: new Date(),
            })
            .where(eq(emailLog.id, id))
            .returning()
            .execute(),
        ).pipe(Effect.flatMap((rows) => decodeFound(EmailLogEntry, "Email log entry", rows[0]))),
    };
  }),
);
