import { and, eq, exists, or, sql } from "drizzle-orm";
import { Effect, Schema } from "effect";

import { contacts, submissionParticipants, submissions } from "../../db/schema";
import type { Database } from "../db";
import { DbError, NotFound } from "../errors";
import type { AuditActor } from "../schema/common";

// Who performed a lifecycle transition, for the submission activity log.
// Staff and API keys arrive as AuditActor; portal actions (a speaker
// cancelling their own session) carry the contact.
export type ActivityActor =
  | AuditActor
  | { readonly kind: "contact"; readonly contactId: string; readonly name: string };

export const activityActorColumns = (actor: ActivityActor) => ({
  actorUserId: actor.kind === "user" ? actor.userId : null,
  actorApiKeyId: actor.kind === "api_key" ? actor.apiKeyId : null,
  actorContactId: actor.kind === "contact" ? actor.contactId : null,
  actorName: actor.name,
});

// SQL twin of sessionIsActive: the one definition of "this session is on".
// Cancelled sessions keep status='accepted' (the acceptance is history) but
// leave the agenda, invites, deliverable nags, and every public surface.
export const activeSession = sql`${submissions.status} = 'accepted' and ${submissions.cancelledAt} is null`;

export const contactIsSpeaker = (
  participation: "submitter" | "speaker" | "organizer",
  participantSubmissionStatuses: ReadonlyArray<
    "draft" | "pending" | "maybe" | "accepted" | "declined" | "withdrawn"
  >,
) => participation === "speaker" || participantSubmissionStatuses.includes("accepted");

// The single SQL definition of event speakerhood. Participation is provenance;
// an accepted submission promotes every participant into speaker-facing views
// without mutating the contact row.
export const speakerContact = (database: Pick<Database, "select">) =>
  or(
    eq(contacts.participation, "speaker"),
    exists(
      database
        .select({ id: submissionParticipants.id })
        .from(submissionParticipants)
        .innerJoin(submissions, eq(submissions.id, submissionParticipants.submissionId))
        .where(
          and(
            eq(submissionParticipants.contactId, contacts.id),
            eq(submissions.status, "accepted"),
          ),
        ),
    ),
  );

// The client envelope only carries the generic operation label; the underlying
// cause must reach Worker logs here or nowhere.
export const query = <A>(
  database: Database,
  message: string,
  execute: (database: Database) => Promise<A>,
) =>
  Effect.tryPromise({
    try: () => execute(database),
    catch: (cause) => new DbError({ message, cause }),
  }).pipe(Effect.tapError((error) => Effect.logError(`db: ${message}`, error.cause)));

export const decode = <S extends Schema.Top>(schema: S, entity: string, row: unknown) =>
  Schema.decodeUnknownEffect(schema)(row).pipe(
    Effect.mapError((cause) => new DbError({ message: `Stored ${entity} data is invalid`, cause })),
    Effect.tapError((error) => Effect.logError(`decode: ${entity}`, error.cause)),
  );

export const decodeMany = <S extends Schema.Top>(
  schema: S,
  entity: string,
  rows: ReadonlyArray<unknown>,
) => Effect.all(rows.map((row) => decode(schema, entity, row)));

export const decodeFound = <S extends Schema.Top>(schema: S, entity: string, row: unknown) =>
  Effect.gen(function* () {
    if (row === undefined) {
      return yield* Effect.fail(new NotFound({ message: `${entity} not found` }));
    }

    return yield* decode(schema, entity, row);
  });
