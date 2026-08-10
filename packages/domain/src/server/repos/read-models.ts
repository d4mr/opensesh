import { and, asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Context, Effect, Layer } from "effect";

import {
  contacts,
  eventMembers,
  events,
  formFields,
  formats,
  forms,
  levels,
  organizationMembers,
  rooms,
  submissionParticipants,
  submissions,
  submissionTags,
  submissionTracks,
  tags,
  tracks,
  users,
} from "../../db/schema";
import type { SessionIdentity } from "../current-user";
import { Db } from "../db";
import { Forbidden, type DbError, type NotFound } from "../errors";
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

interface ReadModelsService {
  readonly eventLibraryForAdmin: (
    session: SessionIdentity,
    eventSlug: string,
    eventId: string,
  ) => Effect.Effect<
    {
      readonly tracks: ReadonlyArray<Track>;
      readonly formats: ReadonlyArray<Format>;
      readonly rooms: ReadonlyArray<Room>;
      readonly tags: ReadonlyArray<Tag>;
      readonly levels: ReadonlyArray<Level>;
      readonly admins: ReadonlyArray<EventAdmin>;
    },
    DbError | Forbidden
  >;
  readonly formSummariesForAdmin: (
    session: SessionIdentity,
    eventSlug: string,
    eventId: string,
  ) => Effect.Effect<ReadonlyArray<FormSummary>, DbError | Forbidden>;
  readonly formEditorForAdmin: (
    session: SessionIdentity,
    eventSlug: string,
    eventId: string,
    formId: string,
  ) => Effect.Effect<
    FormBundle & { readonly admins: ReadonlyArray<EventAdmin> },
    DbError | Forbidden | NotFound
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
    const currentEvent = alias(events, "read_current_event");
    const scopeMember = alias(eventMembers, "read_scope_member");
    const listedAdmin = alias(eventMembers, "read_listed_admin");

    const adminWhere = (session: SessionIdentity, eventSlug: string, eventId: string) =>
      and(
        eq(events.id, eventId),
        eq(currentEvent.slug, eventSlug),
        eq(scopeMember.role, "admin"),
        session.activeOrganizationId === undefined
          ? undefined
          : eq(currentEvent.organizationId, session.activeOrganizationId),
      );

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
      eventLibraryForAdmin: (session, eventSlug, eventId) => {
        return Effect.all(
          [
            query(database, "Could not list tracks and admins", (db) =>
              db
                .select({
                  track: tracks,
                  admin: { id: users.id, name: users.name, email: users.email },
                })
                .from(events)
                .innerJoin(currentEvent, eq(currentEvent.organizationId, events.organizationId))
                .innerJoin(
                  organizationMembers,
                  and(
                    eq(organizationMembers.organizationId, currentEvent.organizationId),
                    eq(organizationMembers.userId, session.userId),
                  ),
                )
                .innerJoin(
                  scopeMember,
                  and(
                    eq(scopeMember.eventId, currentEvent.id),
                    eq(scopeMember.userId, session.userId),
                  ),
                )
                .leftJoin(tracks, eq(tracks.eventId, events.id))
                .leftJoin(
                  listedAdmin,
                  and(eq(listedAdmin.eventId, events.id), eq(listedAdmin.role, "admin")),
                )
                .leftJoin(users, eq(users.id, listedAdmin.userId))
                .where(adminWhere(session, eventSlug, eventId))
                .orderBy(asc(tracks.position), asc(users.name))
                .execute(),
            ),
            query(database, "Could not list formats", (db) =>
              db
                .select({ item: formats })
                .from(events)
                .innerJoin(currentEvent, eq(currentEvent.organizationId, events.organizationId))
                .innerJoin(
                  organizationMembers,
                  and(
                    eq(organizationMembers.organizationId, currentEvent.organizationId),
                    eq(organizationMembers.userId, session.userId),
                  ),
                )
                .innerJoin(
                  scopeMember,
                  and(
                    eq(scopeMember.eventId, currentEvent.id),
                    eq(scopeMember.userId, session.userId),
                  ),
                )
                .leftJoin(formats, eq(formats.eventId, events.id))
                .where(adminWhere(session, eventSlug, eventId))
                .orderBy(asc(formats.position))
                .execute(),
            ),
            query(database, "Could not list rooms", (db) =>
              db
                .select({ item: rooms })
                .from(events)
                .innerJoin(currentEvent, eq(currentEvent.organizationId, events.organizationId))
                .innerJoin(
                  organizationMembers,
                  and(
                    eq(organizationMembers.organizationId, currentEvent.organizationId),
                    eq(organizationMembers.userId, session.userId),
                  ),
                )
                .innerJoin(
                  scopeMember,
                  and(
                    eq(scopeMember.eventId, currentEvent.id),
                    eq(scopeMember.userId, session.userId),
                  ),
                )
                .leftJoin(rooms, eq(rooms.eventId, events.id))
                .where(adminWhere(session, eventSlug, eventId))
                .orderBy(asc(rooms.position))
                .execute(),
            ),
            query(database, "Could not list tags", (db) =>
              db
                .select({ item: tags })
                .from(events)
                .innerJoin(currentEvent, eq(currentEvent.organizationId, events.organizationId))
                .innerJoin(
                  organizationMembers,
                  and(
                    eq(organizationMembers.organizationId, currentEvent.organizationId),
                    eq(organizationMembers.userId, session.userId),
                  ),
                )
                .innerJoin(
                  scopeMember,
                  and(
                    eq(scopeMember.eventId, currentEvent.id),
                    eq(scopeMember.userId, session.userId),
                  ),
                )
                .leftJoin(tags, eq(tags.eventId, events.id))
                .where(adminWhere(session, eventSlug, eventId))
                .orderBy(asc(tags.position))
                .execute(),
            ),
            query(database, "Could not list levels", (db) =>
              db
                .select({ item: levels })
                .from(events)
                .innerJoin(currentEvent, eq(currentEvent.organizationId, events.organizationId))
                .innerJoin(
                  organizationMembers,
                  and(
                    eq(organizationMembers.organizationId, currentEvent.organizationId),
                    eq(organizationMembers.userId, session.userId),
                  ),
                )
                .innerJoin(
                  scopeMember,
                  and(
                    eq(scopeMember.eventId, currentEvent.id),
                    eq(scopeMember.userId, session.userId),
                  ),
                )
                .leftJoin(levels, eq(levels.eventId, events.id))
                .where(adminWhere(session, eventSlug, eventId))
                .orderBy(asc(levels.position))
                .execute(),
            ),
          ],
          { concurrency: 5 },
        ).pipe(
          Effect.filterOrFail(
            ([trackAdminRows, formatRows, roomRows, tagRows, levelRows]) =>
              trackAdminRows.length > 0 &&
              formatRows.length > 0 &&
              roomRows.length > 0 &&
              tagRows.length > 0 &&
              levelRows.length > 0,
            () => new Forbidden({ message: "You do not have access" }),
          ),
          Effect.flatMap(([trackAdminRows, formatRows, roomRows, tagRows, levelRows]) => {
            const unique = <T extends { readonly id: string }>(rows: ReadonlyArray<T>) =>
              Array.from(new Map(rows.map((row) => [row.id, row])).values());
            return Effect.all(
              {
                tracks: decodeMany(
                  Track,
                  "track",
                  unique(trackAdminRows.flatMap((row) => (row.track === null ? [] : [row.track]))),
                ),
                formats: decodeMany(
                  Format,
                  "format",
                  formatRows.flatMap((row) => (row.item === null ? [] : [row.item])),
                ),
                rooms: decodeMany(
                  Room,
                  "room",
                  roomRows.flatMap((row) => (row.item === null ? [] : [row.item])),
                ),
                tags: decodeMany(
                  Tag,
                  "tag",
                  tagRows.flatMap((row) => (row.item === null ? [] : [row.item])),
                ),
                levels: decodeMany(
                  Level,
                  "level",
                  levelRows.flatMap((row) => (row.item === null ? [] : [row.item])),
                ),
                admins: decodeMany(
                  EventAdmin,
                  "event admin",
                  unique(
                    trackAdminRows.flatMap((row) =>
                      row.admin === null || row.admin.id === null ? [] : [row.admin],
                    ),
                  ),
                ),
              },
              { concurrency: 5 },
            );
          }),
        );
      },
      formSummariesForAdmin: (session, eventSlug, eventId) =>
        query(database, "Could not list form summaries", (db) =>
          db
            .select({ form: forms, submission: submissions })
            .from(events)
            .innerJoin(currentEvent, eq(currentEvent.organizationId, events.organizationId))
            .innerJoin(
              organizationMembers,
              and(
                eq(organizationMembers.organizationId, currentEvent.organizationId),
                eq(organizationMembers.userId, session.userId),
              ),
            )
            .innerJoin(
              scopeMember,
              and(eq(scopeMember.eventId, currentEvent.id), eq(scopeMember.userId, session.userId)),
            )
            .leftJoin(forms, eq(forms.eventId, events.id))
            .leftJoin(submissions, eq(submissions.sourceFormId, forms.id))
            .where(adminWhere(session, eventSlug, eventId))
            .orderBy(desc(forms.createdAt))
            .execute(),
        ).pipe(
          Effect.filterOrFail(
            (rows) => rows.length > 0,
            () => new Forbidden({ message: "You do not have access" }),
          ),
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
      formEditorForAdmin: (session, eventSlug, eventId, formId) => {
        const base = query(database, "Could not load form editor", (db) =>
          db
            .select({
              event: events,
              form: forms,
              field: formFields,
              admin: { id: users.id, name: users.name, email: users.email },
            })
            .from(events)
            .innerJoin(currentEvent, eq(currentEvent.organizationId, events.organizationId))
            .innerJoin(
              organizationMembers,
              and(
                eq(organizationMembers.organizationId, currentEvent.organizationId),
                eq(organizationMembers.userId, session.userId),
              ),
            )
            .innerJoin(
              scopeMember,
              and(eq(scopeMember.eventId, currentEvent.id), eq(scopeMember.userId, session.userId)),
            )
            .innerJoin(forms, and(eq(forms.eventId, events.id), eq(forms.id, formId)))
            .leftJoin(formFields, eq(formFields.formId, forms.id))
            .leftJoin(
              listedAdmin,
              and(eq(listedAdmin.eventId, events.id), eq(listedAdmin.role, "admin")),
            )
            .leftJoin(users, eq(users.id, listedAdmin.userId))
            .where(adminWhere(session, eventSlug, eventId))
            .orderBy(asc(formFields.position), asc(users.name))
            .execute(),
        );
        const library = <T>(
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
              .innerJoin(currentEvent, eq(currentEvent.organizationId, events.organizationId))
              .innerJoin(
                organizationMembers,
                and(
                  eq(organizationMembers.organizationId, currentEvent.organizationId),
                  eq(organizationMembers.userId, session.userId),
                ),
              )
              .innerJoin(
                scopeMember,
                and(
                  eq(scopeMember.eventId, currentEvent.id),
                  eq(scopeMember.userId, session.userId),
                ),
              )
              .innerJoin(table, eq(table.eventId, events.id))
              .where(adminWhere(session, eventSlug, eventId))
              .orderBy(asc(order))
              .execute(),
          ) as Effect.Effect<ReadonlyArray<{ readonly item: T }>, DbError>;
        return Effect.all(
          [
            base,
            library<typeof tracks.$inferSelect>("Could not list tracks", tracks, tracks.position),
            library<typeof formats.$inferSelect>(
              "Could not list formats",
              formats,
              formats.position,
            ),
            library<typeof tags.$inferSelect>("Could not list tags", tags, tags.position),
            library<typeof levels.$inferSelect>("Could not list levels", levels, levels.position),
          ],
          { concurrency: 5 },
        ).pipe(
          Effect.filterOrFail(
            ([baseRows]) => baseRows.length > 0,
            () => new Forbidden({ message: "You do not have access" }),
          ),
          Effect.flatMap(([baseRows, trackRows, formatRows, tagRows, levelRows]) => {
            return decodePublicForm(
              baseRows.map((row) => ({ event: row.event, form: row.form, field: row.field })),
              trackRows.map((row) => row.item),
              formatRows.map((row) => row.item),
              tagRows.map((row) => row.item),
              levelRows.map((row) => row.item),
            ).pipe(
              Effect.flatMap((bundle) =>
                decodeMany(
                  EventAdmin,
                  "event admin",
                  Array.from(
                    new Map(
                      baseRows.flatMap((row) =>
                        row.admin === null || row.admin.id === null
                          ? []
                          : [[row.admin.id, row.admin] as const],
                      ),
                    ).values(),
                  ),
                ).pipe(Effect.map((admins) => ({ ...bundle, admins }))),
              ),
            );
          }),
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
