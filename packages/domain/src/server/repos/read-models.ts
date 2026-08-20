import { and, asc, count, desc, eq, ne } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";

import {
  contacts,
  events,
  formFields,
  formats,
  forms,
  levels,
  submissionParticipants,
  submissions,
  submissionTags,
  submissionTracks,
  tags,
  tracks,
} from "../../db/schema";
import { Db } from "../db";
import { type DbError, NotFound } from "../errors";
import { Event, EventAdmin, Format, Level, Room, Tag, Track } from "../schema/core";
import { Form, FormField, type FormSummary } from "../schema/forms";
import {
  Contact,
  Submission,
  SubmissionParticipant,
  SubmissionTag,
  SubmissionTrack,
} from "../schema/submissions";
import { decodeFound, decodeMany, query } from "./shared";
import { Events } from "./events";

interface FormBundle {
  readonly event: Event;
  readonly form: Form;
  readonly fields: ReadonlyArray<FormField>;
  readonly library: {
    readonly tracks: ReadonlyArray<Track>;
    readonly formats: ReadonlyArray<Format>;
    readonly tags: ReadonlyArray<Tag>;
    readonly levels: ReadonlyArray<Level>;
  };
}

interface DraftBundle extends FormBundle {
  readonly submission: Submission;
  readonly submitter: Contact;
  readonly trackIds: ReadonlyArray<string>;
  readonly tagIds: ReadonlyArray<string>;
  readonly participants: ReadonlyArray<{
    readonly link: SubmissionParticipant;
    readonly contact: Contact;
  }>;
}

// Admin read models receive an eventId the boundary has already authorized
// (requireEventAccess); queries only tenant-scope by that id.
interface ReadModelsService {
  readonly eventLibraryForAdmin: (eventId: string) => Effect.Effect<
    {
      readonly tracks: ReadonlyArray<Track>;
      readonly formats: ReadonlyArray<Format>;
      readonly rooms: ReadonlyArray<Room>;
      readonly tags: ReadonlyArray<Tag>;
      readonly levels: ReadonlyArray<Level>;
      readonly admins: ReadonlyArray<EventAdmin>;
    },
    DbError
  >;
  readonly formSummariesForAdmin: (
    eventId: string,
  ) => Effect.Effect<ReadonlyArray<FormSummary>, DbError>;
  readonly formEditorForAdmin: (
    eventId: string,
    formId: string,
  ) => Effect.Effect<
    FormBundle & {
      readonly admins: ReadonlyArray<EventAdmin>;
      // Non-draft submissions made against this form — the editor warns
      // that their answers reflect the questions as originally asked.
      readonly submissionCount: number;
    },
    DbError | NotFound
  >;
  readonly publicForm: (
    eventSlug: string,
    formId: string,
  ) => Effect.Effect<FormBundle, DbError | NotFound>;
  readonly publicFormAccount: (
    eventSlug: string,
    formId: string,
    email: string,
  ) => Effect.Effect<ReadonlyArray<Submission>, DbError | NotFound>;
  readonly publicDraft: (
    eventSlug: string,
    formId: string,
    submissionId: string,
    email: string,
  ) => Effect.Effect<DraftBundle, DbError | NotFound>;
}

export class ReadModels extends Context.Service<ReadModels, ReadModelsService>()(
  "opensesh/ReadModels",
) {}

export const ReadModelsLive = Layer.effect(
  ReadModels,
  Effect.gen(function* () {
    const { database } = yield* Db;
    const eventRepo = yield* Events;

    const decodePublicForm = (
      baseRows: ReadonlyArray<{
        readonly event: typeof events.$inferSelect;
        readonly form: typeof forms.$inferSelect;
        readonly field: typeof formFields.$inferSelect | null;
      }>,
      trackRows: ReadonlyArray<typeof tracks.$inferSelect>,
      formatRows: ReadonlyArray<typeof formats.$inferSelect>,
      tagRows: ReadonlyArray<typeof tags.$inferSelect>,
      levelRows: ReadonlyArray<typeof levels.$inferSelect>,
    ) =>
      Effect.gen(function* () {
        const first = baseRows[0];
        const event = yield* decodeFound(Event, "Event", first?.event);
        const form = yield* decodeFound(Form, "Form", first?.form);
        const [fieldsDecoded, tracksDecoded, formatsDecoded, tagsDecoded, levelsDecoded] =
          yield* Effect.all(
            [
              decodeMany(
                FormField,
                "form field",
                baseRows.flatMap((row) => (row.field === null ? [] : [row.field])),
              ),
              decodeMany(Track, "track", trackRows),
              decodeMany(Format, "format", formatRows),
              decodeMany(Tag, "tag", tagRows),
              decodeMany(Level, "level", levelRows),
            ],
            { concurrency: 5 },
          );
        return {
          event,
          form,
          fields: fieldsDecoded,
          library: {
            tracks: tracksDecoded,
            formats: formatsDecoded,
            tags: tagsDecoded,
            levels: levelsDecoded,
          },
        };
      });

    return {
      eventLibraryForAdmin: (eventId) =>
        Effect.all(
          {
            tracks: eventRepo.listTracks(eventId),
            formats: eventRepo.listFormats(eventId),
            rooms: eventRepo.listRooms(eventId),
            tags: eventRepo.listTags(eventId),
            levels: eventRepo.listLevels(eventId),
            admins: eventRepo.listAdmins(eventId),
          },
          { concurrency: 6 },
        ),
      formSummariesForAdmin: (eventId) =>
        query(database, "Could not list form summaries", (db) =>
          db
            .select({ form: forms, submission: submissions })
            .from(forms)
            .leftJoin(submissions, eq(submissions.sourceFormId, forms.id))
            .where(eq(forms.eventId, eventId))
            .orderBy(desc(forms.createdAt))
            .execute(),
        ).pipe(
          Effect.flatMap((rows) => {
            const formRows = rows.flatMap((row) => (row.form === null ? [] : [row.form]));
            return Effect.all([
              decodeMany(Form, "form", formRows),
              decodeMany(
                Submission,
                "submission",
                rows.flatMap((row) => (row.submission === null ? [] : [row.submission])),
              ),
            ]).pipe(
              Effect.map(([decodedForms, decodedSubmissions]) => {
                const uniqueForms = Array.from(
                  new Map(decodedForms.map((form) => [form.id, form])).values(),
                );
                return uniqueForms.map((form) => ({
                  ...form,
                  submissions: decodedSubmissions.filter(
                    (submission) =>
                      submission.sourceFormId === form.id && submission.status !== "draft",
                  ).length,
                  drafts: decodedSubmissions.filter(
                    (submission) =>
                      submission.sourceFormId === form.id && submission.status === "draft",
                  ).length,
                }));
              }),
            );
          }),
        ),
      formEditorForAdmin: (eventId, formId) => {
        const base = query(database, "Could not load form editor", (db) =>
          db
            .select({ event: events, form: forms, field: formFields })
            .from(forms)
            .innerJoin(events, eq(events.id, forms.eventId))
            .leftJoin(formFields, eq(formFields.formId, forms.id))
            .where(and(eq(forms.id, formId), eq(forms.eventId, eventId)))
            .orderBy(asc(formFields.position))
            .execute(),
        );
        // A scalar count, not the summaries query — that one loads every
        // submission row for the event just to count in JS.
        const submissionCount = query(database, "Could not count form submissions", (db) =>
          db
            .select({ value: count() })
            .from(submissions)
            .where(and(eq(submissions.sourceFormId, formId), ne(submissions.status, "draft")))
            .execute(),
        ).pipe(Effect.map((rows) => rows[0]?.value ?? 0));
        return Effect.all(
          [
            base,
            eventRepo.listTracks(eventId),
            eventRepo.listFormats(eventId),
            eventRepo.listTags(eventId),
            eventRepo.listLevels(eventId),
            eventRepo.listAdmins(eventId),
            submissionCount,
          ],
          { concurrency: 5 },
        ).pipe(
          Effect.filterOrFail(
            ([baseRows]) => baseRows.length > 0,
            () => new NotFound({ message: "Form not found" }),
          ),
          Effect.flatMap(([baseRows, trackRows, formatRows, tagRows, levelRows, admins, counted]) =>
            decodePublicForm(baseRows, trackRows, formatRows, tagRows, levelRows).pipe(
              Effect.map((bundle) => ({ ...bundle, admins, submissionCount: counted })),
            ),
          ),
        );
      },
      publicForm: (eventSlug, formId) => {
        const base = query(database, "Could not load public form", (db) =>
          db
            .select({ event: events, form: forms, field: formFields })
            .from(events)
            .innerJoin(forms, and(eq(forms.eventId, events.id), eq(forms.id, formId)))
            .leftJoin(formFields, eq(formFields.formId, forms.id))
            .where(eq(events.slug, eventSlug))
            .orderBy(asc(formFields.position))
            .execute(),
        );
        const publicLibrary = <T>(
          message: string,
          table: typeof tracks | typeof formats | typeof tags | typeof levels,
          order:
            | typeof tracks.position
            | typeof formats.position
            | typeof tags.position
            | typeof levels.position,
        ) =>
          query(database, message, (db) =>
            db
              .select({ item: table })
              .from(events)
              .innerJoin(forms, and(eq(forms.eventId, events.id), eq(forms.id, formId)))
              .innerJoin(table, eq(table.eventId, events.id))
              .where(eq(events.slug, eventSlug))
              .orderBy(asc(order))
              .execute(),
          ) as Effect.Effect<ReadonlyArray<{ readonly item: T }>, DbError>;
        return Effect.all(
          [
            base,
            publicLibrary<typeof tracks.$inferSelect>(
              "Could not list tracks",
              tracks,
              tracks.position,
            ),
            publicLibrary<typeof formats.$inferSelect>(
              "Could not list formats",
              formats,
              formats.position,
            ),
            publicLibrary<typeof tags.$inferSelect>("Could not list tags", tags, tags.position),
            publicLibrary<typeof levels.$inferSelect>(
              "Could not list levels",
              levels,
              levels.position,
            ),
          ],
          { concurrency: 5 },
        ).pipe(
          Effect.flatMap(([baseRows, trackRows, formatRows, tagRows, levelRows]) =>
            decodePublicForm(
              baseRows,
              trackRows.map((row) => row.item),
              formatRows.map((row) => row.item),
              tagRows.map((row) => row.item),
              levelRows.map((row) => row.item),
            ),
          ),
        );
      },
      publicFormAccount: (eventSlug, formId, email) =>
        query(database, "Could not load public form account", (db) =>
          db
            .select({ formId: forms.id, submission: submissions })
            .from(events)
            .innerJoin(forms, and(eq(forms.eventId, events.id), eq(forms.id, formId)))
            .leftJoin(contacts, and(eq(contacts.eventId, events.id), eq(contacts.email, email)))
            .leftJoin(
              submissions,
              and(
                eq(submissions.sourceFormId, forms.id),
                eq(submissions.submitterContactId, contacts.id),
              ),
            )
            .where(eq(events.slug, eventSlug))
            .orderBy(desc(submissions.updatedAt))
            .execute(),
        ).pipe(
          Effect.flatMap((rows) =>
            rows.length === 0
              ? decodeFound(Form, "Form", undefined).pipe(Effect.as([]))
              : decodeMany(
                  Submission,
                  "submission",
                  rows.flatMap((row) => (row.submission === null ? [] : [row.submission])),
                ),
          ),
        ),
      publicDraft: (eventSlug, formId, submissionId, email) => {
        const base = query(database, "Could not load public draft", (db) =>
          db
            .select({
              event: events,
              form: forms,
              field: formFields,
              submission: submissions,
              submitter: contacts,
            })
            .from(events)
            .innerJoin(forms, and(eq(forms.eventId, events.id), eq(forms.id, formId)))
            .leftJoin(formFields, eq(formFields.formId, forms.id))
            .innerJoin(contacts, and(eq(contacts.eventId, events.id), eq(contacts.email, email)))
            .innerJoin(
              submissions,
              and(
                eq(submissions.id, submissionId),
                eq(submissions.sourceFormId, forms.id),
                eq(submissions.submitterContactId, contacts.id),
              ),
            )
            .where(eq(events.slug, eventSlug))
            .orderBy(asc(formFields.position))
            .execute(),
        );
        return Effect.all(
          [
            base,
            query(database, "Could not load draft tracks", (db) =>
              db
                .select()
                .from(submissionTracks)
                .innerJoin(submissions, eq(submissions.id, submissionTracks.submissionId))
                .innerJoin(forms, and(eq(forms.id, submissions.sourceFormId), eq(forms.id, formId)))
                .innerJoin(
                  events,
                  and(eq(events.id, submissions.eventId), eq(events.slug, eventSlug)),
                )
                .where(eq(submissionTracks.submissionId, submissionId))
                .execute(),
            ),
            query(database, "Could not load draft tags", (db) =>
              db
                .select()
                .from(submissionTags)
                .innerJoin(submissions, eq(submissions.id, submissionTags.submissionId))
                .innerJoin(forms, and(eq(forms.id, submissions.sourceFormId), eq(forms.id, formId)))
                .innerJoin(
                  events,
                  and(eq(events.id, submissions.eventId), eq(events.slug, eventSlug)),
                )
                .where(eq(submissionTags.submissionId, submissionId))
                .execute(),
            ),
            query(database, "Could not load draft participants", (db) =>
              db
                .select({ link: submissionParticipants, contact: contacts })
                .from(submissionParticipants)
                .innerJoin(submissions, eq(submissions.id, submissionParticipants.submissionId))
                .innerJoin(forms, and(eq(forms.id, submissions.sourceFormId), eq(forms.id, formId)))
                .innerJoin(
                  events,
                  and(eq(events.id, submissions.eventId), eq(events.slug, eventSlug)),
                )
                .innerJoin(contacts, eq(contacts.id, submissionParticipants.contactId))
                .where(eq(submissionParticipants.submissionId, submissionId))
                .orderBy(asc(submissionParticipants.position))
                .execute(),
            ),
          ],
          { concurrency: 5 },
        ).pipe(
          Effect.flatMap(([baseRows, trackRows, tagRows, participantRows]) => {
            const first = baseRows[0];
            return Effect.all({
              event: decodeFound(Event, "Event", first?.event),
              form: decodeFound(Form, "Form", first?.form),
              fields: decodeMany(
                FormField,
                "form field",
                baseRows.flatMap((row) => (row.field === null ? [] : [row.field])),
              ),
              submission: decodeFound(Submission, "Submission", first?.submission),
              submitter: decodeFound(Contact, "Contact", first?.submitter),
              trackLinks: decodeMany(
                SubmissionTrack,
                "submission track",
                trackRows.map((row) => row.submission_tracks),
              ),
              tagLinks: decodeMany(
                SubmissionTag,
                "submission tag",
                tagRows.map((row) => row.submission_tags),
              ),
              participants: Effect.all(
                participantRows.map((row) =>
                  Effect.all({
                    link: decodeFound(SubmissionParticipant, "submission participant", row.link),
                    contact: decodeFound(Contact, "Contact", row.contact),
                  }),
                ),
              ),
            }).pipe(
              Effect.map(({ trackLinks, tagLinks, ...bundle }) => ({
                ...bundle,
                library: { tracks: [], formats: [], tags: [], levels: [] },
                trackIds: trackLinks.map((link) => link.trackId),
                tagIds: tagLinks.map((link) => link.tagId),
              })),
            );
          }),
        );
      },
    };
  }),
);
